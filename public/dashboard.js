/* --------------------------------------------------------------------------
   AEROSCAN - DASHBOARD LOGIC
   -------------------------------------------------------------------------- */

let appState = {
    token: localStorage.getItem('aeroscan_token') || '',
    indexName: localStorage.getItem('aeroscan_index_name') || '',
    records: [],
    selectedBarcode: null,
    html5Qrcode: null
};

// Redirect if not logged in
if (!appState.token || !appState.indexName) {
    window.location.href = '/';
}

function getAuthHeader() {
    return { 'Authorization': `Bearer ${appState.token}` };
}

function logout() {
    localStorage.removeItem('aeroscan_token');
    localStorage.removeItem('aeroscan_index_name');
    window.location.href = '/';
}

// Toast
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

// DOM Elements
const displayIndexName = document.getElementById('display-index-name');
const btnLogout = document.getElementById('btn-logout');
const recordSearch = document.getElementById('record-search');
const recordsList = document.getElementById('records-list');
const btnAddManual = document.getElementById('btn-add-manual');
const btnScan = document.getElementById('btn-scan');

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

const scannerModal = document.getElementById('scanner-modal');
const btnCloseScanner = document.getElementById('btn-close-scanner');
const cameraSelect = document.getElementById('camera-select');

if (displayIndexName) displayIndexName.textContent = appState.indexName;
if (btnLogout) btnLogout.addEventListener('click', logout);

// Records Loading
async function loadRecords(searchQuery = '') {
    try {
        const url = searchQuery 
            ? `/api/records?search=${encodeURIComponent(searchQuery)}`
            : '/api/records';
            
        const res = await fetch(url, { headers: getAuthHeader() });
        
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
        recordsList.innerHTML = `
            <div class="list-empty">
                <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="color:var(--border-hover)"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
                <p>No records found.<br>Scan or add a new record to begin.</p>
            </div>`;
        return;
    }

    appState.records.forEach(record => {
        const card = document.createElement('button');
        card.className = 'record-card';
        if (appState.selectedBarcode === record.barcode) {
            card.style.borderColor = 'var(--text-main)';
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
if (recordSearch) {
    recordSearch.addEventListener('input', () => {
        clearTimeout(recordSearchTimeout);
        recordSearchTimeout = setTimeout(() => {
            loadRecords(recordSearch.value);
        }, 200);
    });
}

// Editor Sheet
function openEditorSheet() {
    editorSheet.classList.remove('hidden');
    editorSheetBackdrop.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeEditorSheet() {
    editorSheet.classList.add('hidden');
    editorSheetBackdrop.classList.add('hidden');
    document.body.style.overflow = '';
    appState.selectedBarcode = null;
    loadRecords(recordSearch ? recordSearch.value : ''); // re-render to clear highlights
}

if (btnCloseEditor) btnCloseEditor.addEventListener('click', closeEditorSheet);
if (btnCancelEdit) btnCancelEdit.addEventListener('click', closeEditorSheet);
if (editorSheetBackdrop) editorSheetBackdrop.addEventListener('click', closeEditorSheet);

function selectRecord(record) {
    appState.selectedBarcode = record.barcode;
    editorTitleLabel.textContent = 'Edit Record';
    editorStatusBadge.textContent = 'Saved';
    editorStatusBadge.className = 'badge saved';
    
    editorBarcode.value = record.barcode;
    editorBarcode.readOnly = true;
    editorTitle.value = record.title;
    editorNotes.value = record.notes || '';
    
    btnDeleteRecord.classList.remove('hidden');
    openEditorSheet();
    renderRecordsList(); // Re-render to show active state
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
    renderRecordsList();
    
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
if (editorTitle) editorTitle.addEventListener('input', markRecordEdited);
if (editorNotes) editorNotes.addEventListener('input', markRecordEdited);

if (btnAddManual) btnAddManual.addEventListener('click', () => startNewRecord(''));

if (recordEditorForm) {
    recordEditorForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const barcode = editorBarcode.value.trim();
        const title = editorTitle.value.trim();
        const notes = editorNotes.value;

        try {
            const res = await fetch('/api/records', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
                body: JSON.stringify({ barcode, title, notes })
            });
            
            const data = await res.json();
            if (res.ok && data.success) {
                showToast('Record saved.', 'success');
                closeEditorSheet();
            } else {
                showToast(data.error || 'Failed to save record', 'error');
            }
        } catch (err) {
            console.error('Save failed:', err);
            showToast('Network error.', 'error');
        }
    });
}

if (btnDeleteRecord) {
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
            } else {
                showToast(data.error || 'Failed to delete record', 'error');
            }
        } catch (err) {
            console.error('Delete error:', err);
            showToast('Network error.', 'error');
        }
    });
}

// Scanner
if (btnScan) {
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
}

if (cameraSelect) cameraSelect.addEventListener('change', startScanner);

async function startScanner() {
    await stopScanner();
    const cameraId = cameraSelect.value;
    if (!cameraId) return;

    appState.html5Qrcode = new Html5Qrcode('scanner-viewfinder');
    try {
        await appState.html5Qrcode.start(
            cameraId,
            {
                fps: 10, // Lower FPS for better stability and decoding time on mobile
                // Removed qrbox constraint. Full-frame scanning drastically improves read rates.
            },
            async (decodedText) => {
                playBeep();
                showToast(`Scanned Code: ${decodedText}`, 'success');
                await stopScanner();
                scannerModal.classList.add('hidden');
                await handleScannedCode(decodedText);
            },
            (errorMessage) => {
                // Keep silent to avoid spamming the console on empty frames
            }
        );
    } catch (err) {
        console.error('Scanner start failed:', err);
        showToast('Camera access failed. Ensure you are using HTTPS and granted permissions.', 'error');
        scannerModal.classList.add('hidden');
    }
}

async function stopScanner() {
    if (appState.html5Qrcode) {
        try {
            if (appState.html5Qrcode.isScanning) {
                await appState.html5Qrcode.stop();
            }
            appState.html5Qrcode.clear();
        } catch (e) {
            console.error('Scanner stop error:', e);
        }
        appState.html5Qrcode = null;
    }
}

if (btnCloseScanner) {
    btnCloseScanner.addEventListener('click', async () => {
        await stopScanner();
        scannerModal.classList.add('hidden');
    });
}

if (scannerModal) {
    scannerModal.addEventListener('click', async (e) => {
        if (e.target === scannerModal) {
            await stopScanner();
            scannerModal.classList.add('hidden');
        }
    });
}

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
        oscillator.frequency.setValueAtTime(1000, ctx.currentTime);
        gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        oscillator.stop(ctx.currentTime + 0.12);
    } catch (e) {
        console.warn('Audio blocked:', e);
    }
}

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

// Boot
loadRecords();
