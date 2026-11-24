(() => {
    const dialog = document.querySelector('#authDialog');
    const form = document.querySelector('#authForm');
    const message = document.querySelector('#authMessage');
    const tabs = [...document.querySelectorAll('.auth-tab')];
    const nameLabel = document.querySelector('#authNameLabel');
    const phoneLabel = document.querySelector('#authPhoneLabel');
    const submit = document.querySelector('#authSubmit');
    const profile = document.querySelector('#authProfile');
    const headerLogin = document.querySelector('.auth-open');
    let mode = 'login';
    let currentUser = null;
    function setMessage(text = '', isError = false) {
        message.textContent = text;
        message.classList.toggle('is-error', isError);
    }
    function setMode(nextMode) {
        mode = nextMode;
        tabs.forEach(tab => {
            const active = tab.dataset.authMode === mode;
            tab.classList.toggle('is-active', active);
            tab.setAttribute('aria-selected', String(active));
        });
        nameLabel.hidden = mode !== 'register';
        phoneLabel.hidden = mode !== 'register';
        nameLabel.querySelector('input').required = mode === 'register';
        submit.innerHTML = mode === 'login' ? 'ВОЙТИ В АККАУНТ <span>↗</span>' : 'СОЗДАТЬ АККАУНТ <span>↗</span>';
        form.querySelector('[name="password"]').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
        setMessage();
    }
    function renderUser(user) {
        currentUser = user;
        if (user) {
            form.hidden = true;
            document.querySelector('.auth-tabs').hidden = true;
            profile.hidden = false;
            document.querySelector('#profileName').textContent = user.name;
            document.querySelector('#profileEmail').textContent = user.email;
            document.querySelector('#profileRole').textContent = user.role;
            headerLogin.innerHTML = 'Личный кабинет <span>↗</span>';
        }
        else {
            form.hidden = false;
            document.querySelector('.auth-tabs').hidden = false;
            profile.hidden = true;
            headerLogin.innerHTML = 'Личный кабинет <span>↗</span>';
        }
    }
    async function api(path, options = {}) {
        const response = await fetch(`/api${path}`, {
            ...options,
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok)
            throw new Error(payload.message || 'Не удалось выполнить запрос.');
        return payload;
    }
    async function refreshSession() {
        try {
            const result = await api('/auth/me');
            renderUser(result.user);
        }
        catch {
            renderUser(null);
        }
    }
    headerLogin?.addEventListener('click', async () => {
        await refreshSession();
        if (currentUser) {
            location.assign('/account.html');
            return;
        }
        if (typeof dialog.showModal === 'function')
            dialog.showModal();
        setMode('login');
        setMessage();
    });
    document.querySelector('.auth-close')?.addEventListener('click', () => dialog.close());
    dialog?.addEventListener('click', event => {
        if (event.target === dialog)
            dialog.close();
    });
    tabs.forEach(tab => tab.addEventListener('click', () => setMode(tab.dataset.authMode)));
    form?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const data = new FormData(form);
        const body = Object.fromEntries(data.entries());
        submit.disabled = true;
        submit.textContent = 'ПОДОЖДИ...';
        setMessage();
        try {
            const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
            const result = await api(endpoint, { method: 'POST', body: JSON.stringify(body) });
            renderUser(result.user);
            form.reset();
            const pending = sessionStorage.getItem('vibeclub_after_auth');
            if (pending && pending.startsWith('/') && !pending.startsWith('//')) {
                sessionStorage.removeItem('vibeclub_after_auth');
                location.assign(pending);
                return;
            }
            setMessage(result.message || 'Готово!');
        }
        catch (error) {
            setMessage(error.message, true);
        }
        finally {
            submit.disabled = false;
            submit.innerHTML = mode === 'login' ? 'ВОЙТИ В АККАУНТ <span>↗</span>' : 'СОЗДАТЬ АККАУНТ <span>↗</span>';
        }
    });
    document.querySelector('#logoutButton')?.addEventListener('click', async () => {
        try {
            const result = await api('/auth/logout', { method: 'POST', body: '{}' });
            renderUser(null);
            setMode('login');
            setMessage(result.message);
        }
        catch (error) {
            setMessage(error.message, true);
        }
    });
    refreshSession();
    // Inner pages send guests here with ?auth=login or ?auth=register.
    const authParams = new URLSearchParams(window.location.search);
    const requestedMode = authParams.get('auth');
    const requestedNext = authParams.get('next');
    if (requestedNext && requestedNext.startsWith('/') && !requestedNext.startsWith('//')) {
        sessionStorage.setItem('vibeclub_after_auth', requestedNext);
    }
    if (requestedMode === 'login' || requestedMode === 'register') {
        if (typeof dialog.showModal === 'function')
            dialog.showModal();
        setMode(requestedMode);
        history.replaceState({}, '', window.location.pathname);
    }
})();
