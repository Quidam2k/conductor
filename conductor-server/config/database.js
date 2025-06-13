const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor() {
        this.db = null;
    }

    connect() {
        return new Promise((resolve, reject) => {
            const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'conductor.db');
            
            this.db = new sqlite3.Database(dbPath, (err) => {
                if (err) {
                    console.error('Error connecting to database:', err.message);
                    reject(err);
                } else {
                    console.log('Connected to SQLite database');
                    this.initializeTables()
                        .then(() => resolve())
                        .catch(reject);
                }
            });
        });
    }

    initializeTables() {
        return new Promise((resolve, reject) => {
            const tableQueries = [
                `CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    role TEXT DEFAULT 'participant',
                    email TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_login DATETIME,
                    public_key TEXT
                )`,
                
                `CREATE TABLE IF NOT EXISTS events (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    description TEXT,
                    location TEXT,
                    start_time DATETIME,
                    end_time DATETIME,
                    creator_id TEXT,
                    event_data JSON,
                    status TEXT DEFAULT 'draft',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (creator_id) REFERENCES users (id)
                )`,
                
                `CREATE TABLE IF NOT EXISTS event_participants (
                    event_id TEXT,
                    user_id TEXT,
                    role TEXT DEFAULT 'participant',
                    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (event_id, user_id),
                    FOREIGN KEY (event_id) REFERENCES events (id),
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )`,
                
                `CREATE TABLE IF NOT EXISTS devices (
                    id TEXT PRIMARY KEY,
                    user_id TEXT,
                    device_name TEXT,
                    device_type TEXT,
                    public_key TEXT,
                    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
                    trusted BOOLEAN DEFAULT FALSE,
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )`
            ];

            // Index queries for performance optimization
            const indexQueries = [
                // User indexes
                `CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`,
                `CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at)`,
                `CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login)`,
                
                // Event indexes
                `CREATE INDEX IF NOT EXISTS idx_events_creator_id ON events(creator_id)`,
                `CREATE INDEX IF NOT EXISTS idx_events_status ON events(status)`,
                `CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(start_time)`,
                `CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at)`,
                `CREATE INDEX IF NOT EXISTS idx_events_updated_at ON events(updated_at)`,
                
                // Event participants indexes
                `CREATE INDEX IF NOT EXISTS idx_event_participants_event_id ON event_participants(event_id)`,
                `CREATE INDEX IF NOT EXISTS idx_event_participants_user_id ON event_participants(user_id)`,
                `CREATE INDEX IF NOT EXISTS idx_event_participants_joined_at ON event_participants(joined_at)`,
                
                // Device indexes
                `CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id)`,
                `CREATE INDEX IF NOT EXISTS idx_devices_last_seen ON devices(last_seen)`,
                `CREATE INDEX IF NOT EXISTS idx_devices_trusted ON devices(trusted)`
            ];

            const allQueries = [...tableQueries, ...indexQueries];
            let completedQueries = 0;
            
            allQueries.forEach((query) => {
                this.db.run(query, (err) => {
                    if (err) {
                        console.error('Error creating table:', err.message);
                        reject(err);
                        return;
                    }
                    
                    completedQueries++;
                    if (completedQueries === allQueries.length) {
                        console.log('Database tables and indexes initialized');
                        resolve();
                    }
                });
            });
        });
    }

    close() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        console.error('Error closing database:', err.message);
                        reject(err);
                    } else {
                        console.log('Database connection closed');
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }

    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }
}

module.exports = new Database();