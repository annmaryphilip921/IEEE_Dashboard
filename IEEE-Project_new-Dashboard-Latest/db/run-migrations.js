// db/run-migrations.js
// Runs SQL migration files in db/migrations in filename order.
// Usage: node db/run-migrations.js

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const pool = require('./connection');

async function runMigrations() {
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
        .filter((file) => file.toLowerCase().endsWith('.sql'))
        .sort((a, b) => a.localeCompare(b));

    if (files.length === 0) {
        console.log('No migration files found.');
        await pool.end();
        return;
    }

    console.log(`Running ${files.length} migration file(s)...`);

    for (const file of files) {
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf8').trim();

        if (!sql) {
            console.log(`Skipping empty migration: ${file}`);
            continue;
        }

        console.log(`Applying ${file}...`);
        await pool.query(sql);
    }

    console.log('All migrations applied successfully.');
    await pool.end();
}

runMigrations().catch((err) => {
    console.error('Migration run failed:', err);
    process.exitCode = 1;
    pool.end().catch(() => {});
});