const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Determine database directory and file path
const dbDir = process.env.DB_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}
const dbPath = path.join(dbDir, 'barcode_index.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database at:', dbPath);
    }
});

/**
 * Promise wrapper for db.run (INSERT, UPDATE, DELETE)
 */
function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this); // 'this' contains lastID and changes
        });
    });
}

/**
 * Promise wrapper for db.get (Select one row)
 */
function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

/**
 * Promise wrapper for db.all (Select multiple rows)
 */
function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

/**
 * Initialize database schema
 */
async function init() {
    try {
        // Enable foreign key constraints
        await run('PRAGMA foreign_keys = ON;');

        // Create settings table
        await run(`
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
        `);

        // Create indexes table
        await run(`
            CREATE TABLE IF NOT EXISTS indexes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                passcode_hash TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create records table
        await run(`
            CREATE TABLE IF NOT EXISTS records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                index_id INTEGER NOT NULL,
                barcode TEXT NOT NULL,
                title TEXT NOT NULL,
                notes TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (index_id) REFERENCES indexes (id) ON DELETE CASCADE,
                UNIQUE(index_id, barcode)
            )
        `);

        console.log('Database schema initialized successfully.');
    } catch (err) {
        console.error('Failed to initialize database schema:', err);
        throw err;
    }
}

module.exports = {
    init,
    run,
    get,
    all
};
