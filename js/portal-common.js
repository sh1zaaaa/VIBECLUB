window.Vibe = { api: async (url, options = {}) => {
        const r = await fetch(url, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
        const data = await r.json().catch(() => ({}));
        if (!r.ok)
            throw new Error(data.message || 'Ошибка запроса');
        return data;
    }, me: async () => {
        const d = await Vibe.api('/api/auth/me');
        return d.user;
    }, money: v => new Intl.NumberFormat('ru-RU').format(Number(v || 0)) + ' ₽', date: v => new Date(v).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }), status: s => ({ pending: 'Ожидает подтверждения', confirmed: 'Подтверждена', cancelled: 'Отменена', completed: 'Завершена', no_show: 'Неявка', open: 'Регистрация открыта', closed: 'Регистрация закрыта', finished: 'Завершён' })[s] || s, escape: s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) };
(async () => {
    let user = null;
    try {
        user = await Vibe.me();
    }
    catch { }
    const admin = document.querySelector('#adminNav');
    if (admin && user?.role === 'admin')
        admin.classList.remove('hidden');
    document.querySelectorAll('.main-nav a[href="/account.html"],.main-nav a[href="/booking.html"],.main-nav a[href="/tournaments.html"],.header-account-link').forEach(a => {
        a.addEventListener('click', e => {
            if (!user) {
                e.preventDefault();
                location.href = '/?auth=login&next=' + encodeURIComponent(a.getAttribute('href'));
            }
        });
    });
    const glow = document.querySelector('.cursor-glow');
    if (glow && window.matchMedia('(pointer:fine)').matches) {
        window.addEventListener('pointermove', e => {
            glow.style.left = `${e.clientX}px`;
            glow.style.top = `${e.clientY}px`;
        }, { passive: true });
    }
    else if (glow) {
        glow.remove();
    }
})();
