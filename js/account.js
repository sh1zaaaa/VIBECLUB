(async () => {
    const root = document.querySelector('#accountContent');
    try {
        const user = await Vibe.me();
        if (user.role === 'admin')
            document.querySelector('#adminNav').classList.remove('hidden');
        const [{ bookings }, { tournaments }] = await Promise.all([Vibe.api('/api/bookings/mine'), Vibe.api('/api/tournaments/')]);
        const myTournaments = tournaments.filter(t => t.joined);
        const active = bookings.filter(b => ['pending', 'confirmed'].includes(b.status));
        root.innerHTML = `<div class="stat-row">
<div class="stat"><strong>${active.length}</strong><span>АКТИВНЫЕ БРОНИ</span></div>
<div class="stat"><strong>${bookings.length}</strong><span>ВСЕГО БРОНЕЙ</span></div>
<div class="stat"><strong>${Vibe.escape(user.role.toUpperCase())}</strong><span>ТИП АККАУНТА</span></div></div>
<div class="grid">
<section class="panel">
<h2>PLAYER CARD</h2>
<h3>${Vibe.escape(user.name)}</h3>
<p class="muted">${Vibe.escape(user.email)}</p>
<p class="muted">${Vibe.escape(user.phone || 'Телефон не указан')}</p>
<p class="small muted">В клубе с ${new Date(user.createdAt).toLocaleDateString('ru-RU')}</p>
<div class="inline-actions"><a class="lime-btn" href="/booking.html">ЗАБРОНИРОВАТЬ МЕСТО</a>
<button class="ghost-btn" id="logout">ВЫЙТИ</button>
<button class="danger-btn" id="deleteAccount">УДАЛИТЬ АККАУНТ</button></div></section>
<section class="panel">
<h2>QUICK LINKS</h2>
<p><a href="/tournaments.html">↗ Турниры и регистрация</a></p>
<p><a href="/booking.html">↗ Выбрать игровое место</a></p>${user.role === 'admin' ? '<p><a href="/admin.html">↗ Админ-панель</a></p>' : ''}</section></div>
<section class="panel tournament-section">
<h2>MY TOURNAMENTS</h2>
<div class="tournament-list">${myTournaments.length ? myTournaments.map(t => `
    <article class="my-tournament">
        <div class="tournament-details">
            <h3>${Vibe.escape(t.title)}</h3>
            <p class="muted small">${Vibe.escape(t.game)} · ${Vibe.date(t.starts_at)} · ${t.registered}/${t.max_players} игроков</p>
        </div>
        <a class="lime-btn" href="/tournaments.html#tournament-${t.id}">ОТКРЫТЬ ТУРНИР ↗</a>
    </article>`).join('') : '<p class="muted">Ты пока не зарегистрирован ни на один турнир.</p>'}</div>
</section>
<section class="panel" style="margin-top:18px">
<h2>MY HISTORY</h2>
<div class="table-scroll">${bookings.length ? `<table class="data-table">
<thead>
<tr>
<th>№</th>
<th>ЗОНА / МЕСТО</th>
<th>НАЧАЛО</th>
<th>ОКОНЧАНИЕ</th>
<th>СТОИМОСТЬ</th>
<th>СТАТУС</th>
<th></th></tr></thead>
<tbody>${bookings.map(b => `<tr>
<td>#${b.id}</td>
<td>${Vibe.escape(b.zone_name)} / ${Vibe.escape(b.computer_name)}</td>
<td>${Vibe.date(b.starts_at)}</td>
<td>${Vibe.date(b.ends_at)}</td>
<td>${Vibe.money(b.total_price)}</td>
<td><span class="status ${b.status}">${Vibe.status(b.status)}</span></td>
<td>${b.status === 'pending' ? `<button class="danger-btn" data-cancel="${b.id}">Отменить</button>` : ''}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Пока нет бронирований. Выбери место и запланируй следующую игру!</div>'}</div></section>`;
        document.querySelector('#logout').onclick = async () => {
            await Vibe.api('/api/auth/logout', { method: 'POST' });
            location.href = '/';
        };
        const dialog = document.createElement('dialog');
        dialog.className = 'delete-dialog';
        dialog.innerHTML = `<form>
            <h2>Удаление аккаунта</h2>
            <p>Все брони и регистрации в турнирах будут удалены без возможности восстановления.</p>
            <div class="field">
                <label for="deletePassword">Подтвердите пароль</label>
                <input id="deletePassword" type="password" autocomplete="current-password" required>
            </div>
            <p class="muted" role="alert"></p>
            <div class="inline-actions">
                <button type="submit" class="danger-btn">Удалить навсегда</button>
                <button type="button" class="ghost-btn" data-close>Отмена</button>
            </div>
        </form>`;
        document.body.append(dialog);
        const form = dialog.querySelector('form');
        const password = dialog.querySelector('input');
        const error = dialog.querySelector('[role="alert"]');
        const deleteButton = dialog.querySelector('[type="submit"]');
        root.querySelector('#deleteAccount').onclick = () => { form.reset(); error.textContent = ''; dialog.showModal(); };
        dialog.querySelector('[data-close]').onclick = () => dialog.close();
        dialog.addEventListener('close', () => form.reset());
        form.onsubmit = async event => {
            event.preventDefault();
            deleteButton.disabled = true;
            try {
                await Vibe.api('/api/auth/me', {method:'DELETE',body:JSON.stringify({password:password.value})});
                location.href = '/';
            } catch(e) { error.textContent = e.message; }
            finally { deleteButton.disabled = false; }
        };
        root.querySelectorAll('[data-cancel]').forEach(b => b.onclick = async () => {
            if (!confirm('Отменить заявку на бронь?'))
                return;
            try {
                await Vibe.api(`/api/bookings/${b.dataset.cancel}/cancel`, { method: 'PATCH' });
                location.reload();
            }
            catch (e) {
                alert(e.message);
            }
        });
    }
    catch (e) {
        root.innerHTML = `<div class="empty">${Vibe.escape(e.message)}<p>Чтобы открыть личный кабинет, сначала войди или зарегистрируйся.</p>
<p><a class="lime-btn" href="/?auth=login">ВОЙТИ</a> <a class="lime-btn" href="/?auth=register">РЕГИСТРАЦИЯ</a></p></div>`;
    }
})();
