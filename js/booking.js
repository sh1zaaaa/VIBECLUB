(async () => {
    const $ = s => document.querySelector(s);
    const zone = $('#zoneSelect'), grid = $('#seatGrid'), date = $('#bookingDate'), hours = $('#hoursSelect'), msg = $('#bookingMessage'), submit = $('#createBooking');
    const params = new URLSearchParams(location.search);
    const selected = new Set();
    let zones = [], unavailable = new Set(), ready = false, sending = false, request = 0;
    const local = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const now = new Date(Date.now() + 3600000);
    now.setMinutes(0, 0, 0);
    date.min = local(new Date());
    date.value = local(now);
    function estimate(z) {
        const period = [0, 6].includes(new Date(date.value).getDay()) ? 'weekend' : 'weekday';
        const h = Number(hours.value);
        const exact = z.tariffs.find(t => t.period === period && Number(t.duration_minutes) === h * 60);
        const hourly = z.tariffs.find(t => t.period === period && Number(t.duration_minutes) === 60);
        return exact ? Number(exact.price) : hourly ? Number(hourly.price) * h : null;
    }
    function updateSummary() {
        const choices = zones.flatMap(z => z.computers.filter(c => selected.has(String(c.id))).map(c => ({ name: `${z.name} / ${c.name}`, price: estimate(z) })));
        const total = choices.reduce((sum, c) => sum + (c.price ?? 0), 0);
        const missing = choices.some(c => c.price === null);
        $('#priceEstimate').textContent = missing ? 'Для выбранного места нет тарифа.' : `Выбрано мест: ${choices.length}. Итого: ${Vibe.money(total)}. Оплата в клубе.`;
        $('#selectionSummary').textContent = choices.length ? `${choices.map(c => c.name).join(', ')} · ${date.value.replace('T', ' ')} · ${hours.value} ч.` : 'Места не выбраны.';
        submit.disabled = !ready || sending || !choices.length || missing;
    }
    function renderSeats() {
        grid.innerHTML = zones.map(z => `<section class="floor-zone zone-${Vibe.escape(z.slug)} ${zone.value && zone.value !== String(z.id) ? 'zone-muted' : ''}">
      <h3>${Vibe.escape(z.name)}</h3>
<div class="floor-seats">${z.computers.map(c => {
            const id = String(c.id);
            const busy = !ready || c.status !== 'available' || unavailable.has(id) || estimate(z) === null;
            return `<button type="button" class="seat ${busy ? 'busy' : ''} ${selected.has(id) ? 'selected' : ''}" data-seat="${id}" aria-pressed="${selected.has(id)}" ${busy || sending ? 'disabled' : ''}><span>${Vibe.escape(c.name)}</span><small>${busy ? 'НЕДОСТУПНО' : c.type === 'ps5' ? 'PS5' : 'PC'}</small></button>`;
        }).join('') || '<p class="muted">Нет мест</p>'}</div></section>`).join('');
        grid.querySelectorAll('[data-seat]').forEach(b => b.onclick = () => {
            const id = b.dataset.seat;
            if (selected.has(id))
                selected.delete(id);
            else
                selected.add(id);
            renderSeats();
        });
        updateSummary();
    }
    async function refreshSeats() {
        const version = ++request;
        ready = false;
        renderSeats();
        try {
            const start = new Date(date.value), end = new Date(start.getTime() + Number(hours.value) * 3600000);
            if (!Number.isFinite(start.getTime()) || start <= new Date())
                throw new Error('Выберите время в будущем.');
            const a = await Vibe.api(`/api/bookings/availability?startsAt=${encodeURIComponent(start.toISOString())}&endsAt=${encodeURIComponent(end.toISOString())}`);
            if (version !== request)
                return;
            unavailable = new Set(a.unavailableComputerIds.map(String));
            for (const id of selected)
                if (unavailable.has(id))
                    selected.delete(id);
            ready = true;
        }
        catch (e) {
            if (version !== request)
                return;
            msg.textContent = e.message;
        }
        renderSeats();
    }
    zone.onchange = renderSeats;
    hours.onchange = date.onchange = () => {
        msg.textContent = '';
        refreshSeats();
    };
    submit.onclick = async () => {
        if (!ready || sending || !selected.size)
            return;
        sending = true;
        zone.disabled = date.disabled = hours.disabled = true;
        renderSeats();
        try {
            const result = await Vibe.api('/api/bookings', { method: 'POST', body: JSON.stringify({ computerIds: [...selected], startsAt: new Date(date.value).toISOString(), hours: Number(hours.value) }) });
            selected.clear();
            msg.innerHTML = `<div class="notice">${Vibe.escape(result.message)} Итого: ${Vibe.money(result.totalPrice)}. <a href="/account.html">Личный кабинет ↗</a></div>`;
        }
        catch (e) {
            msg.innerHTML = `<div class="notice error">${Vibe.escape(e.message)}</div>`;
        }
        finally {
            sending = false;
            zone.disabled = date.disabled = hours.disabled = false;
            await refreshSeats();
        }
    };
    try {
        await Vibe.me();
        zones = (await Vibe.api('/api/bookings/inventory')).zones;
        zone.innerHTML = '<option value="">Все зоны</option>' + zones.map(z => `<option value="${z.id}">${Vibe.escape(z.name)}</option>`).join('');
        const match = zones.find(z => z.slug === params.get('zone'));
        if (match)
            zone.value = String(match.id);
        if (['1', '2', '3', '4', '5', '6', '8', '10'].includes(params.get('hours')))
            hours.value = params.get('hours');
        await refreshSeats();
    }
    catch (e) {
        grid.innerHTML = `<div class="empty">${Vibe.escape(e.message)}. <a href="/?auth=login&amp;next=${encodeURIComponent('/booking.html' + location.search)}">Войти в аккаунт</a></div>`;
    }
})();
