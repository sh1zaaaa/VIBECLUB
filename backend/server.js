require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');
const db = require('./config/db');
const authRoutes = require('./routes/auth.routes');
const bookingRoutes = require('./routes/booking.routes');
const tournamentRoutes = require('./routes/tournament.routes');
const app = express();
const PORT = Number(process.env.PORT || 3000);
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be set and contain at least 32 characters.');
}
app.use(helmet({
    contentSecurityPolicy: false,
}));
const allowedOrigins = new Set([
    process.env.CLIENT_ORIGIN || 'http://localhost:3000',
    'http://localhost:3000', 'http://127.0.0.1:3000',
    'http://127.0.0.1:5500', 'http://localhost:5500'
]);
app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin))
            return callback(null, true);
        return callback(new Error('Origin is not allowed by CORS'));
    },
    credentials: true,
}));
app.use(express.json({ limit: '20kb' }));
app.use(cookieParser());
app.get('/api/health', async (req, res, next) => {
    try {
        await db.query('SELECT 1');
        res.json({ status: 'ok', service: 'VIBECLUB API', database: 'connected' });
    }
    catch (error) {
        next(error);
    }
});
app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/tournaments', tournamentRoutes);
const publicRoot = path.resolve(__dirname, '..');
app.use('/css', express.static(path.join(publicRoot, 'css')));
app.use('/js', express.static(path.join(publicRoot, 'js')));
for (const page of ['index.html', 'account.html', 'admin.html', 'booking.html', 'tournaments.html']) {
    app.get('/' + page, (req, res) => res.sendFile(path.join(publicRoot, page)));
}
app.get('/', (req, res) => res.sendFile(path.join(publicRoot, 'index.html')));
app.use((req, res) => {
    res.status(404).json({ message: 'Маршрут не найден.' });
});
app.use((error, req, res, next) => {
    console.error('[VIBECLUB API]', error);
    const message = process.env.NODE_ENV === 'development' ? (error.message || 'Внутренняя ошибка сервера.') : 'Внутренняя ошибка сервера.';
    res.status(500).json({ message });
});
app.listen(PORT, () => {
    console.log(`VIBECLUB server running: http://localhost:${PORT}`);
});
