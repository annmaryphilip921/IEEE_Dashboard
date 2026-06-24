// db/seed-admins.js
// Run this ONCE after creating the RDS database to insert admin accounts
// Usage:
//   PowerShell:
//     $env:ADMIN_SEED_JSON='[{"username":"admin1","password":"StrongPass123!","fullName":"Admin One","email":"admin1@ieee-project.com","role":"Super Admin"}]'
//     node db/seed-admins.js

require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('./connection');

const SALT_ROUNDS = 12;

function loadAdminsFromEnv() {
    const raw = process.env.ADMIN_SEED_JSON;
    if (!raw) {
        throw new Error('ADMIN_SEED_JSON is not set. Refusing to seed hardcoded credentials.');
    }

    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (err) {
        throw new Error('ADMIN_SEED_JSON is not valid JSON.');
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('ADMIN_SEED_JSON must be a non-empty JSON array.');
    }

    const allowedRoles = new Set([
        'Super Admin',
        'Project Manager',
        'Supervisor',
        'Technical Admin',
        'IEEE Admin'
    ]);

    parsed.forEach((admin, index) => {
        const required = ['username', 'password', 'fullName', 'email', 'role'];
        for (const key of required) {
            if (!admin[key] || typeof admin[key] !== 'string') {
                throw new Error(`ADMIN_SEED_JSON[${index}].${key} is required and must be a string.`);
            }
        }
        if (!allowedRoles.has(admin.role)) {
            throw new Error(`ADMIN_SEED_JSON[${index}].role is invalid: ${admin.role}`);
        }
    });

    return parsed;
}

async function seedAdmins() {
    const admins = loadAdminsFromEnv();
    console.log('Seeding admin accounts...');
    for (const admin of admins) {
        const hash = await bcrypt.hash(admin.password, SALT_ROUNDS);
        await pool.query(
            `INSERT INTO admins (username, password_hash, full_name, email, role)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (username) DO NOTHING`,
            [admin.username, hash, admin.fullName, admin.email, admin.role]
        );
        console.log(`  Created admin: ${admin.username} (${admin.role})`);
    }
    console.log('Done. Admins seeded successfully.');
    await pool.end();
}

seedAdmins().catch(err => {
    console.error('Seed failed:', err);
    process.exit(1);
});
