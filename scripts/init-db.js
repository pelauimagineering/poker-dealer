const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'database', 'poker-dealer.db');
const SCHEMA_PATH = path.join(__dirname, '..', 'database', 'schema.sql');

console.log('Initializing database...');

// Create database directory if it doesn't exist
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Create or open database
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error opening database:', err);
        process.exit(1);
    }
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Read and execute schema
console.log('Creating schema...');
const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');

db.exec(schema, (err) => {
    if (err) {
        console.error('Error creating schema:', err);
        db.close();
        process.exit(1);
    }

    // Seed test users
    console.log('Seeding test users...');
    const SALT_ROUNDS = 10;
    const defaultPassword = 'password123';

    const testUsers = [
        { name: 'Alice', email: 'alice@example.com' },
        { name: 'Bob', email: 'bob@example.com' },
        { name: 'Charlie', email: 'charlie@example.com' },
        { name: 'Diana', email: 'diana@example.com' },
        { name: 'Eve', email: 'eve@example.com' },
        { name: 'Frank', email: 'frank@example.com' },
        { name: 'Grace', email: 'grace@example.com' },
        { name: 'Henry', email: 'henry@example.com' },
        { name: 'Ivy', email: 'ivy@example.com' },
        { name: 'Jack', email: 'jack@example.com' }
    ];

    const insertUser = db.prepare('INSERT OR IGNORE INTO users (name, email, password_hash) VALUES (?, ?, ?)');

    let completed = 0;
    const totalUsers = testUsers.length;

    testUsers.forEach((user) => {
        const passwordHash = bcrypt.hashSync(defaultPassword, SALT_ROUNDS);

        insertUser.run(user.name, user.email, passwordHash, function(err) {
            if (err) {
                console.error(`Error inserting user ${user.name}:`, err);
            } else if (this.changes > 0) {
                console.log(`  Created user: ${user.name} (${user.email})`);
            }

            completed++;

            if (completed === totalUsers) {
                insertUser.finalize();

                console.log('Database initialization complete!');
                console.log(`Database location: ${DB_PATH}`);
                console.log(`Test users can login with password: ${defaultPassword}`);

                db.close((err) => {
                    if (err) {
                        console.error('Error closing database:', err);
                    }
                    process.exit(0);
                });
            }
        });
    });
});
