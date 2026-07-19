/* --------------------------------------------------------------------------
   AEROSCAN - AUTH LOGIC
   -------------------------------------------------------------------------- */

let toastTimeout = null;
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.remove('hidden');

    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// Redirect if already logged in
function checkAuth() {
    const token = localStorage.getItem('aeroscan_token');
    const indexName = localStorage.getItem('aeroscan_index_name');
    if (token && indexName) {
        window.location.href = '/dashboard';
    }
}
checkAuth();

function login(token, indexName) {
    localStorage.setItem('aeroscan_token', token);
    localStorage.setItem('aeroscan_index_name', indexName);
    window.location.href = '/dashboard';
}

// DOM Elements
const tabLogin = document.getElementById('tab-login');
const tabCreate = document.getElementById('tab-create');
const formLogin = document.getElementById('form-login');
const formCreate = document.getElementById('form-create');
const loginNameInput = document.getElementById('login-name');
const loginPasscodeInput = document.getElementById('login-passcode');
const loginSuggestions = document.getElementById('login-suggestions');
const createNameInput = document.getElementById('create-name');
const createPasscodeInput = document.getElementById('create-passcode');

// Tabs
if (tabLogin && tabCreate) {
    tabLogin.addEventListener('click', () => {
        tabLogin.classList.add('active');
        tabCreate.classList.remove('active');
        formLogin.classList.remove('hidden');
        formCreate.classList.add('hidden');
    });

    tabCreate.addEventListener('click', () => {
        tabCreate.classList.add('active');
        tabLogin.classList.remove('active');
        formCreate.classList.remove('hidden');
        formLogin.classList.add('hidden');
    });
}

// Autocomplete
let searchTimeout = null;
if (loginNameInput) {
    loginNameInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        const query = loginNameInput.value.trim();
        if (query.length < 2) {
            loginSuggestions.innerHTML = '';
            loginSuggestions.classList.add('hidden');
            return;
        }

        searchTimeout = setTimeout(async () => {
            try {
                const res = await fetch(`/api/indexes/search?q=${encodeURIComponent(query)}`);
                const data = await res.json();
                if (data && data.length > 0) {
                    loginSuggestions.innerHTML = '';
                    data.forEach(item => {
                        const div = document.createElement('div');
                        div.className = 'suggestion-item';
                        div.textContent = item.name;
                        div.addEventListener('click', () => {
                            loginNameInput.value = item.name;
                            loginSuggestions.innerHTML = '';
                            loginSuggestions.classList.add('hidden');
                            loginPasscodeInput.focus();
                        });
                        loginSuggestions.appendChild(div);
                    });
                    loginSuggestions.classList.remove('hidden');
                } else {
                    loginSuggestions.innerHTML = '';
                    loginSuggestions.classList.add('hidden');
                }
            } catch (e) {
                console.error('Suggestions error:', e);
            }
        }, 200);
    });

    document.addEventListener('click', (e) => {
        if (e.target !== loginNameInput && e.target !== loginSuggestions) {
            loginSuggestions.classList.add('hidden');
        }
    });
}

// Login
if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = loginNameInput.value.trim();
        const passcode = loginPasscodeInput.value;

        try {
            const res = await fetch('/api/index/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, passcode })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                login(data.token, data.indexName);
            } else {
                showToast(data.error || 'Incorrect index name or passcode', 'error');
            }
        } catch (err) {
            console.error('Login error:', err);
            showToast('Connection failed.', 'error');
        }
    });
}

// Create
if (formCreate) {
    formCreate.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = createNameInput.value.trim();
        const passcode = createPasscodeInput.value;

        try {
            const res = await fetch('/api/index/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, passcode })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                login(data.token, data.indexName);
            } else {
                showToast(data.error || 'Failed to create index', 'error');
            }
        } catch (err) {
            console.error('Creation error:', err);
            showToast('Index database setup failed.', 'error');
        }
    });
}
