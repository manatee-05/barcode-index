/* --------------------------------------------------------------------------
   AEROSCAN WEB APP LOGIC
   -------------------------------------------------------------------------- */

// Application State
let appState = {
    token: localStorage.getItem('aeroscan_token') || '',
    indexName: localStorage.getItem('aeroscan_index_name') || '',
    records: [],
    selectedBarcode: null,
    html5Qrcode: null
};

// DOM Elements
const authScreen = document.getElementById('auth-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const tabLogin = document.getElementById('tab-login');
const tabCreate = document.getElementById('tab-create');
const formLogin = document.getElementById('form-login');
const formCreate = document.getElementById('form-create');
const loginNameInput = document.getElementById('login-name');
const loginPasscodeInput = document.getElementById('login-passcode');
const loginSuggestions = document.getElementById('login-suggestions');
const createNameInput = document.getElementById('create-name');
const createPasscodeInput = document.getElementById('create-passcode');

const displayIndexName = document.getElementById('display-index-name');
const btnLogout = document.getElementById('btn-logout');
const btnScan = document.getElementById('btn-scan');
const recordSearch = document.getElementById('record-search');
const btnAddManual = document.getElementById('btn-add-manual');
const recordsList = document.getElementById('records-list');

const editorEmptyState = document.getElementById('editor-empty-state');
const recordEditorForm = document.getElementById('record-editor');
const editorTitleLabel = document.getElementById('editor-title-label');
const editorStatusBadge = document.getElementById('editor-status-badge');
const editorBarcode = document.getElementById('editor-barcode');
const editorTitle = document.getElementById('editor-title');
const editorNotes = document.getElementById('editor-notes');
const btnDeleteRecord = document.getElementById('btn-delete-record');
const btnCancelEdit = document.getElementById('btn-cancel-edit');

const scannerModal = document.getElementById('scanner-modal');
const btnCloseScanner = document.getElementById('btn-close-scanner');
const cameraSelect = document.getElementById('camera-select');

/* ==========================================================================
   TOAST SYSTEM
   ========================================================================== */
let toastTimeout = null;
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.remove('hidden');

    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.add('hidden');
    }, 3500);
}

/* ==========================================================================
   VIEW ROUTING
   ========================================================================== */
function updateView() {
    if (appState.token && appState.indexName) {
        authScreen.classList.add('hidden');
        dashboardScreen.classList.remove('hidden');
        displayIndexName.textContent = appState.indexName;
        loadRecords();
        resetEditor();
    } else {
        authScreen.classList.remove('hidden');
        dashboardScreen.classList.add('hidden');
        loginNameInput.value = '';
        loginPasscodeInput.value = '';
        createNameInput.value = '';
        createPasscodeInput.value = '';
    }
}

function login(token, indexName) {
    localStorage.setItem('aeroscan_token', token);
    localStorage.setItem('aeroscan_index_name', indexName);
    appState.token = token;
    appState.indexName = indexName;
    showToast(`Successfully unlocked index: ${indexName}`, 'success');
    updateView();
}

function logout() {
    localStorage.removeItem('aeroscan_token');
    localStorage.removeItem('aeroscan_index_name');
    appState.token = '';
    appState.indexName = '';
    appState.records = [];
    appState.selectedBarcode = null;
    showToast('Index locked. Session closed.', 'info');
    updateView();
}

function getAuthHeader() {
    return { 'Authorization': `Bearer ${appState.token}` };
}

/* ==========================================================================
   AUTH TABS & AUTOCOMPLETE
   ========================================================================== */
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

// Debounced Index Search
let searchTimeout = null;
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

// Close autocomplete when clicking outside
document.addEventListener('click', (e) => {
    if (e.target !== loginNameInput && e.target !== loginSuggestions) {
        loginSuggestions.classList.add('hidden');
    }
});

/* ==========================================================================
   AUTH FORMS SUBMIT HANDLERS
   ========================================================================== */
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
            showToast(data.error || 'Authentication failed', 'error');
        }
    } catch (err) {
        console.error('Login error:', err);
        showToast('Network error connecting to index backend.', 'error');
    }
});

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
        showToast('Network error creating index.', 'error');
    }
});

btnLogout.addEventListener('click', logout);

/* ==========================================================================
   RECORDS DIRECTORY (LEFT PANEL)
   ========================================================================== */
async function loadRecords(searchQuery = '') {
    try {
        const url = searchQuery 
            ? `/api/records?search=${encodeURIComponent(searchQuery)}`
            : '/api/records';
            
        const res = await fetch(url, {
            headers: getAuthHeader()
        });
        
        if (res.status === 401) {
            logout();
            return;
        }
        
        const data = await res.json();
        appState.records = data;
        renderRecordsList();
    } catch (err) {
        console.error('Failed to load records:', err);
        showToast('Error Loading index records.', 'error');
    }
}

function renderRecordsList() {
    recordsList.innerHTML = '';
    if (appState.records.length === 0) {
        recordsList.innerHTML = '<div class="list-empty">No matching records found.</div>';
        return;
    }

    appState.records.forEach(record => {
        const card = document.createElement('button');
        card.className = 'record-card';
        if (appState.selectedBarcode === record.barcode) {
            card.classList.add('active');
        }
        
        // Format preview text
        const notesPreview = record.notes 
            ? record.notes.substring(0, 50) + (record.notes.length > 50 ? '...' : '')
            : 'No notes added yet.';
            
        const updatedDate = new Date(record.updated_at).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        card.innerHTML = `
            <div class="record-card-header">
                <span class="record-card-title">${escapeHTML(record.title)}</span>
                <span class="record-card-barcode">${escapeHTML(record.barcode)}</span>
            </div>
            <div class="record-card-preview">${escapeHTML(notesPreview)}</div>
            <div class="record-card-date">Modified: ${updatedDate}</div>
        `;
        
        card.addEventListener('click', () => selectRecord(record));
        recordsList.appendChild(card);
    });
}

// Debounced record search
let recordSearchTimeout = null;
recordSearch.addEventListener('input', () => {
    clearTimeout(recordSearchTimeout);
    recordSearchTimeout = setTimeout(() => {
        loadRecords(recordSearch.value);
    }, 250);
});

/* ==========================================================================
   RECORD EDITOR / VIEWER (RIGHT PANEL)
   ========================================================================== */
function resetEditor() {
    appState.selectedBarcode = null;
    editorEmptyState.classList.remove('hidden');
    recordEditorForm.classList.add('hidden');
}

function selectRecord(record) {
    appState.selectedBarcode = record.barcode;
    
    // UI toggle
    editorEmptyState.classList.add('hidden');
    recordEditorForm.classList.remove('hidden');
    
    // Fill fields
    editorTitleLabel.textContent = 'Edit Record';
    editorStatusBadge.textContent = 'Saved';
    editorStatusBadge.className = 'badge saved';
    
    editorBarcode.value = record.barcode;
    editorBarcode.readOnly = true; // Barcodes are keys; must be deleted/re-created to alter key
    editorTitle.value = record.title;
    editorNotes.value = record.notes || '';
    
    btnDeleteRecord.classList.remove('hidden');
    
    // Refresh active state styling in list
    document.querySelectorAll('.record-card').forEach(card => {
        const bCode = card.querySelector('.record-card-barcode').textContent;
        if (bCode === record.barcode) {
            card.classList.add('active');
        } else {
            card.classList.remove('active');
        }
    });
}

function startNewRecord(prefilledBarcode = '') {
    appState.selectedBarcode = null;
    
    editorEmptyState.classList.add('hidden');
    recordEditorForm.classList.remove('hidden');
    
    editorTitleLabel.textContent = 'Create New Record';
    editorStatusBadge.textContent = 'Draft';
    editorStatusBadge.className = 'badge';
    
    editorBarcode.value = prefilledBarcode;
    editorBarcode.readOnly = false;
    editorTitle.value = '';
    editorNotes.value = '';
    
    btnDeleteRecord.classList.add('hidden');
    
    // Clear list selection
    document.querySelectorAll('.record-card').forEach(c => c.classList.remove('active'));
    
    if (prefilledBarcode) {
        editorTitle.focus();
    } else {
        editorBarcode.focus();
    }
}

// Track unsaved modifications
function markRecordEdited() {
    if (appState.selectedBarcode && editorStatusBadge.textContent === 'Saved') {
        editorStatusBadge.textContent = 'Edited';
        editorStatusBadge.className = 'badge edited';
    }
}
editorTitle.addEventListener('input', markRecordEdited);
editorNotes.addEventListener('input', markRecordEdited);

btnCancelEdit.addEventListener('click', resetEditor);

btnAddManual.addEventListener('click', () => startNewRecord(''));

// Save Record submission
recordEditorForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const barcode = editorBarcode.value.trim();
    const title = editorTitle.value.trim();
    const notes = editorNotes.value;

    try {
        const res = await fetch('/api/records', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeader()
            },
            body: JSON.stringify({ barcode, title, notes })
        });
        
        const data = await res.json();
        if (res.ok && data.success) {
            showToast('Record saved successfully.', 'success');
            await loadRecords(recordSearch.value);
            selectRecord(data.record);
        } else {
            showToast(data.error || 'Failed to save record', 'error');
        }
    } catch (err) {
        console.error('Saving record failed:', err);
        showToast('Network error saving record.', 'error');
    }
});

// Delete Record
btnDeleteRecord.addEventListener('click', async () => {
    if (!appState.selectedBarcode) return;
    
    const confirmDelete = confirm(`Are you sure you want to delete this record (${appState.selectedBarcode})?`);
    if (!confirmDelete) return;

    try {
        const res = await fetch(`/api/records/${encodeURIComponent(appState.selectedBarcode)}`, {
            method: 'DELETE',
            headers: getAuthHeader()
        });
        const data = await res.json();
        if (res.ok && data.success) {
            showToast('Record deleted.', 'success');
            resetEditor();
            loadRecords(recordSearch.value);
        } else {
            showToast(data.error || 'Failed to delete record', 'error');
        }
    } catch (err) {
        console.error('Deletion error:', err);
        showToast('Network error deleting record.', 'error');
    }
});

/* ==========================================================================
   CAMERA BARCODE/QR SCANNER INTEGRATION
   ========================================================================== */
btnScan.addEventListener('click', async () => {
    scannerModal.classList.remove('hidden');
    cameraSelect.innerHTML = '<option value="">Loading camera permissions...</option>';
    
    // Invalidate state & populate camera sources list
    try {
        const cameras = await Html5Qrcode.getCameras();
        cameraSelect.innerHTML = '';
        if (cameras && cameras.length > 0) {
            cameras.forEach((camera, index) => {
                const opt = document.createElement('option');
                opt.value = camera.id;
                // Prefer rear camera on smartphones
                if (camera.label.toLowerCase().includes('back') || camera.label.toLowerCase().includes('environment')) {
                    opt.selected = true;
                }
                opt.textContent = camera.label || `Camera ${index + 1}`;
                cameraSelect.appendChild(opt);
            });
            
            // Start the default/selected camera feed
            startScanner();
        } else {
            cameraSelect.innerHTML = '<option value="">No cameras detected</option>';
            showToast('No cameras found on this device.', 'error');
        }
    } catch (err) {
        console.error('Camera enumeration error:', err);
        cameraSelect.innerHTML = '<option value="">Camera access denied</option>';
        showToast('Please grant camera access permissions.', 'error');
    }
});

cameraSelect.addEventListener('change', () => {
    // Restart scan if option changes
    startScanner();
});

async function startScanner() {
    await stopScanner(); // clear current session
    
    const cameraId = cameraSelect.value;
    if (!cameraId) return;
    
    appState.html5Qrcode = new Html5Qrcode('scanner-viewfinder');
    try {
        await appState.html5Qrcode.start(
            cameraId,
            {
                fps: 10,
                qrbox: (w, h) => {
                    // Responsive sizing box
                    const size = Math.min(w, h) * 0.65;
                    return { width: size, height: size };
                }
            },
            async (decodedText) => {
                // Success Scan hook!
                playBeepSound();
                showToast(`Scanned Barcode: ${decodedText}`, 'success');
                
                await stopScanner();
                scannerModal.classList.add('hidden');
                
                await handleScannedCode(decodedText);
            },
            () => {
                // Ignore silent scan line checks
            }
        );
    } catch (err) {
        console.error('Failed to start scanner view:', err);
        showToast('Camera error: unable to spin up stream.', 'error');
    }
}

async function stopScanner() {
    if (appState.html5Qrcode) {
        try {
            if (appState.html5Qrcode.isScanning) {
                await appState.html5Qrcode.stop();
            }
        } catch (e) {
            console.error('Error stopping scanner:', e);
        }
        appState.html5Qrcode = null;
    }
}

btnCloseScanner.addEventListener('click', async () => {
    await stopScanner();
    scannerModal.classList.add('hidden');
});

// Handle click outside scanner modal card to close
scannerModal.addEventListener('click', async (e) => {
    if (e.target === scannerModal) {
        await stopScanner();
        scannerModal.classList.add('hidden');
    }
});

async function handleScannedCode(barcode) {
    try {
        const res = await fetch(`/api/records/${encodeURIComponent(barcode)}`, {
            headers: getAuthHeader()
        });
        if (res.status === 200) {
            const record = await res.json();
            selectRecord(record);
        } else if (res.status === 404) {
            showToast('Barcode not found. Adding new record entry.', 'info');
            startNewRecord(barcode);
        } else if (res.status === 401) {
            logout();
        } else {
            showToast('Error reading barcode registry.', 'error');
        }
    } catch (e) {
        console.error('Query scanned code failed:', e);
        showToast('Server connection lost.', 'error');
    }
}

/* ==========================================================================
   WEB AUDIO SOUND EFFECTS
   ========================================================================== */
function playBeepSound() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        
        const ctx = new AudioCtx();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(950, ctx.currentTime); // Pitch A5
        gainNode.gain.setValueAtTime(0.12, ctx.currentTime);
        
        oscillator.start();
        // Exponential decay
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        oscillator.stop(ctx.currentTime + 0.15);
    } catch (e) {
        console.warn('Web Audio beep unsupported or blocked:', e);
    }
}

/* ==========================================================================
   HELPERS
   ========================================================================== */
function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

// Initial Boot Run
updateView();
