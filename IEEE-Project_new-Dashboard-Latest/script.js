const STORAGE_KEYS = {
    adminSession: 'adminSession',
    authorSession: 'ieee_session',
    rememberedIdentity: 'remembered_identity'
};

function readSessionValue(key) {
    const sessionValue = sessionStorage.getItem(key);
    if (sessionValue) return sessionValue;

    // Remove legacy persistent sessions so browser close always logs users out.
    const legacyValue = localStorage.getItem(key);
    if (legacyValue) {
        localStorage.removeItem(key);
    }
    return null;
}

function writeSessionValue(key, value) {
    sessionStorage.setItem(key, value);
    localStorage.removeItem(key);
}

function removeSessionValue(key) {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    const identityInput = document.getElementById('loginIdentity');
    const passwordInput = document.getElementById('loginPassword');
    const rememberToggle = document.getElementById('rememberIdentity');
    const submitBtn = document.getElementById('submitBtn');
    const togglePasswordBtn = document.getElementById('togglePassword');
    const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
    const formMessage = document.getElementById('formMessage');

    redirectIfAuthenticated();
    hydrateRememberedIdentity();

    togglePasswordBtn.addEventListener('click', () => {
        const showing = passwordInput.type === 'text';
        passwordInput.type = showing ? 'password' : 'text';
        const icon = togglePasswordBtn.querySelector('i');
        icon.classList.toggle('fa-eye', showing);
        icon.classList.toggle('fa-eye-slash', !showing);
    });

    forgotPasswordBtn.addEventListener('click', openForgotPasswordModal);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const identity = (identityInput.value || '').trim();
        const password = passwordInput.value || '';

        if (!identity || !password) {
            setMessage('Please enter both username/email and password.', 'error');
            return;
        }

        setSubmitting(true);
        setMessage('Authenticating...', '');

        try {
            const result = await authenticate(identity, password);
            if (!result.success) {
                setMessage(result.message || 'Invalid credentials.', 'error');
                passwordInput.value = '';
                return;
            }

            persistRememberedIdentity(identity);
            clearAllSessions();
            createSessionForUser(result.user);

            setMessage(`Welcome ${result.user.fullName}. Redirecting...`, 'success');

            window.setTimeout(() => {
                const destination = result.user.userType === 'author' ? 'author-dashboard.html' : 'admin-home.html';
                window.location.href = destination;
            }, 700);
        } catch (error) {
            setMessage('Unable to reach server. Please ensure backend is running.', 'error');
        } finally {
            setSubmitting(false);
        }
    });

    function setSubmitting(isSubmitting) {
        submitBtn.disabled = isSubmitting;
        submitBtn.querySelector('.btn-text').textContent = isSubmitting ? 'Signing In...' : 'Sign In';
    }

    function setMessage(message, type) {
        formMessage.textContent = message;
        formMessage.className = 'form-message';
        if (type) {
            formMessage.classList.add(type);
        }
    }

    function hydrateRememberedIdentity() {
        const remembered = localStorage.getItem(STORAGE_KEYS.rememberedIdentity) || '';
        if (remembered) {
            identityInput.value = remembered;
            if (rememberToggle) {
                rememberToggle.checked = true;
            }
            passwordInput.focus();
        } else {
            identityInput.focus();
        }
    }

    function persistRememberedIdentity(identity) {
        if (rememberToggle && rememberToggle.checked) {
            localStorage.setItem(STORAGE_KEYS.rememberedIdentity, identity);
        } else {
            localStorage.removeItem(STORAGE_KEYS.rememberedIdentity);
        }
    }

    function clearAllSessions() {
        removeSessionValue(STORAGE_KEYS.adminSession);
        removeSessionValue(STORAGE_KEYS.authorSession);
    }

    function redirectIfAuthenticated() {
        const adminSession = parseSession(STORAGE_KEYS.adminSession);
        if (adminSession && adminSession.user) {
            window.location.href = 'admin-home.html';
            return;
        }

        const authorSession = parseSession(STORAGE_KEYS.authorSession);
        if (authorSession && authorSession.user) {
            window.location.href = 'author-dashboard.html';
        }
    }
});

async function authenticate(identity, password) {
    const adminResult = await tryLogin('/login', identity, password);
    if (adminResult.success) {
        return adminResult;
    }

    const authorResult = await tryLogin('/author-login', identity, password);
    if (authorResult.success) {
        return authorResult;
    }

    return {
        success: false,
        message: authorResult.message || adminResult.message || 'Invalid credentials.'
    };
}

async function tryLogin(endpoint, username, password) {
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });

    let payload = {};
    try {
        payload = await response.json();
    } catch (_error) {
        payload = {};
    }

    if (!response.ok) {
        return {
            success: false,
            message: payload.message || 'Login failed.'
        };
    }

    return payload;
}

function createSessionForUser(user) {
    const now = Date.now();

    if (user.userType === 'author') {
        const authorSession = {
            user,
            loginTime: new Date(now).toISOString(),
            expiresAt: new Date(now + (24 * 60 * 60 * 1000)).toISOString()
        };
        writeSessionValue(STORAGE_KEYS.authorSession, JSON.stringify(authorSession));
        return;
    }

    const adminSession = {
        user,
        loginTime: new Date(now).toISOString(),
        expiresAt: new Date(now + (24 * 60 * 60 * 1000)).toISOString()
    };
    writeSessionValue(STORAGE_KEYS.adminSession, JSON.stringify(adminSession));
}

function parseSession(storageKey) {
    try {
        const raw = readSessionValue(storageKey);
        if (!raw) return null;

        const parsed = JSON.parse(raw);
        if (!parsed || !parsed.expiresAt) return parsed;

        if (new Date(parsed.expiresAt) <= new Date()) {
            removeSessionValue(storageKey);
            return null;
        }

        return parsed;
    } catch (_error) {
        removeSessionValue(storageKey);
        return null;
    }
}

function openForgotPasswordModal() {
    const existingModal = document.getElementById('forgotPasswordModal');
    if (existingModal) {
        existingModal.remove();
    }

    const markup = `
        <div id="forgotPasswordModal" class="modal">
            <div class="modal-card">
                <h3>Author Password Reset</h3>
                <p>Enter your registered author email address to receive a secure reset link.</p>
                <input id="forgotEmail" type="email" placeholder="author@email.com" autocomplete="email" />
                <div class="modal-actions">
                    <button id="forgotCancel" class="modal-cancel" type="button">Cancel</button>
                    <button id="forgotSubmit" class="modal-submit" type="button">Send Link</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', markup);

    const modal = document.getElementById('forgotPasswordModal');
    const emailInput = document.getElementById('forgotEmail');
    const cancelBtn = document.getElementById('forgotCancel');
    const submitBtn = document.getElementById('forgotSubmit');

    cancelBtn.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.remove();
        }
    });

    submitBtn.addEventListener('click', async () => {
        const email = (emailInput.value || '').trim();
        if (!email) {
            emailInput.focus();
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';

        try {
            const response = await fetch('/authors/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const payload = await response.json();
            if (!response.ok || !payload.success) {
                throw new Error(payload.message || 'Reset request failed.');
            }

            modal.remove();
            showTransientMessage('If the account exists, a reset link has been sent.', 'success');
        } catch (error) {
            showTransientMessage(error.message || 'Unable to send reset link.', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Send Link';
        }
    });
}

function showTransientMessage(text, type) {
    const previous = document.getElementById('pageToast');
    if (previous) {
        previous.remove();
    }

    const toast = document.createElement('div');
    toast.id = 'pageToast';
    toast.textContent = text;
    toast.style.position = 'fixed';
    toast.style.right = '16px';
    toast.style.bottom = '16px';
    toast.style.zIndex = '1200';
    toast.style.padding = '10px 12px';
    toast.style.borderRadius = '10px';
    toast.style.color = '#fff';
    toast.style.background = type === 'success' ? '#0f766e' : '#b91c1c';
    toast.style.boxShadow = '0 10px 20px rgba(24,32,40,0.22)';

    document.body.appendChild(toast);
    window.setTimeout(() => {
        toast.remove();
    }, 2800);
}
