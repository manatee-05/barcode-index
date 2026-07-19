const express = require('express');
const crypto = require('crypto');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 8081;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend assets
app.use(express.static(path.join(__dirname, 'public')));

let TOKEN_SECRET = '';

/**
 * Fetch or generate token secret from setting table
 */
async function getOrInitSecret() {
    try {
        const row = await db.get('SELECT value FROM settings WHERE key = ?', ['token_secret']);
        if (row) {
            TOKEN_SECRET = row.value;
        } else {
            TOKEN_SECRET = crypto.randomBytes(32).toString('hex');
            await db.run('INSERT INTO settings (key, value) VALUES (?, ?)', ['token_secret', TOKEN_SECRET]);
        }
    } catch (err) {
        console.error('Error initializing token secret, generating in-memory fallback:', err);
        TOKEN_SECRET = crypto.randomBytes(32).toString('hex');
    }
}

/**
 * Generate HMAC SHA-256 signed token
 */
function generateToken(indexName) {
    const signature = crypto.createHmac('sha256', TOKEN_SECRET).update(indexName).digest('hex');
    return `${indexName}.${signature}`;
}

/**
 * Passcode hashing helper
 */
function hashPasscode(passcode) {
    return crypto.createHash('sha256').update(passcode).digest('hex');
}

/**
 * Authentication Middleware
 */
async function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ error: 'Authorization header required' });
    }
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return res.status(401).json({ error: 'Authorization header format is Bearer <token>' });
    }
    
    const token = parts[1];
    const tokenParts = token.split('.');
    if (tokenParts.length !== 2) {
        return res.status(401).json({ error: 'Invalid token format' });
    }
    
    const [indexName, signature] = tokenParts;
    const expectedSignature = crypto.createHmac('sha256', TOKEN_SECRET).update(indexName).digest('hex');
    if (signature !== expectedSignature) {
        return res.status(401).json({ error: 'Invalid authentication token' });
    }

    try {
        const index = await db.get('SELECT id, name FROM indexes WHERE name = ?', [indexName]);
        if (!index) {
            return res.status(401).json({ error: 'Index does not exist' });
        }
        req.indexId = index.id;
        req.indexName = index.name;
        next();
    } catch (err) {
        console.error('Database authentication error:', err);
        res.status(500).json({ error: 'Internal authentication database error' });
    }
}

/* API ROUTES */

// 1. Search for existing index by name
app.get('/api/indexes/search', async (req, res) => {
    const { q } = req.query;
    if (!q || typeof q !== 'string' || q.trim() === '') {
        return res.json([]);
    }
    const cleanQ = q.trim();
    try {
        const rows = await db.all(
            'SELECT name FROM indexes WHERE name LIKE ? LIMIT 8',
            [`%${cleanQ}%`]
        );
        res.json(rows);
    } catch (err) {
        console.error('Error searching indexes:', err);
        res.status(500).json({ error: 'Database search query failed' });
    }
});

// 2. Create a new index
app.post('/api/index/create', async (req, res) => {
    const { name, passcode } = req.body;
    if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ error: 'Valid index name is required' });
    }
    if (!passcode || typeof passcode !== 'string' || passcode.trim() === '') {
        return res.status(400).json({ error: 'Valid passcode is required' });
    }

    const cleanName = name.trim();
    const cleanPasscode = passcode.trim();

    // Enforce basic naming rules
    if (!/^[a-zA-Z0-9-_]{3,30}$/.test(cleanName)) {
        return res.status(400).json({
            error: 'Index name must be 3-30 characters long and contain only letters, numbers, dashes, and underscores.'
        });
    }

    try {
        // Check if index already exists
        const existing = await db.get('SELECT id FROM indexes WHERE name = ?', [cleanName]);
        if (existing) {
            return res.status(400).json({ error: 'An index with this name already exists' });
        }

        const passcodeHash = hashPasscode(cleanPasscode);
        await db.run(
            'INSERT INTO indexes (name, passcode_hash) VALUES (?, ?)',
            [cleanName, passcodeHash]
        );

        const token = generateToken(cleanName);
        res.status(201).json({ success: true, token, indexName: cleanName });
    } catch (err) {
        console.error('Error creating index:', err);
        res.status(500).json({ error: 'Failed to create index' });
    }
});

// 3. Authenticate / Sign into an index
app.post('/api/index/auth', async (req, res) => {
    const { name, passcode } = req.body;
    if (!name || !passcode) {
        return res.status(400).json({ error: 'Index name and passcode are required' });
    }

    const cleanName = name.trim();
    const cleanPasscode = passcode.trim();

    try {
        const index = await db.get('SELECT * FROM indexes WHERE name = ?', [cleanName]);
        if (!index) {
            return res.status(401).json({ error: 'Index not found' });
        }

        const inputHash = hashPasscode(cleanPasscode);
        if (index.passcode_hash !== inputHash) {
            return res.status(401).json({ error: 'Incorrect passcode' });
        }

        const token = generateToken(cleanName);
        res.json({ success: true, token, indexName: cleanName });
    } catch (err) {
        console.error('Authentication error:', err);
        res.status(500).json({ error: 'Internal authentication server error' });
    }
});

// 4. Retrieve all records in index (with optional query filter)
app.get('/api/records', authenticateToken, async (req, res) => {
    const { search } = req.query;
    try {
        let records;
        if (search && typeof search === 'string' && search.trim() !== '') {
            const cleanSearch = `%${search.trim()}%`;
            records = await db.all(
                'SELECT * FROM records WHERE index_id = ? AND (barcode LIKE ? OR title LIKE ? OR notes LIKE ?) ORDER BY updated_at DESC',
                [req.indexId, cleanSearch, cleanSearch, cleanSearch]
            );
        } else {
            records = await db.all(
                'SELECT * FROM records WHERE index_id = ? ORDER BY updated_at DESC',
                [req.indexId]
            );
        }
        res.json(records);
    } catch (err) {
        console.error('Error fetching records:', err);
        res.status(500).json({ error: 'Failed to retrieve records' });
    }
});

// 5. Retrieve a single record in the index
app.get('/api/records/:barcode', authenticateToken, async (req, res) => {
    const { barcode } = req.params;
    try {
        const record = await db.get(
            'SELECT * FROM records WHERE index_id = ? AND barcode = ?',
            [req.indexId, barcode]
        );
        if (!record) {
            return res.status(404).json({ error: 'Record not found' });
        }
        res.json(record);
    } catch (err) {
        console.error('Error fetching single record:', err);
        res.status(500).json({ error: 'Failed to retrieve record details' });
    }
});

// 6. Create or update record (UPSERT)
app.post('/api/records', authenticateToken, async (req, res) => {
    const { barcode, title, notes } = req.body;
    if (!barcode || typeof barcode !== 'string' || barcode.trim() === '') {
        return res.status(400).json({ error: 'Barcode value is required' });
    }
    if (!title || typeof title !== 'string' || title.trim() === '') {
        return res.status(400).json({ error: 'Title is required' });
    }

    const cleanBarcode = barcode.trim();
    const cleanTitle = title.trim();
    const cleanNotes = notes ? notes.toString() : '';

    try {
        await db.run(`
            INSERT INTO records (index_id, barcode, title, notes)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(index_id, barcode) DO UPDATE SET
                title = excluded.title,
                notes = excluded.notes,
                updated_at = CURRENT_TIMESTAMP
        `, [req.indexId, cleanBarcode, cleanTitle, cleanNotes]);

        const record = await db.get(
            'SELECT * FROM records WHERE index_id = ? AND barcode = ?',
            [req.indexId, cleanBarcode]
        );
        res.status(200).json({ success: true, record });
    } catch (err) {
        console.error('Error saving record:', err);
        res.status(500).json({ error: 'Failed to save record' });
    }
});

// 7. Delete record
app.delete('/api/records/:barcode', authenticateToken, async (req, res) => {
    const { barcode } = req.params;
    try {
        const result = await db.run(
            'DELETE FROM records WHERE index_id = ? AND barcode = ?',
            [req.indexId, barcode]
        );
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Record not found or already deleted' });
        }
        res.json({ success: true, message: 'Record deleted successfully' });
    } catch (err) {
        console.error('Error deleting record:', err);
        res.status(500).json({ error: 'Failed to delete record' });
    }
});

// Serve frontend SPA (Fallback for HTML5 routing if needed, but SPA fits inside root)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize database and start listening
(async () => {
    try {
        await db.init();
        await getOrInitSecret();
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Barcode Indexer listening on port ${PORT}`);
        });
    } catch (err) {
        console.error('Startup failed:', err);
        process.exit(1);
    }
})();
