/* --------------------------------------------------------------------------
   AEROSCAN WEB APP LOGIC - MOBILE & LIGHT MODE
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

// Slide-Up Bottom Sheet Elements
const editorSheet = document.getElementById('editor-sheet');
const editorSheetBackdrop = document.getElementById('editor-sheet-backdrop');
const btnCloseEditor = document.getElementById('btn-close-editor');
const recordEditorForm = document.getElementById('record-editor');
const editorTitleLabel = document.getElementById('editor-title-label');
const editorStatusBadge = document.getElementById('editor-status-badge');
const editorBarcode = document.getElementById('editor-barcode');
const editorTitle = document.getElementById('editor-title');
const editorNotes = document.getElementById('editor-notes');
const btnDeleteRecord = document.getElementById('btn-delete-record');
const btnCancelEdit = document.getElementById('btn-cancel-edit');

// Camera Scanner Elements
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
    }, 3000);
}

/* ==========================================================================
   VIEW ROUTING & ENFORCEMENT
   ========================================================================== */
function updateView() {
    if (appState.token && appState.indexName) {
        // Logged In: Show dashboard, load records, block access screen
        authScreen.classList.add('hidden');
        dashboardScreen.classList.remove('hidden');
        displayIndexName.textContent = appState.indexName;
        loadRecords();
        closeEditorSheet();
    } else {
        // Logged Out/No selection: Strict selection gate. Hide everything else
        authScreen.classList.remove('hidden');
        dashboardScreen.classList.add('hidden');
        closeEditorSheet();
        
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
    showToast(`Unlocked index: ${indexName}`, 'success');
    updateView();
}

function logout() {
    localStorage.removeItem('aeroscan_token');
    localStorage.removeItem('aeroscan_index_name');
    appState.token = '';
    appState.indexName = '';
    appState.records = [];
    appState.selectedBarcode = null;
    showToast('Index locked.', 'info');
    updateView();
}

function getAuthHeader() {
    return { 'Authorization': `Bearer ${appState.token}` };
}

/* ==========================================================================
   AUTH TABS & SUGGESTION POP-UPS
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

// Debounced Auto-complete
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

document.addEventListener('click', (e) => {
    if (e.target !== loginNameInput && e.target !== loginSuggestions) {
        loginSuggestions.classList.add('hidden');
    }
});

/* ==========================================================================
   AUTH FORMS ROUTING
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
            showToast(data.error || 'Incorrect index name or passcode', 'error');
        }
    } catch (err) {
        console.error('Login error:', err);
        showToast('Connection failed.', 'error');
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
        showToast('Index database setup failed.', 'error');
    }
});

btnLogout.addEventListener('click', logout);

/* ==========================================================================
   RECORDS LOADING & SEARCH
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
        showToast('Error loading record directory.', 'error');
    }
}

function renderRecordsList() {
    recordsList.innerHTML = '';
    if (appState.records.length === 0) {
        recordsList.innerHTML = '<div class="list-empty">No indexed records found.</div>';
        return;
    }

    appState.records.forEach(record => {
        const card = document.createElement('button');
        card.className = 'record-card';
        if (appState.selectedBarcode === record.barcode) {
            card.classList.add('active');
        }
        
        const notesPreview = record.notes 
            ? record.notes.substring(0, 75) + (record.notes.length > 75 ? '...' : '')
            : 'No description text.';

        card.innerHTML = `
            <div class="record-card-header">
                <span class="record-card-title">${escapeHTML(record.title)}</span>
                <span class="record-card-barcode">${escapeHTML(record.barcode)}</span>
            </div>
            <div class="record-card-preview">${escapeHTML(notesPreview)}</div>
        `;
        
        card.addEventListener('click', () => selectRecord(record));
        recordsList.appendChild(card);
    });
}

let recordSearchTimeout = null;
recordSearch.addEventListener('input', () => {
    clearTimeout(recordSearchTimeout);
    recordSearchTimeout = setTimeout(() => {
        loadRecords(recordSearch.value);
    }, 200);
});

/* ==========================================================================
   SLIDE-UP SHEET TRIGGERS
   ========================================================================== */
function openEditorSheet() {
    editorSheet.classList.remove('hidden');
    editorSheetBackdrop.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Stop background list scrolling
}

function closeEditorSheet() {
    editorSheet.classList.add('hidden');
    editorSheetBackdrop.classList.add('hidden');
    document.body.style.overflow = '';
    
    // Clear list selection visuals
    appState.selectedBarcode = null;
    document.querySelectorAll('.record-card').forEach(c => c.classList.remove('active'));
}

btnCloseEditor.addEventListener('click', closeEditorSheet);
btnCancelEdit.addEventListener('click', closeEditorSheet);
editorSheetBackdrop.addEventListener('click', closeEditorSheet);

function selectRecord(record) {
    appState.selectedBarcode = record.barcode;
    
    editorTitleLabel.textContent = 'Edit Record';
    editorStatusBadge.textContent = 'Saved';
    editorStatusBadge.className = 'badge saved';
    
    editorBarcode.value = record.barcode;
    editorBarcode.readOnly = true; // Unique key is read-only
    editorTitle.value = record.title;
    editorNotes.value = record.notes || '';
    
    btnDeleteRecord.classList.remove('hidden');
    openEditorSheet();

    // Highlight selected list card
    document.querySelectorAll('.record-card').forEach(card => {
        const barcodeText = card.querySelector('.record-card-barcode').textContent;
        if (barcodeText === record.barcode) {
            card.classList.add('active');
        } else {
            card.classList.remove('active');
        }
    });
}

function startNewRecord(prefilledBarcode = '') {
    appState.selectedBarcode = null;
    
    editorTitleLabel.textContent = 'Create Record';
    editorStatusBadge.textContent = 'Draft';
    editorStatusBadge.className = 'badge';
    
    editorBarcode.value = prefilledBarcode;
    editorBarcode.readOnly = false;
    editorTitle.value = '';
    editorNotes.value = '';
    
    btnDeleteRecord.classList.add('hidden');
    openEditorSheet();
    
    // Clear list selection highlights
    document.querySelectorAll('.record-card').forEach(c => c.classList.remove('active'));
    
    // Focus appropriate input field
    setTimeout(() => {
        if (prefilledBarcode) {
            editorTitle.focus();
        } else {
            editorBarcode.focus();
        }
    }, 300);
}

function markRecordEdited() {
    if (appState.selectedBarcode && editorStatusBadge.textContent === 'Saved') {
        editorStatusBadge.textContent = 'Edited';
        editorStatusBadge.className = 'badge edited';
    }
}
editorTitle.addEventListener('input', markRecordEdited);
editorNotes.addEventListener('input', markRecordEdited);

btnAddManual.addEventListener('click', () => startNewRecord(''));

// Save Record handler
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
            showToast('Record saved.', 'success');
            await loadRecords(recordSearch.value);
            closeEditorSheet();
        } else {
            showToast(data.error || 'Failed to save record', 'error');
        }
    } catch (err) {
        console.error('Save failed:', err);
        showToast('Network error.', 'error');
    }
});

// Delete Record handler
btnDeleteRecord.addEventListener('click', async () => {
    if (!appState.selectedBarcode) return;
    
    const confirmDelete = confirm(`Delete this record (${appState.selectedBarcode})?`);
    if (!confirmDelete) return;

    try {
        const res = await fetch(`/api/records/${encodeURIComponent(appState.selectedBarcode)}`, {
            method: 'DELETE',
            headers: getAuthHeader()
        });
        const data = await res.json();
        if (res.ok && data.success) {
            showToast('Record deleted.', 'success');
            closeEditorSheet();
            loadRecords(recordSearch.value);
        } else {
            showToast(data.error || 'Failed to delete record', 'error');
        }
    } catch (err) {
        console.error('Delete error:', err);
        showToast('Network error.', 'error');
    }
});

/* ==========================================================================
   CAMERA BARCODE SCANNING
   ========================================================================== */
btnScan.addEventListener('click', async () => {
    scannerModal.classList.remove('hidden');
    cameraSelect.innerHTML = '<option value="">Checking camera...</option>';
    
    try {
        const cameras = await Html5Qrcode.getCameras();
        cameraSelect.innerHTML = '';
        if (cameras && cameras.length > 0) {
            cameras.forEach((camera, index) => {
                const opt = document.createElement('option');
                opt.value = camera.id;
                // Auto-select rear camera
                if (camera.label.toLowerCase().includes('back') || camera.label.toLowerCase().includes('environment')) {
                    opt.selected = true;
                }
                opt.textContent = camera.label || `Camera ${index + 1}`;
                cameraSelect.appendChild(opt);
            });
            startScanner();
        } else {
            cameraSelect.innerHTML = '<option value="">No cameras detected</option>';
            showToast('No cameras found.', 'error');
        }
    } catch (err) {
        console.error('Camera query error:', err);
        cameraSelect.innerHTML = '<option value="">Access denied</option>';
        showToast('Enable camera permissions to scan.', 'error');
    }
});

cameraSelect.addEventListener('change', startScanner);

async function startScanner() {
    await stopScanner();
    const cameraId = cameraSelect.value;
    if (!cameraId) return;
    
    // Narrow down scanning formats to common ones (avoids wasting CPU on exotic formats)
    let formats = [];
    if (typeof Html5QrcodeSupportedFormats !== 'undefined') {
        formats = [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_93,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.ITF
        ];
    }

    appState.html5Qrcode = new Html5Qrcode('scanner-viewfinder');
    try {
        await appState.html5Qrcode.start(
            cameraId,
            {
                fps: 24, // Increase scan rate (frames per second) for faster reaction
                qrbox: (w, h) => {
                    // Optimized landscape rectangle for long/thin barcodes
                    const width = Math.min(w * 0.85, 300);
                    const height = Math.min(h * 0.45, 140);
                    return { width: width, height: height };
                },
                // Request HD camera stream to ensure thin barcode lines are clear
                videoConstraints: {
                    deviceId: { exact: cameraId },
                    width: { min: 640, ideal: 1280 },
                    height: { min: 480, ideal: 720 }
                },
                formatsToSupport: formats
            },
            async (decodedText) => {
                playBeep();
                showToast(`Scanned Code: ${decodedText}`, 'success');
                
                await stopScanner();
                scannerModal.classList.add('hidden');
                await handleScannedCode(decodedText);
            },
            () => { /* Silent error checks */ }
        );
    } catch (err) {
        console.error('Scanner start failed:', err);
        showToast('Unable to open camera stream. Try selecting another camera.', 'error');
    }
}

async function stopScanner() {
    if (appState.html5Qrcode) {
        try {
            if (appState.html5Qrcode.isScanning) {
                await appState.html5Qrcode.stop();
            }
        } catch (e) {
            console.error('Scanner stop error:', e);
        }
        appState.html5Qrcode = null;
    }
}

btnCloseScanner.addEventListener('click', async () => {
    await stopScanner();
    scannerModal.classList.add('hidden');
});

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
            showToast('Code not found. Creating entry.', 'info');
            startNewRecord(barcode);
        } else if (res.status === 401) {
            logout();
        } else {
            showToast('Error looking up scanned barcode.', 'error');
        }
    } catch (e) {
        console.error('Lookup failed:', e);
        showToast('Connection error.', 'error');
    }
}

/* ==========================================================================
   WEB AUDIO BEEP SYNTHESIS
   ========================================================================== */
function playBeep() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        
        const ctx = new AudioCtx();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(1000, ctx.currentTime); // Pitch C6
        gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
        
        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        oscillator.stop(ctx.currentTime + 0.12);
    } catch (e) {
        console.warn('AudioContext blocked:', e);
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

// Boot Initialization
updateView();
