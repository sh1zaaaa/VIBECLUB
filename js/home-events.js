(async () => {
    const root = document.querySelector('#homeEvents');
    if (!root)
        return;
    try {
        const response = await fetch('/api/tournaments/', { credentials: 'same-origin' });
        const data = await response.json();
        if (!response.ok)
            throw new Error(data.message || 'Не удалось загрузить события');
        const items = (data.tournaments || []).slice(0, 3);
        const invResponse = await fetch('/api/bookings/inventory');
        if (invResponse.ok) {
            const inv = await invResponse.json();
            const standard = inv.zones.find(z => z.slug === 'standard');
            if (standard) {
                const durations = [60, 300, 600];
                document.querySelectorAll('.price-value').forEach((node, i) => {
                    for (const period of ['weekday', 'weekend']) {
                        const tariff = standard.tariffs.find(t => t.period === period && Number(t.duration_minutes) === durations[i]);
                        if (tariff)
                            node.dataset[period] = String(Number(tariff.price));
                    }
                    const active = document.querySelector('.price-tab.is-active')?.dataset.period || 'weekday';
                    node.innerHTML = `${node.dataset[active] === '—' ? '—' : new Intl.NumberFormat('ru-RU').format(Number(node.dataset[active] || 0))} <small>₽</small>`;
                });
            }
        }
        root.innerHTML = items.length ? items.map(t => {
            const d = new Date(t.starts_at);
            const day = d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
            return `<button class="event-row js-home-event" data-next="/tournaments.html">
<div class="event-date"><strong>${day}</strong><span>${d.toLocaleDateString('ru-RU', { weekday: 'short' })}</span></div>
<div class="event-main"><span class="event-type">TOURNAMENT / ${escapeHtml(t.game)}</span>
<h3>${escapeHtml(t.title)}</h3>
<p>${escapeHtml(t.description || 'Подробности на странице турниров.')}</p></div><span class="event-prize">УЧАСТНИКИ <b>${t.registered}/${t.max_players}</b></span><span class="event-arrow">↗</span></button>`;
        }).join('') : `<div class="event-row">
<div class="event-main">
<h3>НОВЫЕ СОБЫТИЯ СКОРО</h3>
<p>Следи за обновлениями VIBECLUB.</p></div></div>`;
        root.querySelectorAll('.js-home-event').forEach(b => b.addEventListener('click', () => {
            const gate = document.querySelector('.js-auth-gate[data-next="/tournaments.html"]');
            gate?.click();
        }));
    }
    catch (e) {
        root.innerHTML = `<div class="event-row">
<div class="event-main">
<h3>СОБЫТИЯ VIBECLUB</h3>
<p>Информация временно недоступна.</p></div></div>`;
    }
    function escapeHtml(v) {
        return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
})();
