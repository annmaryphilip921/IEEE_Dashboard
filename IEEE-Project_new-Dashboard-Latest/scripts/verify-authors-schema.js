require('dotenv').config();
const { Pool } = require('pg');

async function verifyAuthorsSchema() {
    const pool = new Pool({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const columns = await pool.query(
            `SELECT column_name, is_nullable
             FROM information_schema.columns
             WHERE table_name = 'authors'
               AND column_name IN ('created_by_admin_id', 'invited_at', 'accepted_at')
             ORDER BY column_name`
        );

        console.log('Authors schema check:');
        console.table(columns.rows);

        const constraints = await pool.query(
            `SELECT conname
             FROM pg_constraint
             WHERE conname = 'chk_author_acceptance_timestamp'`
        );

        console.log('Acceptance constraint present:', constraints.rowCount === 1);
    } catch (err) {
        console.error('Verification failed:', err.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

verifyAuthorsSchema();
