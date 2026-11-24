const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const router = express.Router();
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message: 'Слишком много попыток. Попробуйте позже.' },
});
router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.get('/me', requireAuth, authController.me);
router.delete('/me', requireAuth, authLimiter, authController.deleteMe);
router.post('/logout', authController.logout);
module.exports = router;
