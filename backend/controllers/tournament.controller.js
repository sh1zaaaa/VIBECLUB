const db = require('../config/db');
async function list(req, res, next) {
    try {
        const r = await db.query(`SELECT t.*,COUNT(e.id)::int registered,(SELECT COUNT(*) FROM tournament_entries x WHERE x.tournament_id=t.id AND x.user_id=$1)::int>0 joined FROM tournaments t LEFT JOIN tournament_entries e ON e.tournament_id=t.id GROUP BY t.id ORDER BY t.starts_at`, [req.user?.id || 0]);
        res.json({ tournaments: r.rows });
    }
    catch (e) {
        next(e);
    }
}
async function join(req, res, next) {
    try {
        const id = Number(req.params.id);
        const c = await db.connect();
        try {
            await c.query('BEGIN');
            const t = await c.query('SELECT id,max_players,status FROM tournaments WHERE id=$1 FOR UPDATE', [id]);
            if (!t.rowCount || t.rows[0].status !== 'open') {
                await c.query('ROLLBACK');
                return res.status(404).json({ message: 'Регистрация на этот турнир закрыта.' });
            }
            const count = await c.query('SELECT COUNT(*)::int n FROM tournament_entries WHERE tournament_id=$1', [id]);
            if (count.rows[0].n >= t.rows[0].max_players) {
                await c.query('ROLLBACK');
                return res.status(409).json({ message: 'Все места уже заняты.' });
            }
            await c.query('INSERT INTO tournament_entries(tournament_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [id, req.user.id]);
            await c.query('COMMIT');
            res.status(201).json({ message: 'Ты зарегистрирован на турнир 1 на 1!' });
        }
        catch (e) {
            await c.query('ROLLBACK');
            throw e;
        }
        finally {
            c.release();
        }
    }
    catch (e) {
        next(e);
    }
}
async function adminCreate(req, res, next) {
    try {
        const { title, game, description, startsAt, maxPlayers } = req.body;
        if (!title || !game || !Number.isFinite(new Date(startsAt).getTime()) || !Number.isInteger(Number(maxPlayers)) || Number(maxPlayers) < 2)
            return res.status(400).json({ message: 'Заполните название, игру, дату и лимит участников.' });
        const r = await db.query(`INSERT INTO tournaments(title,game,description,starts_at,max_players,format) VALUES($1,$2,$3,$4,$5,'1v1') RETURNING *`, [title, game, description || '', new Date(startsAt), Number(maxPlayers)]);
        res.status(201).json({ tournament: r.rows[0] });
    }
    catch (e) {
        next(e);
    }
}
async function adminStatus(req, res, next) {
    try {
        const status = req.body.status;
        if (!['open', 'closed', 'finished'].includes(status))
            return res.status(400).json({ message: 'Недопустимый статус.' });
        const r = await db.query('UPDATE tournaments SET status=$1 WHERE id=$2 RETURNING *', [status, req.params.id]);
        if (!r.rowCount)
            return res.status(404).json({ message: 'Турнир не найден.' });
        res.json({ tournament: r.rows[0] });
    }
    catch (e) {
        next(e);
    }
}
async function adminEntries(req, res, next) {
    try {
        const r = await db.query(`SELECT e.id,e.created_at,u.id user_id,u.name,u.email FROM tournament_entries e JOIN users u ON u.id=e.user_id WHERE e.tournament_id=$1 ORDER BY e.created_at`, [req.params.id]);
        res.json({ entries: r.rows });
    }
    catch (e) {
        next(e);
    }
}
async function removeEntry(req, res, next) {
    try {
        const r = await db.query('DELETE FROM tournament_entries WHERE tournament_id=$1 AND user_id=$2 RETURNING id', [req.params.id, req.params.userId]);
        if (!r.rowCount)
            return res.status(404).json({ message: 'Участник не найден.' });
        res.json({ message: 'Участник удалён из списка.' });
    }
    catch (e) {
        next(e);
    }
}
async function adminDelete(req, res, next) {
    try {
        if (!/^[1-9]\d*$/.test(req.params.id))
            return res.status(400).json({ message: 'Некорректный ID.' });
        const result = await db.query('DELETE FROM tournaments WHERE id=$1 RETURNING id', [req.params.id]);
        if (!result.rowCount)
            return res.status(404).json({ message: 'Турнир не найден.' });
        res.json({ message: 'Турнир удалён.' });
    }
    catch (e) {
        next(e);
    }
}
module.exports = { list, join, adminCreate, adminStatus, adminEntries, removeEntry, adminDelete };
