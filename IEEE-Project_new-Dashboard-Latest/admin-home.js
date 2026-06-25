const ADMIN_SESSION_KEY = 'adminSession';

function readAdminSessionRaw() {
    const sessionValue = sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (sessionValue) return sessionValue;

    const legacyValue = localStorage.getItem(ADMIN_SESSION_KEY);
    if (legacyValue) {
        localStorage.removeItem(ADMIN_SESSION_KEY);
    }
    return null;
}

function clearAdminSession() {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    localStorage.removeItem(ADMIN_SESSION_KEY);
}

(function initAdminHome() {
    const session = getAdminSession();
    if (!session || !session.user) {
        window.location.href = 'index.html';
        return;
    }

    const identityEl = document.getElementById('adminIdentity');
    if (identityEl) {
        const name = session.user.fullName || session.user.username || 'Admin';
        identityEl.textContent = name;
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            clearAdminSession();
            window.location.href = 'index.html';
        });
    }

    document.querySelectorAll('.action-card').forEach((button) => {
        button.addEventListener('click', () => {
            const target = button.getAttribute('data-target');
            navigateToModule(target);
        });
    });
})();

function getAdminSession() {
    try {
        const raw = readAdminSessionRaw();
        if (!raw) return null;

        const session = JSON.parse(raw);
        if (session && session.expiresAt && new Date(session.expiresAt) <= new Date()) {
            clearAdminSession();
            return null;
        }

        return session;
    } catch (_error) {
        clearAdminSession();
        return null;
    }
}

function navigateToModule(target) {
    switch (target) {
        case 'authors':
            window.location.href = 'dashboard.html#dashboard';
            break;
        case 'reviewers':
            window.location.href = 'dashboard.html#projects';
            break;
        case 'vault':
            window.location.href = 'dashboard.html#documents';
            break;
        default:
            window.location.href = 'dashboard.html';
            break;
    }
}
