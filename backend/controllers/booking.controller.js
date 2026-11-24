const db = require('../config/db');
async function inventory(req, res, next) {
    try {
        const result = await db.query(`SELECT z.id zone_id,z.name zone_name,z.slug,c.id computer_id,c.name computer_name,c.device_type,c.status,c.specs FROM zones z LEFT JOIN computers c ON c.zone_id=z.id WHERE z.is_active=TRUE ORDER BY z.id,c.id`);
        const tr = await db.query(`SELECT zone_id,period,duration_minutes,price FROM tariffs WHERE is_active=TRUE ORDER BY zone_id,period,duration_minutes`);
        const map = new Map();
        for (const r of result.rows) {
            if (!map.has(r.zone_id))
                map.set(r.zone_id, { id: r.zone_id, name: r.zone_name, slug: r.slug, computers: [], tariffs: [] });
            if (r.computer_id)
                map.get(r.zone_id).computers.push({ id: r.computer_id, name: r.computer_name, type: r.device_type, status: r.status, specs: r.specs });
        }
        for (const t of tr.rows)
            map.get(t.zone_id)?.tariffs.push(t);
        res.json({ zones: [...map.values()] });
    }
    catch (e) {
        next(e);
    }
}
async function availability(req, res, next) {
    try {
        const zoneId = req.query.zoneId ? Number(req.query.zoneId) : null, startsAt = new Date(req.query.startsAt), endsAt = new Date(req.query.endsAt);
        if ((zoneId !== null && !Number.isSafeInteger(zoneId)) || !Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt)
            return res.status(400).json({ message: 'Проверьте зону и время.' });
        const r = await db.query(`SELECT c.id FROM computers c WHERE ($1::bigint IS NULL OR c.zone_id=$1) AND (c.status<>'available' OR EXISTS(SELECT 1 FROM bookings b WHERE b.computer_id=c.id AND b.status IN ('pending','confirmed') AND b.starts_at<$3 AND b.ends_at>$2))`, [zoneId, startsAt, endsAt]);
        res.json({ unavailableComputerIds: r.rows.map(x => Number(x.id)) });
    }
    catch (e) {
        next(e);
    }
}
async function create(req, res, next) {
    const raw = req.body.computerIds ?? [req.body.computerId];
    const startsAt = new Date(req.body.startsAt);
    const hours = Number(req.body.hours);
    if (!Array.isArray(raw) || !raw.length || raw.length > 100 || raw.some(id => !Number.isSafeInteger(Number(id)) || Number(id) <= 0) || !Number.isFinite(startsAt.getTime()) || startsAt <= new Date() || ![1, 2, 3, 4, 5, 6, 8, 10].includes(hours)) {
        return res.status(400).json({ message: 'Проверьте места, дату и длительность.' });
    }
    const ids = [...new Set(raw.map(Number))].sort((a, b) => a - b);
    const endsAt = new Date(startsAt.getTime() + hours * 3600000);
    let client;
    try {
        client = await db.connect();
        await client.query('BEGIN');
        const user = await client.query('SELECT id FROM users WHERE id=$1 AND is_active FOR KEY SHARE', [req.user.id]);
        if (!user.rowCount) {
            await client.query('ROLLBACK');
            return res.status(401).json({ message: 'Аккаунт недоступен.' });
        }
        for (const id of ids)
            await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [id]);
        const seats = await client.query(`SELECT c.id,c.name,c.status,c.zone_id FROM computers c JOIN zones z ON z.id=c.zone_id WHERE c.id=ANY($1::bigint[]) AND z.is_active ORDER BY c.id FOR UPDATE OF c`, [ids]);
        if (seats.rowCount !== ids.length || seats.rows.some(c => c.status !== 'available')) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: 'Одно из мест недоступно. Заявка не создана.' });
        }
        const overlap = await client.query(`SELECT 1 FROM bookings WHERE computer_id=ANY($1::bigint[]) AND status IN ('pending','confirmed') AND starts_at<$3 AND ends_at>$2 LIMIT 1`, [ids, startsAt, endsAt]);
        if (overlap.rowCount) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: 'Одно из мест уже занято. Ни одно место не забронировано.' });
        }
        const period = [0, 6].includes(startsAt.getDay()) ? 'weekend' : 'weekday';
        const bookings = [];
        for (const seat of seats.rows) {
            const { rows } = await client.query(`SELECT id,price,duration_minutes FROM tariffs WHERE zone_id=$1 AND period=$2 AND duration_minutes IN ($3,60) AND is_active ORDER BY duration_minutes DESC LIMIT 1`, [seat.zone_id, period, hours * 60]);
            const tariff = rows[0];
            if (!tariff) {
                await client.query('ROLLBACK');
                return res.status(409).json({ message: 'Для одного из мест не настроен тариф.' });
            }
            const price = Number(tariff.price) * (Number(tariff.duration_minutes) === 60 ? hours : 1);
            const inserted = await client.query(`INSERT INTO bookings(user_id,computer_id,tariff_id,starts_at,ends_at,total_price,status) VALUES($1,$2,$3,$4,$5,$6,'pending') RETURNING *`, [req.user.id, seat.id, tariff.id, startsAt, endsAt, price]);
            bookings.push(inserted.rows[0]);
        }
        await client.query('COMMIT');
        res.status(201).json({ message: `Заявка создана: ${bookings.length} мест. Ожидайте подтверждения.`, bookings, booking: bookings[0], totalPrice: bookings.reduce((sum, b) => sum + Number(b.total_price), 0) });
    }
    catch (e) {
        if (client)
            await client.query('ROLLBACK').catch(() => { });
        next(e);
    }
    finally {
        if (client)
            client.release();
    }
}
async function mine(req, res, next) {
    try {
        const r = await db.query(`SELECT b.id,b.starts_at,b.ends_at,b.total_price,b.status,c.name computer_name,z.name zone_name FROM bookings b JOIN computers c ON c.id=b.computer_id JOIN zones z ON z.id=c.zone_id WHERE b.user_id=$1 ORDER BY b.starts_at DESC`, [req.user.id]);
        res.json({ bookings: r.rows });
    }
    catch (e) {
        next(e);
    }
}
async function cancelMine(req, res, next) {
    try {
        const r = await db.query(`UPDATE bookings SET status='cancelled' WHERE id=$1 AND user_id=$2 AND status='pending' RETURNING id`, [req.params.id, req.user.id]);
        if (!r.rowCount)
            return res.status(409).json({ message: 'Эту бронь нельзя отменить самостоятельно.' });
        res.json({ message: 'Бронь отменена.' });
    }
    catch (e) {
        next(e);
    }
}
async function adminList(req, res, next) {
    try {
        const r = await db.query(`SELECT b.id,b.starts_at,b.ends_at,b.total_price,b.status,u.name user_name,u.email,c.name computer_name,z.name zone_name FROM bookings b JOIN users u ON u.id=b.user_id JOIN computers c ON c.id=b.computer_id JOIN zones z ON z.id=c.zone_id ORDER BY b.starts_at DESC LIMIT 300`);
        res.json({ bookings: r.rows });
    }
    catch (e) {
        next(e);
    }
}
async function adminStatus(req, res, next) {
    try {
        const status = String(req.body.status || '');
        if (!['confirmed', 'cancelled', 'completed', 'no_show'].includes(status))
            return res.status(400).json({ message: 'Недопустимый статус.' });
        const r = await db.query('UPDATE bookings SET status=$1 WHERE id=$2 RETURNING id,status', [status, req.params.id]);
        if (!r.rowCount)
            return res.status(404).json({ message: 'Бронь не найдена.' });
        res.json({ booking: r.rows[0] });
    }
    catch (e) {
        next(e);
    }
}
async function adminComputers(req, res, next) {
    try {
        const r = await db.query(`SELECT c.id,c.name,c.status,z.name zone_name FROM computers c JOIN zones z ON z.id=c.zone_id ORDER BY z.id,c.id`);
        res.json({ computers: r.rows });
    }
    catch (e) {
        next(e);
    }
}
async function adminComputerStatus(req, res, next) {
    try {
        const status = req.body.status;
        if (!['available', 'maintenance', 'disabled'].includes(status))
            return res.status(400).json({ message: 'Недопустимый статус места.' });
        const r = await db.query('UPDATE computers SET status=$1 WHERE id=$2 RETURNING id,status', [status, req.params.id]);
        if (!r.rowCount)
            return res.status(404).json({ message: 'Место не найдено.' });
        res.json({ computer: r.rows[0] });
    }
    catch (e) {
        next(e);
    }
}
module.exports = { inventory, availability, create, mine, cancelMine, adminList, adminStatus, adminComputers, adminComputerStatus };
