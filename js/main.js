const menuToggle = document.querySelector('.menu-toggle');
const mainNav = document.querySelector('.main-nav');
menuToggle?.addEventListener('click', () => {
    const isOpen = mainNav.classList.toggle('is-open');
    menuToggle.setAttribute('aria-expanded', String(isOpen));
    menuToggle.setAttribute('aria-label', isOpen ? 'Закрыть меню' : 'Открыть меню');
});
mainNav?.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
        mainNav.classList.remove('is-open');
        menuToggle?.setAttribute('aria-expanded', 'false');
    });
});
const dialog = document.querySelector('#bookingDialog');
document.querySelectorAll('.js-book').forEach(button => {
    button.addEventListener('click', () => {
        if (typeof dialog.showModal === 'function')
            dialog.showModal();
    });
});
document.querySelector('.auth-close')?.addEventListener('click', () => document.querySelector('#authDialog')?.close());
dialog?.addEventListener('click', event => {
    if (event.target === dialog)
        dialog.close();
});
const periodTabs = document.querySelectorAll('.price-tab');
const prices = document.querySelectorAll('.price-value');
periodTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const period = tab.dataset.period;
        periodTabs.forEach(item => {
            const active = item === tab;
            item.classList.toggle('is-active', active);
            item.setAttribute('aria-selected', String(active));
        });
        prices.forEach(price => {
            price.innerHTML = `${price.dataset[period]} <small>₽</small>`;
        });
    });
});
document.querySelector('#bookingForm')?.addEventListener('submit', event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get('name')).trim();
    const zone = data.get('zone');
    const message = document.querySelector('.form-message');
    message.textContent = `Спасибо, ${name}! Заявка на зону ${zone} подготовлена. Backend подключим на следующем этапе.`;
    form.reset();
});
document.querySelector('#year').textContent = new Date().getFullYear();
// Subtle pointer glow on devices that support a fine pointer.
const glow = document.querySelector('.cursor-glow');
if (window.matchMedia('(pointer:fine)').matches) {
    window.addEventListener('pointermove', event => {
        glow.style.left = `${event.clientX}px`;
        glow.style.top = `${event.clientY}px`;
    }, { passive: true });
}
else {
    glow.remove();
}
// Reveal content gently as sections enter the viewport.
const revealTargets = document.querySelectorAll('.zone-card,.price-card,.event-row,.spec-item');
if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12 });
    revealTargets.forEach(target => {
        target.classList.add('will-reveal');
        observer.observe(target);
    });
}
// Protected homepage actions: guests authenticate first, members continue to the requested page.
(async () => {
    const authDialog = document.querySelector('#authDialog');
    const gates = [...document.querySelectorAll('.js-auth-gate')];
    if (!gates.length)
        return;
    gates.forEach(button => button.addEventListener('click', async (event) => {
        event.preventDefault();
        const next = button.dataset.next || '/booking.html';
        const params = new URLSearchParams();
        if (button.dataset.zone)
            params.set('zone', button.dataset.zone);
        if (button.dataset.hours)
            params.set('hours', button.dataset.hours);
        const target = next + (params.size ? `?${params.toString()}` : '');
        let signedIn = false;
        try {
            signedIn = (await fetch('/api/auth/me', { credentials: 'same-origin' })).ok;
        }
        catch {
            signedIn = false;
        }
        if (signedIn) {
            location.assign(target);
            return;
        }
        sessionStorage.setItem('vibeclub_after_auth', target);
        if (authDialog?.showModal)
            authDialog.showModal();
        document.querySelector('[data-auth-mode="login"]')?.click();
    }));
})();
