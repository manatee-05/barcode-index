/* --------------------------------------------------------------------------
   AEROSCAN - DASHBOARD LOGIC
   -------------------------------------------------------------------------- */

let appState = {
    token: localStorage.getItem('aeroscan_token') || '',
    indexName: localStorage.getItem('aeroscan_index_name') || '',
    records: [],
    selectedBarcode: null,
    isScanning: false
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
        
        try {
            // Get devices natively
            let devices = await navigator.mediaDevices.enumerateDevices();
            let videoDevices = devices.filter(d => d.kind === 'videoinput');
            
            // If labels are empty (Safari), we need to request permission first
            if (videoDevices.length > 0 && !videoDevices[0].label) {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                stream.getTracks().forEach(track => track.stop());
                await new Promise(r => setTimeout(r, 250)); // Wait for hardware to release lock
                
                devices = await navigator.mediaDevices.enumerateDevices();
                videoDevices = devices.filter(d => d.kind === 'videoinput');
            }
            
            cameraSelect.innerHTML = '';
            
            if (videoDevices && videoDevices.length > 0) {
                let defaultDeviceId = videoDevices[0].deviceId;
                videoDevices.forEach((camera, index) => {
                    const opt = document.createElement('option');
                    opt.value = camera.deviceId;
                    // Prefer back/environment camera if available
                    if (camera.label.toLowerCase().includes('back') || camera.label.toLowerCase().includes('environment')) {
                        opt.selected = true;
                        defaultDeviceId = camera.deviceId;
                    }
                    opt.textContent = camera.label || `Camera ${index + 1}`;
                    cameraSelect.appendChild(opt);
                });
                
                if (!cameraSelect.value) {
                    cameraSelect.value = defaultDeviceId;
                }
                
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

function startScanner() {
    stopScanner(); // Ensure any previous instance is stopped completely
    const cameraId = cameraSelect.value;
    if (!cameraId) return;

    const targetDiv = document.getElementById('scanner-viewfinder');
    targetDiv.innerHTML = ''; // Clear previous injected elements

    // Force injected elements to fill the square UI correctly
    targetDiv.style.position = 'relative';
    
    // Add a quick dynamic style to ensure Quagga's injected video/canvas elements don't overflow
    if (!document.getElementById('quagga-styles')) {
        const style = document.createElement('style');
        style.id = 'quagga-styles';
        style.innerHTML = `
            #scanner-viewfinder video { width: 100%; height: 100%; object-fit: cover; position: absolute; top: 0; left: 0; }
            #scanner-viewfinder canvas.drawingBuffer { display: none; }
        `;
        document.head.appendChild(style);
    }

    try {
        Quagga.init({
            inputStream: {
                name: "Live",
                type: "LiveStream",
                target: targetDiv,
                constraints: {
                    width: { ideal: 1280 }, // Higher res makes 1D scanning much more reliable
                    height: { ideal: 720 },
                    deviceId: cameraId
                }
            },
            locator: {
                patchSize: "medium",
                halfSample: true
            },
            numOfWorkers: navigator.hardwareConcurrency ? Math.min(navigator.hardwareConcurrency, 4) : 2,
            decoder: {
                // Extremely comprehensive 1D coverage
                readers: [
                    "code_128_reader",
                    "ean_reader",
                    "ean_8_reader",
                    "code_39_reader",
                    "code_39_vin_reader",
                    "codabar_reader",
                    "upc_reader",
                    "upc_e_reader",
                    "i2of5_reader",
                    "2of5_reader",
                    "code_93_reader"
                ]
            },
            locate: true
        }, function(err) {
            if (err) {
                console.error("Quagga Init Error:", err);
                showToast('Camera access failed. Check browser permissions.', 'error');
                scannerModal.classList.add('hidden');
                return;
            }
            Quagga.start();
            appState.isScanning = true;
        });

        // Register the callback
        Quagga.onDetected(onBarcodeFound);

    } catch (err) {
        console.error('Scanner start failed:', err);
        showToast('Camera initialization failed.', 'error');
        scannerModal.classList.add('hidden');
    }
}

async function onBarcodeFound(result) {
    const code = result.codeResult.code;
    if (!code || !appState.isScanning) return;
    
    // Quagga can sometimes read a frame multiple times in rapid succession
    appState.isScanning = false; 
    
    playBeep();
    showToast(`Scanned Code: ${code}`, 'success');
    stopScanner();
    scannerModal.classList.add('hidden');
    await handleScannedCode(code);
}

function stopScanner() {
    appState.isScanning = false;
    try {
        // Quagga has a tendency to throw if stopped before fully started, so we wrap it
        Quagga.stop();
        Quagga.offDetected(onBarcodeFound);
    } catch (e) {
        console.warn('Error stopping Quagga:', e);
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
