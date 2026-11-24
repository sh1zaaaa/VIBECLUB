const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const SALT_ROUNDS = 12;
const COOKIE_NAME = 'vibeclub_token';
function cookieOptions() {
    const isProduction = process.env.NODE_ENV === 'production';
    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000,
        path: '/',
    };
}
function createToken(user) {
    return jwt.sign({ role: user.role, email: user.email }, process.env.JWT_SECRET, { subject: String(user.id), expiresIn: process.env.JWT_EXPIRES_IN || '1d' });
}
function publicUser(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        createdAt: user.created_at,
    };
}
async function register(req, res, next) {
    try {
        const name = String(req.body.name || '').trim();
        const email = String(req.body.email || '').trim().toLowerCase();
        const phone = req.body.phone ? String(req.body.phone).trim() : null;
        const password = String(req.body.password || '');
        if (name.length < 2 || name.length > 60) {
            return res.status(400).json({ message: 'Имя должно содержать от 2 до 60 символов.' });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
            return res.status(400).json({ message: 'Укажите корректную электронную почту.' });
        }
        if (password.length < 8 || password.length > 72) {
            return res.status(400).json({ message: 'Пароль должен содержать от 8 до 72 символов.' });
        }
        if (phone && phone.length > 30) {
            return res.status(400).json({ message: 'Проверьте номер телефона.' });
        }
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        const result = await db.query(`INSERT INTO users (name, email, phone, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, phone, role, created_at`, [name, email, phone, passwordHash]);
        const user = result.rows[0];
        res.cookie(COOKIE_NAME, createToken(user), cookieOptions());
        return res.status(201).json({
            message: 'Аккаунт VIBECLUB создан.',
            user: publicUser(user),
        });
    }
    catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ message: 'Пользователь с такой почтой уже зарегистрирован.' });
        }
        next(error);
    }
}
async function login(req, res, next) {
    try {
        const email = String(req.body.email || '').trim().toLowerCase();
        const password = String(req.body.password || '');
        if (!email || !password) {
            return res.status(400).json({ message: 'Введите почту и пароль.' });
        }
        const result = await db.query(`SELECT id, name, email, phone, role, created_at, password_hash, is_active
       FROM users WHERE email = $1`, [email]);
        const user = result.rows[0];
        if (!user || !user.is_active || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ message: 'Неверная почта или пароль.' });
        }
        res.cookie(COOKIE_NAME, createToken(user), cookieOptions());
        return res.json({
            message: 'Вы успешно вошли в VIBECLUB.',
            user: publicUser(user),
        });
    }
    catch (error) {
        next(error);
    }
}
async function me(req, res, next) {
    try {
        const result = await db.query(`SELECT id, name, email, phone, role, created_at
       FROM users WHERE id = $1 AND is_active = TRUE`, [req.user.id]);
        if (!result.rows[0]) {
            return res.status(401).json({ message: 'Аккаунт не найден или отключён.' });
        }
        return res.json({ user: publicUser(result.rows[0]) });
    }
    catch (error) {
        next(error);
    }
}
function logout(req, res) {
    res.clearCookie(COOKIE_NAME, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
    });
    return res.json({ message: 'Вы вышли из аккаунта.' });
}
async function deleteMe(req, res, next) {
    let client;
    try {
        client = await db.connect();
        await client.query('BEGIN');
        const result = await client.query('SELECT password_hash FROM users WHERE id=$1 FOR UPDATE', [req.user.id]);
        if (!result.rowCount || typeof req.body.password !== 'string' || !(await bcrypt.compare(req.body.password, result.rows[0].password_hash))) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'Неверный пароль.' });
        }
        await client.query('DELETE FROM bookings WHERE user_id=$1', [req.user.id]);
        await client.query('DELETE FROM users WHERE id=$1', [req.user.id]);
        await client.query('COMMIT');
        return logout(req, res);
    }
    catch (error) {
        if (client)
            await client.query('ROLLBACK').catch(() => { });
        next(error);
    }
    finally {
        if (client)
            client.release();
    }
}
module.exports = { register, login, me, logout, deleteMe };
