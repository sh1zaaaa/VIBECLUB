(async () => {
    const root = document.querySelector('#tournamentList');
    try {
        let user = null;
        try {
            user = await Vibe.me();
        }
        catch { /* Public tournament catalogue remains visible to guests. */ }
        if (user?.role === 'admin')
            document.querySelector('#adminNav')?.classList.remove('hidden');
        const { tournaments } = await Vibe.api('/api/tournaments/');
        root.innerHTML = tournaments.length ? tournaments.map(t => `
      <article class="panel event-card" id="tournament-${t.id}">
        <div>
          <div class="eyebrow">${Vibe.escape(t.game)} / VIBECLUB 1×1</div>
          <h2 style="margin:8px 0">${Vibe.escape(t.title)}</h2>
          <p>${Vibe.escape(t.description || 'Подробности уточняйте у администратора.')}</p>
          <p>СТАРТ: ${Vibe.date(t.starts_at)} · УЧАСТНИКИ: <span data-player-count>${t.registered}/${t.max_players}</span> · ФОРМАТ: ОДИН НА ОДИН</p>
          <span class="status">${Vibe.status(t.status)}</span>
        </div>
        <div>
          ${t.joined ? '<span class="status">ТЫ УЖЕ В СПИСКЕ</span>' : t.status === 'open' && t.registered < t.max_players
            ? (user ? `<button class="lime-btn" data-join="${t.id}">ЗАРЕГИСТРИРОВАТЬСЯ ↗</button>` : `<a class="lime-btn" href="/?auth=login&amp;next=%2Ftournaments.html">ВОЙТИ ДЛЯ РЕГИСТРАЦИИ ↗</a>`)
            : '<span class="muted small">Регистрация недоступна</span>'}
        </div>
      </article>`).join('') : '<div class="empty">Пока нет запланированных турниров. Загляни позже!</div>';
        function notify(message, isError = false) {
            const toast = document.createElement('div');
            toast.className = `tournament-toast${isError ? ' is-error' : ''}`;
            toast.setAttribute('role', isError ? 'alert' : 'status');
            const text = document.createElement('span');
            text.textContent = message;
            const close = document.createElement('button');
            close.type = 'button';
            close.textContent = '×';
            close.setAttribute('aria-label', 'Закрыть уведомление');
            close.onclick = () => toast.remove();
            toast.append(text, close);
            document.querySelector('.tournament-toast')?.remove();
            document.body.append(toast);
            setTimeout(() => toast.remove(), 5000);
        }

        root.querySelectorAll('[data-join]').forEach(button => button.addEventListener('click', () => {
            button.disabled = true;
            button.textContent = 'РЕГИСТРАЦИЯ…';
            const tournament = tournaments.find(t => String(t.id) === button.dataset.join);
            Vibe.api(`/api/tournaments/${button.dataset.join}/join`, { method: 'POST', body: '{}' })
                .then(result => {
                    notify(result.message);
                    const card = button.closest('.event-card');
                    const status = document.createElement('span');
                    status.className = 'status';
                    status.textContent = 'ТЫ УЖЕ В СПИСКЕ';
                    button.replaceWith(status);
                    Vibe.api('/api/tournaments/').then(({ tournaments: updated }) => {
                        const current = updated.find(t => t.id === tournament.id);
                        if (current) card.querySelector('[data-player-count]').textContent = `${current.registered}/${current.max_players}`;
                    }).catch(() => {});
                })
                .catch(error => {
                    notify(error.message, true);
                    button.disabled = false;
                    button.textContent = 'ЗАРЕГИСТРИРОВАТЬСЯ ↗';
                });
        }));
        const target = document.getElementById(location.hash.slice(1));
        if (target?.classList.contains('event-card')) target.scrollIntoView({ block: 'center' });
    }
    catch (error) {
        root.innerHTML = `<div class="empty">${Vibe.escape(error.message)}</div>`;
    }
})();
