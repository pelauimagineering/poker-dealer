const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '..', 'database', 'poker-dealer.db');

let db = null;

function getDb() {
    if (!db) {
        console.log(`Opening database at: ${DB_PATH}`);
        db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) {
                console.error('Error opening database:', err);
            } else {
                db.run('PRAGMA foreign_keys = ON');
            }
        });
    }
    return db;
}

// User operations
const userOps = {
    findByEmail(email, callback) {
        const query = 'SELECT * FROM users WHERE email = ?';
        getDb().get(query, [email], callback);
    },

    findById(id, callback) {
        const query = 'SELECT * FROM users WHERE id = ?';
        getDb().get(query, [id], callback);
    },

    create(name, email, passwordHash, callback) {
        const query = 'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)';
        getDb().run(query, [name, email, passwordHash], callback);
    }
};

// Session operations
const sessionOps = {
    create(userId, token, expiresAt, callback) {
        const query = 'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)';
        getDb().run(query, [userId, token, expiresAt], callback);
    },

    findByToken(token, callback) {
        const query = `
            SELECT s.*, u.id as user_id, u.name, u.email
            FROM sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.token = ? AND s.expires_at > datetime('now')
        `;
        getDb().get(query, [token], callback);
    },

    delete(token, callback) {
        const query = 'DELETE FROM sessions WHERE token = ?';
        getDb().run(query, [token], callback);
    },

    deleteExpired(callback) {
        const query = `DELETE FROM sessions WHERE expires_at <= datetime('now')`;
        getDb().run(query, [], callback);
    },

    deleteByUserId(userId, callback) {
        const query = 'DELETE FROM sessions WHERE user_id = ?';
        getDb().run(query, [userId], callback);
    }
};

// Game state operations
const gameStateOps = {
    get(callback) {
        const query = 'SELECT * FROM game_state WHERE id = 1';
        getDb().get(query, [], (err, result) => {
            if (err) {
                callback(err);
                return;
            }

            if (result) {
                const parsed = {
                    ...result,
                    player_order: JSON.parse(result.player_order || '[]'),
                    community_cards: JSON.parse(result.community_cards || '[]'),
                    deck_state: result.deck_state ? JSON.parse(result.deck_state) : null,
                    cards_dealt: Boolean(result.cards_dealt)
                };
                callback(null, parsed);
            } else {
                callback(null, null);
            }
        });
    },

    update(gameState, callback) {
        const query = `
            UPDATE game_state
            SET current_dealer_index = ?,
                player_order = ?,
                deck_state = ?,
                community_cards = ?,
                phase = ?,
                cards_dealt = ?,
                updated_at = datetime('now')
            WHERE id = 1
        `;

        getDb().run(
            query,
            [
                gameState.current_dealer_index,
                JSON.stringify(gameState.player_order || []),
                gameState.deck_state ? JSON.stringify(gameState.deck_state) : null,
                JSON.stringify(gameState.community_cards || []),
                gameState.phase,
                gameState.cards_dealt ? 1 : 0
            ],
            callback
        );
    },

    reset(callback) {
        const query = `
            UPDATE game_state
            SET current_dealer_index = 0,
                player_order = '[]',
                deck_state = NULL,
                community_cards = '[]',
                phase = 'waiting',
                cards_dealt = 0,
                updated_at = datetime('now')
            WHERE id = 1
        `;
        getDb().run(query, [], callback);
    }
};

function close() {
    if (db) {
        db.close((err) => {
            if (err) {
                console.error('Error closing database:', err);
            }
            db = null;
        });
    }
}

module.exports = {
    getDb,
    users: userOps,
    sessions: sessionOps,
    gameState: gameStateOps,
    close
};
