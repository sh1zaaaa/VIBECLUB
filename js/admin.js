(async function () {
    const root = document.querySelector('#adminContent');
    const esc = Vibe.escape;
    try {
        const user = await Vibe.me();
        if (user.role !== 'admin')
            throw new Error('Доступ запрещён. Эта страница доступна только администратору.');
        document.querySelector('#adminNav')?.classList.remove('hidden');
        const results = await Promise.all([Vibe.api('/api/bookings/admin'), Vibe.api('/api/tournaments/'), Vibe.api('/api/bookings/admin/computers')]);
        const bookings = results[0].bookings, tournaments = results[1].tournaments, computers = results[2].computers;
        root.innerHTML = `
   <div class="stat-row">
<div class="stat"><strong>${bookings.filter(x => x.status === 'pending').length}</strong><span>ОЖИДАЮТ ПОДТВЕРЖДЕНИЯ</span></div>
<div class="stat"><strong>${bookings.filter(x => x.status === 'confirmed').length}</strong><span>ПОДТВЕРЖДЁННЫЕ</span></div>
<div class="stat"><strong>${tournaments.length}</strong><span>ТУРНИРОВ</span></div></div>
   <section class="panel">
<h2>BOOKING CONTROL</h2>
<div class="table-scroll">${bookings.length ? `<table class="data-table">
<thead>
<tr>
<th>№</th>
<th>КЛИЕНТ</th>
<th>МЕСТО</th>
<th>ВРЕМЯ</th>
<th>СУММА</th>
<th>СТАТУС</th>
<th>ДЕЙСТВИЕ</th></tr></thead>
<tbody>${bookings.map(b => `<tr>
<td>#${b.id}</td>
<td>${esc(b.user_name)}<br><span class="muted">${esc(b.email)}</span></td>
<td>${esc(b.zone_name)} / ${esc(b.computer_name)}</td>
<td>${Vibe.date(b.starts_at)}<br>${Vibe.date(b.ends_at)}</td>
<td>${Vibe.money(b.total_price)}</td>
<td><span class="status ${b.status}">${Vibe.status(b.status)}</span></td>
<td>
<select data-status="${b.id}">
<option value="">Изменить…</option>
<option value="confirmed">Подтвердить</option>
<option value="cancelled">Отменить</option>
<option value="completed">Завершена</option>
<option value="no_show">Неявка</option></select></td></tr>`).join('')}</tbody></table>` : '<div class="empty">Заявок пока нет.</div>'}</div></section>
   <section class="panel" style="margin-top:18px">
<h2>SEAT CONTROL</h2>
<p class="muted small">«Обслуживание» и «Отключено» закрывают место для новых броней. Возврат в «Доступно» снова открывает его.</p>
<div class="table-scroll">
<table class="data-table">
<thead>
<tr>
<th>ЗОНА</th>
<th>МЕСТО</th>
<th>СОСТОЯНИЕ</th>
<th>ИЗМЕНИТЬ</th></tr></thead>
<tbody>${computers.map(c => `<tr>
<td>${esc(c.zone_name)}</td>
<td>${esc(c.name)}</td>
<td>${c.status === 'available' ? 'Доступно' : c.status === 'maintenance' ? 'Обслуживание' : 'Отключено'}</td>
<td>
<select data-computer="${c.id}">
<option value="">Изменить…</option>
<option value="available">Доступно</option>
<option value="maintenance">Обслуживание</option>
<option value="disabled">Отключено</option></select></td></tr>`).join('')}</tbody></table></div></section>
   <div class="grid" style="margin-top:18px">
<section class="panel">
<h2>CREATE TOURNAMENT</h2>
<form id="tournamentForm">
<div class="field">
<label>НАЗВАНИЕ</label>
<input name="title" required maxlength="120" placeholder="VIBE NIGHT CUP"></div>
<div class="field">
<label>ИГРА</label>
<input name="game" required placeholder="CS2"></div>
<div class="field">
<label>ОПИСАНИЕ</label><textarea name="description" rows="3"></textarea></div>
<div class="field">
<label>ДАТА И ВРЕМЯ</label>
<input name="startsAt" type="datetime-local" required></div>
<div class="field">
<label>ЛИМИТ ИГРОКОВ (1 НА 1)</label>
<input name="maxPlayers" type="number" min="2" value="16" required></div>
<button class="lime-btn">СОЗДАТЬ ТУРНИР ↗</button></form>
<div id="tournamentMessage"></div></section>
   <section class="panel">
<h2>TOURNAMENT CONTROL</h2>${tournaments.length ? tournaments.map(t => `<div class="admin-tournament"><h3>${esc(t.title)}</h3>
<p class="muted small">${esc(t.game)} · ${Vibe.date(t.starts_at)} · ${t.registered}/${t.max_players} игроков · 1×1</p>
<div class="inline-actions">
<select data-tournament="${t.id}">
<option value="">${Vibe.status(t.status)}</option>
<option value="open">Открыть регистрацию</option>
<option value="closed">Закрыть регистрацию</option>
<option value="finished">Завершить</option></select>
<button class="ghost-btn" data-entries="${t.id}">УЧАСТНИКИ</button>
<button class="danger-btn" data-delete-tournament="${t.id}">УДАЛИТЬ ТУРНИР</button></div>
<div class="participant-list" id="entries-${t.id}" hidden></div></div>`).join('') : '<p class="muted">Турниров пока нет.</p>'}</section></div>`;
        root.querySelectorAll('[data-status]').forEach(s => s.onchange = async () => {
            if (!s.value)
                return;
            try {
                await Vibe.api(`/api/bookings/admin/${s.dataset.status}/status`, { method: 'PATCH', body: JSON.stringify({ status: s.value }) });
                location.reload();
            }
            catch (e) {
                alert(e.message);
            }
        });
        root.querySelectorAll('[data-computer]').forEach(s => s.onchange = async () => {
            if (!s.value)
                return;
            try {
                await Vibe.api(`/api/bookings/admin/computers/${s.dataset.computer}/status`, { method: 'PATCH', body: JSON.stringify({ status: s.value }) });
                location.reload();
            }
            catch (e) {
                alert(e.message);
            }
        });
        root.querySelectorAll('[data-tournament]').forEach(s => s.onchange = async () => {
            if (!s.value)
                return;
            try {
                await Vibe.api(`/api/tournaments/admin/${s.dataset.tournament}/status`, { method: 'PATCH', body: JSON.stringify({ status: s.value }) });
                location.reload();
            }
            catch (e) {
                alert(e.message);
            }
        });
        root.querySelectorAll('[data-delete-tournament]').forEach(btn => btn.onclick = async () => {
            if (!confirm('Удалить турнир и все регистрации без возможности восстановления?'))
                return;
            try {
                await Vibe.api(`/api/tournaments/admin/${btn.dataset.deleteTournament}`, { method: 'DELETE' });
                location.reload();
            }
            catch (e) {
                alert(e.message);
            }
        });
        root.querySelectorAll('[data-entries]').forEach(btn => btn.onclick = async () => {
            const id = btn.dataset.entries, box = root.querySelector(`#entries-${id}`);
            try {
                const data = await Vibe.api(`/api/tournaments/admin/${id}/entries`);
                box.hidden = false;
                box.innerHTML = `<div class="participant-heading">
                    <h3>СПИСОК УЧАСТНИКОВ</h3>
                    <span class="status">${data.entries.length}</span>
                </div>
                ${data.entries.length ? data.entries.map((p, index) => `
                    <div class="participant-row">
                        <span class="participant-number">${String(index + 1).padStart(2, '0')}</span>
                        <div class="participant-info">
                            <strong>${esc(p.name)}</strong>
                            <small class="muted">${esc(p.email)}</small>
                        </div>
                        <button class="danger-btn" data-remove-player="${p.user_id}">УДАЛИТЬ</button>
                    </div>`).join('') : '<p class="muted small">Пока нет участников.</p>'}`;
                box.querySelectorAll('[data-remove-player]').forEach(x => x.onclick = async () => {
                    if (!confirm('Удалить участника из турнира?'))
                        return;
                    try {
                        await Vibe.api(`/api/tournaments/admin/${id}/entries/${x.dataset.removePlayer}`, { method: 'DELETE' });
                        btn.click();
                    }
                    catch (e) {
                        alert(e.message);
                    }
                });
            }
            catch (e) {
                box.hidden = false;
                box.textContent = e.message;
            }
        });
        root.querySelector('#tournamentForm').onsubmit = async (e) => {
            e.preventDefault();
            const payload = Object.fromEntries(new FormData(e.target));
            payload.startsAt = new Date(payload.startsAt).toISOString();
            payload.maxPlayers = Number(payload.maxPlayers);
            try {
                await Vibe.api('/api/tournaments/admin', { method: 'POST', body: JSON.stringify(payload) });
                location.reload();
            }
            catch (err) {
                root.querySelector('#tournamentMessage').textContent = err.message;
            }
        };
    }
    catch (e) {
        root.innerHTML = `<div class="empty">${esc(e.message)}<p><a href="/">Вернуться на главную</a></p></div>`;
    }
})();
