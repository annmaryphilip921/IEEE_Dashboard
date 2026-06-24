// db/connection.js
// PostgreSQL connection pool for AWS RDS
// Uses environment variables — never hard-code credentials

const { Pool } = require('pg');

const pool = new Pool({
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true'
        ? { rejectUnauthorized: false }  // RDS SSL (set true in prod with CA cert)
        : false,
    max: 10,                 // max connections in pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

// Test connection on startup
pool.connect((err, client, release) => {
    if (err) {
        console.error('ERROR: Could not connect to PostgreSQL (AWS RDS):', err.message);
        return;
    }
    release();
    console.log('Connected to AWS RDS PostgreSQL successfully');
});

// Handle idle client/network errors so process does not crash on transient RDS resets.
pool.on('error', (err) => {
    console.error('PostgreSQL pool error:', err.message);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    await pool.end();
    console.log('Database pool closed');
});

module.exports = pool;
