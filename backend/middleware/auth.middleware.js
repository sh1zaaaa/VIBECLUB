const jwt = require('jsonwebtoken');
const db = require('../config/db');
async function resolveUser(req) {
    const token = req.cookies?.vibeclub_token;
    if (!token)
        return null;
    let payload;
    try {
        payload = jwt.verify(token, process.env.JWT_SECRET);
    }
    catch {
        return null;
    }
    const { rows } = await db.query('SELECT id,role,email FROM users WHERE id=$1 AND is_active', [payload.sub]);
    return rows[0] || null;
}
async function requireAuth(req, res, next) {
    try {
        req.user = await resolveUser(req);
        if (!req.user)
            return res.status(401).json({ message: 'Требуется авторизация. Сессия недействительна.' });
        next();
    }
    catch (error) {
        next(error);
    }
}
async function optionalAuth(req, res, next) {
    try {
        req.user = await resolveUser(req);
        next();
    }
    catch (error) {
        next(error);
    }
}
function requireAdmin(req, res, next) {
    if (req.user?.role !== 'admin')
        return res.status(403).json({ message: 'Недостаточно прав.' });
    next();
}
module.exports = { requireAuth, requireAdmin, optionalAuth };
