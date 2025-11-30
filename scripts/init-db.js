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

    // Seed users
    console.log('Seeding users...');

    const allUsers = [
        { display_name: 'Gary', user_name: 'gary' },
        { display_name: 'Neave', user_name: 'neave' },
        { display_name: 'Harish', user_name: 'harish' },
        { display_name: 'Chris', user_name: 'chris' },
        { display_name: 'Tony', user_name: 'tony' },
        { display_name: 'Seymour', user_name: 'seymour' },
        { display_name: 'Kerwin', user_name: 'kerwin' },
        { display_name: 'Wayne', user_name: 'wayne' },
        { display_name: 'Dee', user_name: 'dee' },
        { display_name: 'Lorenzo', user_name: 'lorenzo' },
        { display_name: 'JB', user_name: 'jb' }
    ];

    const insertUser = db.prepare('INSERT OR IGNORE INTO users (display_name, user_name) VALUES (?, ?)');

    let completed = 0;
    const totalUsers = allUsers.length;

    allUsers.forEach((user) => {

        insertUser.run(user.display_name, user.user_name, function(err) {
            if (err) {
                console.error(`Error inserting user ${user.display_name}:`, err);
            } else if (this.changes > 0) {
                console.log(`  Created user: ${user.display_name} (${user.user_name})`);
            }

            completed++;

            if (completed === totalUsers) {
                insertUser.finalize();

                console.log('Database initialization complete!');
                console.log(`Database location: ${DB_PATH}`);
                console.log(`Users can login by seleting their name from the list (no password required).`);

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
