require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const multer = require('multer');
const XLSX = require('xlsx');
const { spawn } = require('child_process');
const pool = require('./db/connection');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize S3 client
const s3Client = new S3Client({
    region: process.env.S3_REGION || process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

const S3_BUCKET = process.env.S3_BUCKET_NAME || 'ieee-dashboard-drafts';
const S3_SIGNED_URL_EXPIRY = parseInt(process.env.S3_SIGNED_URL_EXPIRY || '3600');
// Temporary default disabled to allow uploads while scanner setup is pending.
const MALWARE_SCAN_REQUIRED = String(process.env.MALWARE_SCAN_REQUIRED || 'false').toLowerCase() !== 'false';
const MALWARE_SCAN_TIMEOUT_MS = parseInt(process.env.MALWARE_SCAN_TIMEOUT_MS || '120000', 10);
const BULK_UPLOAD_BCRYPT_ROUNDS = parseInt(process.env.BULK_UPLOAD_BCRYPT_ROUNDS || '8', 10);

// Helper function to upload file to S3
async function uploadToS3(fileBuffer, fileName, mimeType, folder = 'first-drafts') {
    try {
        const key = `${folder}/${Date.now()}_${fileName}`;
        const command = new PutObjectCommand({
            Bucket: S3_BUCKET,
            Key: key,
            Body: fileBuffer,
            ContentType: mimeType,
            Metadata: {
                'uploaded-at': new Date().toISOString()
            }
        });
        
        await s3Client.send(command);
        return { key, location: `s3://${S3_BUCKET}/${key}` };
    } catch (err) {
        console.error('S3 upload error:', err.message);
        throw err;
    }
}

// Helper function to generate pre-signed URL for S3 object
async function getS3SignedUrl(s3Key, expirySeconds = S3_SIGNED_URL_EXPIRY) {
    try {
        const command = new GetObjectCommand({
            Bucket: S3_BUCKET,
            Key: s3Key
        });
        
        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: expirySeconds });
        return signedUrl;
    } catch (err) {
        console.error('Error generating signed URL:', err.message);
        throw err;
    }
}

// Helper function to format dates in LOCAL timezone (NOT UTC) for API responses
function formatLocalDate(dateValue) {
    if (!dateValue) return null;
    
    // If already a string in YYYY-MM-DD format, return as-is
    if (typeof dateValue === 'string') {
        return dateValue.slice(0, 10);
    }
    
    // If it's a Date object, extract local components (don't use toISOString which converts to UTC)
    if (dateValue instanceof Date) {
        const yyyy = dateValue.getFullYear();
        const mm = String(dateValue.getMonth() + 1).padStart(2, '0');
        const dd = String(dateValue.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }
    
    return null;
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('.'));

const uploadsBaseDir = path.join(__dirname, 'uploads', 'first-drafts');
fs.mkdirSync(uploadsBaseDir, { recursive: true });
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Use memory storage for multer (files will be uploaded to S3)
const draftStorage = multer.memoryStorage();

const uploadDraft = multer({
    storage: draftStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowed = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        const okByMime = allowed.includes(file.mimetype);
        const ext = path.extname(file.originalname || '').toLowerCase();
        const okByExt = ['.pdf', '.doc', '.docx'].includes(ext);
        cb(null, okByMime || okByExt);
    }
});

const uploadAdminDocument = multer({
    storage: draftStorage,
    limits: { fileSize: 25 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowedMimeTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'text/plain',
            'text/csv'
        ];
        const ext = path.extname(file.originalname || '').toLowerCase();
        const allowedExt = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv'];
        cb(null, allowedMimeTypes.includes(file.mimetype) || allowedExt.includes(ext));
    }
});

const uploadAuthorExcel = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        const allowedMime = [
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/octet-stream'
        ];
        cb(null, ['.xlsx', '.xls'].includes(ext) || allowedMime.includes(file.mimetype));
    }
});

async function runScannerCommand(command, args, timeoutMs) {
    return new Promise((resolve) => {
        const child = spawn(command, args, { windowsHide: true });
        let stdout = '';
        let stderr = '';
        let settled = false;

        const timer = setTimeout(() => {
            if (!settled) {
                settled = true;
                child.kill('SIGTERM');
                resolve({ ok: false, timeout: true, stdout, stderr, error: new Error('Scanner timed out') });
            }
        }, timeoutMs);

        child.stdout.on('data', (data) => {
            stdout += String(data || '');
        });
        child.stderr.on('data', (data) => {
            stderr += String(data || '');
        });

        child.on('error', (error) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve({ ok: false, stdout, stderr, error });
        });

        child.on('close', (code) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve({ ok: true, code, stdout, stderr });
        });
    });
}

async function scanBufferForMalware(fileBuffer, originalFileName) {
    const scannerCandidates = String(process.env.MALWARE_SCANNER_COMMAND || 'clamscan,clamdscan,clamscan.exe,clamdscan.exe')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);

    const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ieee-malware-scan-'));
    const safeName = String(originalFileName || 'upload.bin').replace(/[^a-zA-Z0-9._-]/g, '_');
    const tempFilePath = path.join(tmpDir, safeName);

    try {
        await fs.promises.writeFile(tempFilePath, fileBuffer);

        let scannerDetected = false;

        for (const scanner of scannerCandidates) {
            const scannerName = scanner.toLowerCase();
            let args;
            if (scannerName.includes('mpcmdrun')) {
                args = ['-Scan', '-ScanType', '3', '-File', tempFilePath, '-DisableRemediation'];
            } else if (scannerName.includes('clamdscan')) {
                args = ['--no-summary', tempFilePath];
            } else {
                args = ['--no-summary', '--stdout', tempFilePath];
            }

            const result = await runScannerCommand(scanner, args, MALWARE_SCAN_TIMEOUT_MS);
            if (!result.ok) {
                if (result.timeout) {
                    return {
                        scannerAvailable: true,
                        clean: false,
                        status: 'error',
                        engine: scanner,
                        reason: 'Malware scanner timed out'
                    };
                }

                const errorCode = result.error && result.error.code;
                if (errorCode === 'ENOENT') {
                    continue;
                }

                scannerDetected = true;
                return {
                    scannerAvailable: true,
                    clean: false,
                    status: 'error',
                    engine: scanner,
                    reason: result.error ? result.error.message : 'Malware scanner failed to execute'
                };
            }

            scannerDetected = true;
            const output = `${result.stdout || ''}\n${result.stderr || ''}`;
            const normalizedOutput = output.toLowerCase();

            if (scannerName.includes('mpcmdrun')) {
                if (normalizedOutput.includes('product/feature disabled')) {
                    return {
                        scannerAvailable: false,
                        clean: false,
                        status: 'unavailable',
                        engine: scanner,
                        reason: 'Windows Defender is disabled on this machine'
                    };
                }

                if (normalizedOutput.includes('threat') || normalizedOutput.includes('infected')) {
                    return {
                        scannerAvailable: true,
                        clean: false,
                        status: 'infected',
                        engine: scanner,
                        signature: 'Threat reported by Windows Defender',
                        reason: 'Malware detected'
                    };
                }

                if (result.code === 0 || normalizedOutput.includes('found no threats')) {
                    return {
                        scannerAvailable: true,
                        clean: true,
                        status: 'clean',
                        engine: scanner
                    };
                }

                return {
                    scannerAvailable: false,
                    clean: false,
                    status: 'unavailable',
                    engine: scanner,
                    reason: 'Windows Defender scan failed or is unavailable'
                };
            }

            if (result.code === 1 || normalizedOutput.includes(' found')) {
                const firstLine = String(output || '').split(/\r?\n/).find((line) => line.trim()) || 'Malware signature detected';
                return {
                    scannerAvailable: true,
                    clean: false,
                    status: 'infected',
                    engine: scanner,
                    signature: firstLine.trim(),
                    reason: 'Malware detected'
                };
            }

            if (result.code === 0 || normalizedOutput.includes(' ok')) {
                return {
                    scannerAvailable: true,
                    clean: true,
                    status: 'clean',
                    engine: scanner
                };
            }

            return {
                scannerAvailable: true,
                clean: false,
                status: 'error',
                engine: scanner,
                reason: `Unexpected scanner exit code: ${result.code}`
            };
        }

        if (!scannerDetected) {
            return {
                scannerAvailable: false,
                clean: false,
                status: 'unavailable',
                reason: 'No malware scanner executable found (install ClamAV or configure MALWARE_SCANNER_COMMAND)'
            };
        }

        return {
            scannerAvailable: false,
            clean: false,
            status: 'unavailable',
            reason: 'Malware scanner unavailable'
        };
    } finally {
        await fs.promises.rm(tmpDir, { recursive: true, force: true });
    }
}

async function ensureSubmissionTable() {
    await pool.query(
        `CREATE TABLE IF NOT EXISTS paper_submissions (
            id              SERIAL PRIMARY KEY,
            author_id       INTEGER NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
            file_name       TEXT NOT NULL,
            stored_name     TEXT NOT NULL,
            file_path       TEXT NOT NULL,
            mime_type       VARCHAR(120),
            file_size       BIGINT,
            comments        TEXT,
            status          VARCHAR(20) NOT NULL DEFAULT 'submitted',
            submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`
    );
}

async function ensureChatTables() {
    await pool.query(
        `CREATE TABLE IF NOT EXISTS chat_sessions (
            id               SERIAL PRIMARY KEY,
            author_id        INTEGER NOT NULL UNIQUE REFERENCES authors(id) ON DELETE CASCADE,
            created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_message_at  TIMESTAMPTZ
        )`
    );

    await pool.query(
        `CREATE TABLE IF NOT EXISTS chat_messages (
            id              BIGSERIAL PRIMARY KEY,
            session_id      INTEGER NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
            sender_type     VARCHAR(20) NOT NULL,
            sender_name     VARCHAR(120),
            message         TEXT,
            attachments     JSONB NOT NULL DEFAULT '[]'::jsonb,
            read_by_admin   BOOLEAN NOT NULL DEFAULT FALSE,
            read_by_author  BOOLEAN NOT NULL DEFAULT FALSE,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT chat_sender_type_chk CHECK (sender_type IN ('admin','author','system'))
        )`
    );

    await pool.query('CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created ON chat_messages(session_id, created_at DESC)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_chat_messages_unread_admin ON chat_messages(session_id) WHERE read_by_admin = FALSE AND sender_type IN (\'author\', \'system\')');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_chat_messages_unread_author ON chat_messages(session_id) WHERE read_by_author = FALSE AND sender_type = \'admin\'');
}

async function ensureAdminDocumentsTable() {
    await pool.query(
        `CREATE TABLE IF NOT EXISTS admin_documents (
            id                    SERIAL PRIMARY KEY,
            original_file_name    TEXT NOT NULL,
            stored_name           TEXT NOT NULL,
            file_path             TEXT NOT NULL,
            mime_type             VARCHAR(120),
            file_size             BIGINT,
            uploaded_by_admin_id  INTEGER REFERENCES admins(id) ON DELETE SET NULL,
            malware_scan_status   VARCHAR(20) NOT NULL DEFAULT 'clean'
                                  CHECK (malware_scan_status IN ('clean', 'infected', 'error', 'unavailable')),
            malware_scan_engine   VARCHAR(120),
            malware_signature     TEXT,
            uploaded_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`
    );

    await pool.query('CREATE INDEX IF NOT EXISTS idx_admin_documents_uploaded_at ON admin_documents(uploaded_at DESC)');
}

async function ensureEmailTemplatesTable() {
    await pool.query(
        `CREATE TABLE IF NOT EXISTS email_templates (
            id              SERIAL PRIMARY KEY,
            template_type   VARCHAR(50) NOT NULL UNIQUE CHECK (template_type IN ('invitation', 'rejection', 'first-reminder', 'final-submission')),
            subject         TEXT NOT NULL,
            body_html       TEXT NOT NULL,
            body_plain      TEXT NOT NULL,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_by      INTEGER REFERENCES admins(id)
        )`
    );

    await pool.query(
        `DO $$
        DECLARE existing_constraint_name TEXT;
        BEGIN
            SELECT con.conname
            INTO existing_constraint_name
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            WHERE rel.relname = 'email_templates'
              AND con.contype = 'c'
              AND pg_get_constraintdef(con.oid) ILIKE '%template_type%'
            LIMIT 1;

            IF existing_constraint_name IS NOT NULL THEN
                EXECUTE format('ALTER TABLE email_templates DROP CONSTRAINT %I', existing_constraint_name);
            END IF;

            ALTER TABLE email_templates
            ADD CONSTRAINT email_templates_template_type_check
            CHECK (template_type IN ('invitation', 'rejection', 'first-reminder', 'final-submission'));
        EXCEPTION
            WHEN duplicate_object THEN
                NULL;
        END $$;`
    );

    await pool.query(
        `INSERT INTO email_templates (template_type, subject, body_html, body_plain) VALUES ('invitation', 'IEEE PCIC - Conference Invitation', '<div><p>Hi {AUTHOR_FIRST_NAME},</p><p>Invitation to IEEE PCIC conference for paper: {PAPER_TITLE}</p><p><strong>Paper ID:</strong> {PAPER_ID}</p><p><strong>Login Email:</strong> {EMAIL}</p><p><strong>Password:</strong> {PASSWORD}</p></div>', 'Hi {AUTHOR_FIRST_NAME}, Invitation to participate in IEEE PCIC conference. Paper ID: {PAPER_ID}, Login Email: {EMAIL}, Password: {PASSWORD}')
            ON CONFLICT (template_type) DO NOTHING`
    );

    await pool.query(
        `INSERT INTO email_templates (template_type, subject, body_html, body_plain)
         VALUES (
            'rejection',
            'IEEE PCIC - Paper Decision Notification',
            '<div><p>Dear {AUTHOR_FIRST_NAME},</p><p>Thank you for submitting your paper <strong>{PAPER_TITLE}</strong> (Paper ID: <strong>{PAPER_ID}</strong>).</p><p>After review, we regret to inform you that your submission has not been selected for this cycle.</p><p>We appreciate your effort and encourage you to submit future work to upcoming IEEE PCIC conferences.</p><p>Best regards,<br><strong>IEEE PCIC - Mariane Sub-Committee</strong></p></div>',
            'Dear {AUTHOR_FIRST_NAME}, Thank you for submitting your paper {PAPER_TITLE} (Paper ID: {PAPER_ID}). After review, we regret to inform you that your submission has not been selected for this cycle. Best regards, IEEE PCIC - Mariane Sub-Committee'
         )
         ON CONFLICT (template_type) DO NOTHING`
    );

    await pool.query(
        `INSERT INTO email_templates (template_type, subject, body_html, body_plain)
         VALUES (
            'final-submission',
            'Final Paper Submission - IEEE PCIC Conference',
            '<div><p>Dear {AUTHOR_FIRST_NAME},</p><p>This is a reminder to submit your final paper for the IEEE PCIC Conference.</p><p><strong>Paper ID:</strong> {PAPER_ID}</p><p><strong>Paper Title:</strong> {PAPER_TITLE}</p><p>Please complete your final paper submission at the earliest.</p><p>If you need any assistance, please contact the conference team.</p><p>Best regards,<br><strong>IEEE PCIC - Mariane Sub-Committee</strong></p></div>',
            'Dear {AUTHOR_FIRST_NAME}, This is a reminder to submit your final paper for the IEEE PCIC Conference. Paper ID: {PAPER_ID}. Paper Title: {PAPER_TITLE}. Please complete your final paper submission at the earliest. Best regards, IEEE PCIC - Mariane Sub-Committee'
         )
         ON CONFLICT (template_type) DO NOTHING`
    );
}

async function ensureAdminStageDatesTable() {
    await pool.query(
        `CREATE TABLE IF NOT EXISTS admin_stage_dates (
            id              SERIAL PRIMARY KEY,
            stage           VARCHAR(50) NOT NULL,
            start_time      TIMESTAMPTZ,
            end_time        TIMESTAMPTZ,
            created_by      INTEGER REFERENCES admins(id),
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(stage)
        )`
    );

    // Backward compatibility for older databases that used start_date/end_date.
    await pool.query(
        `DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'admin_stage_dates'
                  AND column_name = 'start_date'
            ) AND NOT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'admin_stage_dates'
                  AND column_name = 'start_time'
            ) THEN
                ALTER TABLE admin_stage_dates RENAME COLUMN start_date TO start_time;
            END IF;

            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'admin_stage_dates'
                  AND column_name = 'end_date'
            ) AND NOT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'admin_stage_dates'
                  AND column_name = 'end_time'
            ) THEN
                ALTER TABLE admin_stage_dates RENAME COLUMN end_date TO end_time;
            END IF;
        END $$;`
    );

    await pool.query(
        `ALTER TABLE admin_stage_dates
         ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ,
         ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ`
    );
}

async function ensureAuthorPasswordResetsTable() {
    await pool.query(
        `CREATE TABLE IF NOT EXISTS author_password_resets (
            id              SERIAL PRIMARY KEY,
            author_id       INTEGER NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
            token_hash      TEXT NOT NULL UNIQUE,
            expires_at      TIMESTAMPTZ NOT NULL,
            used_at         TIMESTAMPTZ,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`
    );

    await pool.query('CREATE INDEX IF NOT EXISTS idx_author_password_resets_author_id ON author_password_resets(author_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_author_password_resets_expires_at ON author_password_resets(expires_at)');
}

async function ensureAuthorsEmailDuplicatesAllowed() {
    await pool.query(
        `DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.table_constraints
                WHERE table_schema = 'public'
                  AND table_name = 'authors'
                  AND constraint_name = 'authors_email_key'
                  AND constraint_type = 'UNIQUE'
            ) THEN
                ALTER TABLE authors DROP CONSTRAINT authors_email_key;
            END IF;
        END $$;`
    );

    await pool.query('CREATE INDEX IF NOT EXISTS idx_authors_email_non_unique ON authors(email)');
}

async function addFirstDraftSubmissionColumns() {
    try {
        await pool.query(`
            ALTER TABLE authors
            ADD COLUMN IF NOT EXISTS first_draft_submitted BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS first_draft_submitted_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS first_draft_file_url TEXT,
            ADD COLUMN IF NOT EXISTS first_draft_file_name VARCHAR(500),
            ADD COLUMN IF NOT EXISTS first_draft_s3_key VARCHAR(500),
            ADD COLUMN IF NOT EXISTS first_draft_local_path TEXT,
            ADD COLUMN IF NOT EXISTS first_draft_file_size INTEGER,
            ADD COLUMN IF NOT EXISTS first_draft_mime_type VARCHAR(100);
        `);

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_authors_first_draft_submitted_at 
            ON authors(first_draft_submitted_at DESC) WHERE first_draft_submitted = TRUE;
        `);

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_authors_first_draft_s3_key 
            ON authors(first_draft_s3_key) WHERE first_draft_s3_key IS NOT NULL;
        `);
    } catch (err) {
        // Column might already exist, which is fine
        if (!err.message.includes('already exists')) {
            throw err;
        }
    }
}

async function addPaperAcknowledgementColumns() {
    await pool.query(`
        ALTER TABLE authors
        ADD COLUMN IF NOT EXISTS acknowledgement_response VARCHAR(40),
        ADD COLUMN IF NOT EXISTS acknowledgement_updated_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS expected_submission_date DATE,
        ADD COLUMN IF NOT EXISTS expected_submission_updated_at TIMESTAMPTZ;
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_authors_acknowledgement_response
        ON authors(acknowledgement_response)
        WHERE acknowledgement_response IS NOT NULL;
    `);
}

async function addInvitationRejectionTrackingColumns() {
    await pool.query(`
        ALTER TABLE authors
        ADD COLUMN IF NOT EXISTS rejection_email_sent_at TIMESTAMPTZ;
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_authors_rejection_email_sent_at
        ON authors(rejection_email_sent_at)
        WHERE rejection_email_sent_at IS NOT NULL;
    `);
}

async function normalizeExistingAuthorCredentialsByEmail() {
    const duplicateEmails = await pool.query(
        `SELECT LOWER(email) AS email_key
         FROM authors
         GROUP BY LOWER(email)
         HAVING COUNT(*) > 1`
    );

    let normalizedCount = 0;
    for (const row of duplicateEmails.rows) {
        const emailKey = row.email_key;
        const canonical = await pool.query(
            `SELECT password_hash, temp_password
             FROM authors
             WHERE LOWER(email) = $1
               AND password_hash IS NOT NULL
               AND temp_password IS NOT NULL
             ORDER BY created_at DESC
             LIMIT 1`,
            [emailKey]
        );

        if (canonical.rowCount === 0) {
            continue;
        }

        await pool.query(
            `UPDATE authors
             SET password_hash = $1,
                 temp_password = $2,
                 updated_at = NOW()
             WHERE LOWER(email) = $3`,
            [canonical.rows[0].password_hash, canonical.rows[0].temp_password, emailKey]
        );

        normalizedCount += 1;
    }

    return normalizedCount;
}

async function getOrCreateChatSession(authorId, client = pool) {
    const existing = await client.query('SELECT id, author_id, created_at, updated_at, last_message_at FROM chat_sessions WHERE author_id = $1', [authorId]);
    if (existing.rowCount > 0) {
        return { row: existing.rows[0], created: false };
    }

    const inserted = await client.query(
        `INSERT INTO chat_sessions (author_id)
         VALUES ($1)
         ON CONFLICT (author_id)
         DO UPDATE SET updated_at = NOW()
         RETURNING id, author_id, created_at, updated_at, last_message_at`,
        [authorId]
    );
    return { row: inserted.rows[0], created: true };
}

async function attachSubmissionToChatIfMissing({ authorId, submissionRow, client = pool }) {
    if (!submissionRow || !submissionRow.id) {
        return;
    }

    const { row: sessionRow } = await getOrCreateChatSession(authorId, client);
    const submissionMarker = JSON.stringify([{ kind: 'first-draft', submissionId: submissionRow.id }]);

    const existing = await client.query(
        `SELECT id
         FROM chat_messages
         WHERE session_id = $1
           AND sender_type = 'system'
           AND attachments @> $2::jsonb
         LIMIT 1`,
        [sessionRow.id, submissionMarker]
    );

    if (existing.rowCount > 0) {
        return;
    }

    try {
        // Generate signed URL for S3 file
        let fileUrl = '';
        if (submissionRow.stored_name && submissionRow.stored_name.startsWith('first-drafts/')) {
            // File is in S3
            fileUrl = await getS3SignedUrl(submissionRow.stored_name);
        } else if (submissionRow.stored_name) {
            // Legacy local file - fallback
            fileUrl = `/uploads/first-drafts/${submissionRow.stored_name}`;
        }

        const attachment = [{
            kind: 'first-draft',
            submissionId: submissionRow.id,
            name: submissionRow.file_name,
            size: Number(submissionRow.file_size || 0),
            type: submissionRow.mime_type || 'application/octet-stream',
            url: fileUrl,
            submittedAt: submissionRow.submitted_at,
            storage: 's3'
        }];

        const message = `First draft submitted: ${submissionRow.file_name}`;
        await client.query(
            `INSERT INTO chat_messages
                (session_id, sender_type, sender_name, message, attachments, read_by_admin, read_by_author)
             VALUES ($1, 'system', 'System', $2, $3::jsonb, FALSE, TRUE)`,
            [sessionRow.id, message, JSON.stringify(attachment)]
        );

        await client.query(
            `UPDATE chat_sessions
             SET updated_at = NOW(),
                 last_message_at = NOW()
             WHERE id = $1`,
            [sessionRow.id]
        );
    } catch (err) {
        console.error('Error attaching submission to chat:', err.message);
        // Don't fail the entire submission if chat attachment fails
    }
}

ensureSubmissionTable()
    .then(() => console.log('Paper submissions table ready'))
    .catch((err) => console.error('Could not ensure paper_submissions table:', err.message));

ensureChatTables()
    .then(() => console.log('Chat tables ready'))
    .catch((err) => console.error('Could not ensure chat tables:', err.message));

ensureAdminDocumentsTable()
    .then(() => console.log('Admin documents table ready'))
    .catch((err) => console.error('Could not ensure admin_documents table:', err.message));

ensureEmailTemplatesTable()
    .then(() => console.log('Email templates table ready'))
    .catch((err) => console.error('Could not ensure email_templates table:', err.message));

ensureAuthorPasswordResetsTable()
    .then(() => console.log('Author password resets table ready'))
    .catch((err) => console.error('Could not ensure author_password_resets table:', err.message));

ensureAdminStageDatesTable()
    .then(() => console.log('✅ Admin stage dates table ready'))
    .catch((err) => console.error('Could not ensure admin_stage_dates table:', err.message));

ensureAuthorsEmailDuplicatesAllowed()
    .then(() => console.log('✅ Authors email duplicates allowed (dedupe by paper_id)'))
    .catch((err) => console.error('Could not update authors email uniqueness:', err.message));

normalizeExistingAuthorCredentialsByEmail()
    .then((count) => console.log(`✅ Normalized duplicate-email credentials for ${count} email group(s)`))
    .catch((err) => console.error('Could not normalize duplicate-email credentials:', err.message));

addFirstDraftSubmissionColumns()
    .then(() => console.log('✅ First draft submission columns added'))
    .catch((err) => console.error('Could not add first draft submission columns:', err.message));

addPaperAcknowledgementColumns()
    .then(() => console.log('✅ Paper acknowledgement columns added'))
    .catch((err) => console.error('Could not add paper acknowledgement columns:', err.message));

addInvitationRejectionTrackingColumns()
    .then(() => console.log('✅ Invitation rejection tracking columns added'))
    .catch((err) => console.error('Could not add invitation rejection tracking columns:', err.message));

const gmailUser = process.env.GMAIL_USER;
const gmailPass = process.env.GMAIL_PASS;
const gmailConfigured = Boolean(gmailUser && gmailPass);

// Gmail configuration — credentials loaded from .env
const transporter = gmailConfigured
    ? nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: gmailUser,
            pass: gmailPass
        },
        tls: {
            rejectUnauthorized: false
        }
    })
    : null;

// Global variable to track email status
let gmailWorking = false;

// Test Gmail connection
if (transporter) {
    transporter.verify((error, success) => {
        if (error) {
            console.log('⚠️  Gmail connection failed:', error.message);
            console.log('📧 Email service will use simulation mode');
            gmailWorking = false;
        } else {
            console.log('✅ Gmail connection successful - Real emails will be sent!');
            gmailWorking = true;
        }
    });
} else {
    console.log('⚠️  Gmail is not configured (GMAIL_USER/GMAIL_PASS missing).');
    console.log('📧 Email service will use simulation mode');
}

// Periodic connection test every 5 minutes
if (transporter) {
    setInterval(() => {
        transporter.verify((error, success) => {
            if (error) {
                if (gmailWorking) {
                    console.log('⚠️  Gmail connection lost:', error.message);
                    gmailWorking = false;
                }
            } else {
                if (!gmailWorking) {
                    console.log('✅ Gmail connection restored!');
                    gmailWorking = true;
                }
            }
        });
    }, 300000);
}

function hashResetToken(token) {
    return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function getRequestBaseUrl(req) {
    const forwardedProto = req.headers['x-forwarded-proto'];
    const protocol = forwardedProto ? String(forwardedProto).split(',')[0].trim() : req.protocol;
    return `${protocol}://${req.get('host')}`;
}

async function sendAuthorPasswordResetEmail({ to, firstName, resetUrl }) {
    const subject = 'IEEE PCIC - Author Password Reset';
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
            <h2 style="color: #1d4ed8;">Reset Your IEEE PCIC Author Password</h2>
            <p>Hi ${firstName || 'Author'},</p>
            <p>We received a password reset request for your author account.</p>
            <p>Please click the button below to set a new password:</p>
            <p style="margin: 24px 0;">
                <a href="${resetUrl}" style="background:#1d4ed8;color:white;padding:12px 18px;text-decoration:none;border-radius:6px;display:inline-block;">Reset Password</a>
            </p>
            <p>If the button does not work, copy and paste this link in your browser:</p>
            <p><a href="${resetUrl}">${resetUrl}</a></p>
            <p style="margin-top: 18px;">This link expires in 30 minutes.</p>
            <p>If you did not request this, you can safely ignore this email.</p>
            <p>Best regards,<br><strong>IEEE PCIC Conference Organization Team</strong></p>
        </div>
    `;

    const mailOptions = {
        from: gmailUser || process.env.SES_FROM_EMAIL || 'noreply@localhost',
        to,
        subject,
        html
    };

    if (transporter && gmailWorking) {
        const result = await transporter.sendMail(mailOptions);
        return { sent: true, mode: 'real', messageId: result.messageId };
    }

    console.log('\n📧 ========== AUTHOR RESET EMAIL SIMULATION ==========');
    console.log(`📬 To: ${to}`);
    console.log(`📝 Subject: ${subject}`);
    console.log(`🔗 Reset Link: ${resetUrl}`);
    console.log('=====================================================\n');

    return { sent: true, mode: 'simulation', messageId: `simulated-${Date.now()}` };
}

// ============================================================
// AUTHOR FORGOT PASSWORD — request reset link via email
// ============================================================
app.post('/authors/forgot-password', async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();

    if (!email) {
        return res.status(400).json({ success: false, message: 'Email is required.' });
    }

    try {
        await pool.query('DELETE FROM author_password_resets WHERE expires_at < NOW() OR used_at IS NOT NULL');

        const authorResult = await pool.query(
            `SELECT id, first_name, email
             FROM authors
             WHERE LOWER(email) = $1
             LIMIT 1`,
            [email]
        );

        // Do not reveal whether account exists.
        if (authorResult.rowCount === 0) {
            return res.json({
                success: true,
                message: 'If the author account exists, a password reset link has been sent.'
            });
        }

        const author = authorResult.rows[0];
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = hashResetToken(rawToken);

        await pool.query('DELETE FROM author_password_resets WHERE author_id = $1 AND used_at IS NULL', [author.id]);
        await pool.query(
            `INSERT INTO author_password_resets (author_id, token_hash, expires_at)
             VALUES ($1, $2, NOW() + INTERVAL '30 minutes')`,
            [author.id, tokenHash]
        );

        const baseUrl = getRequestBaseUrl(req);
        const resetUrl = `${baseUrl}/author-reset-password.html?token=${encodeURIComponent(rawToken)}`;
        await sendAuthorPasswordResetEmail({
            to: author.email,
            firstName: author.first_name,
            resetUrl
        });

        return res.json({
            success: true,
            message: 'If the author account exists, a password reset link has been sent.'
        });
    } catch (err) {
        console.error('POST /authors/forgot-password error:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to process forgot-password request.' });
    }
});

// Validate author reset token before showing password form
app.get('/authors/forgot-password/validate', async (req, res) => {
    const token = String(req.query.token || '').trim();
    if (!token) {
        return res.status(400).json({ success: false, valid: false, message: 'Token is required.' });
    }

    try {
        const tokenHash = hashResetToken(token);
        const result = await pool.query(
            `SELECT id
             FROM author_password_resets
             WHERE token_hash = $1
               AND used_at IS NULL
               AND expires_at > NOW()
             LIMIT 1`,
            [tokenHash]
        );

        return res.json({ success: true, valid: result.rowCount > 0 });
    } catch (err) {
        console.error('GET /authors/forgot-password/validate error:', err.message);
        return res.status(500).json({ success: false, valid: false, message: 'Failed to validate reset token.' });
    }
});

// Confirm author password reset using token
app.post('/authors/forgot-password/reset', async (req, res) => {
    const token = String(req.body.token || '').trim();
    const newPassword = String(req.body.newPassword || '');

    if (!token || !newPassword) {
        return res.status(400).json({ success: false, message: 'Token and new password are required.' });
    }

    if (newPassword.length < 8) {
        return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const tokenHash = hashResetToken(token);
        const resetResult = await client.query(
            `SELECT id, author_id
             FROM author_password_resets
             WHERE token_hash = $1
               AND used_at IS NULL
               AND expires_at > NOW()
             FOR UPDATE`,
            [tokenHash]
        );

        if (resetResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'Reset link is invalid or expired.' });
        }

        const resetRow = resetResult.rows[0];
        const authorEmailResult = await client.query(
            `SELECT email
             FROM authors
             WHERE id = $1
             LIMIT 1`,
            [resetRow.author_id]
        );

        if (authorEmailResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Author account not found.' });
        }

        const targetEmail = String(authorEmailResult.rows[0].email || '').trim().toLowerCase();
        if (!targetEmail) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'Author email is missing for password reset.' });
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);

        // Keep credentials synchronized for all rows sharing the same login email.
        await normalizeCredentialsForEmail(client, targetEmail, passwordHash, newPassword);

        await client.query(
            `UPDATE author_password_resets
             SET used_at = NOW()
             WHERE id = $1`,
            [resetRow.id]
        );

        await client.query(
            `UPDATE author_password_resets
             SET used_at = NOW()
             WHERE author_id IN (
                 SELECT id
                 FROM authors
                 WHERE LOWER(email) = LOWER($1)
             )
               AND used_at IS NULL
               AND id <> $2`,
            [targetEmail, resetRow.id]
        );

        await client.query('COMMIT');
        return res.json({ success: true, message: 'Author password reset successfully.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('POST /authors/forgot-password/reset error:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to reset password.' });
    } finally {
        client.release();
    }
});

// Email sending endpoint
// POST /author-support-email — declined author sends a support message to admin
app.post('/author-support-email', async (req, res) => {
    try {
        const { authorEmail, authorName, message } = req.body;
        if (!authorEmail || !message) {
            return res.status(400).json({ success: false, error: 'Missing required fields.' });
        }
        const adminEmail = gmailUser || process.env.SES_FROM_EMAIL;
        if (!adminEmail) {
            return res.status(500).json({ success: false, error: 'Admin email not configured.' });
        }
        const mailOptions = {
            from: gmailUser,
            to: adminEmail,
            subject: `Support Request from ${authorName || authorEmail}`,
            html: `<div style="font-family:Arial,sans-serif;max-width:600px;">
                <h3>Support Request - IEEE PCIC Dashboard</h3>
                <p><strong>From:</strong> ${authorName || 'Author'} (${authorEmail})</p>
                <p><strong>Message:</strong></p>
                <p style="background:#f8f9fa;padding:12px;border-left:4px solid #6366f1;">${message.replace(/\n/g, '<br>')}</p>
            </div>`
        };
        if (transporter && gmailWorking) {
            await transporter.sendMail(mailOptions);
        }
        res.json({ success: true });
    } catch (err) {
        console.error('Author support email error:', err.message);
        res.status(500).json({ success: false, error: 'Failed to send support email.' });
    }
});

// POST /timeline-schedule — save timeline for a stage
app.post('/timeline-schedule', async (req, res) => {
    try {
        const { stage, startTime, endTime } = req.body;
        if (!stage || !endTime) {
            return res.status(400).json({ success: false, message: 'Stage and endTime are required.' });
        }
        const result = await pool.query(
            `INSERT INTO admin_stage_dates (stage, start_time, end_time, updated_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (stage) DO UPDATE SET start_time = $2, end_time = $3, updated_at = NOW()
             RETURNING id, stage, start_time, end_time`,
            [stage, startTime || null, endTime || null]
        );
        res.json({ success: true, schedule: result.rows[0] });
    } catch (err) {
        console.error('POST /timeline-schedule error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to save timeline.' });
    }
});

// GET /timeline-schedules — retrieve all timelines
app.get('/timeline-schedules', async (req, res) => {
    try {
        const result = await pool.query(`SELECT id, stage, start_time, end_time FROM admin_stage_dates ORDER BY stage`);
        res.json({ success: true, schedules: result.rows });
    } catch (err) {
        console.error('GET /timeline-schedules error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to retrieve timelines.' });
    }
});

const EMAIL_PLACEHOLDER_REGEX = /(\{|\[)([A-Z_]+)(\}|\])/g;
const SIMPLE_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function applyServerEmailTemplate(templateText, variables) {
    const input = String(templateText || '');
    return input.replace(EMAIL_PLACEHOLDER_REGEX, (full, _open, key) => {
        if (Object.prototype.hasOwnProperty.call(variables, key)) {
            return String(variables[key] || '');
        }
        return full;
    });
}

function normalizeRecipientHeader(value, headerLabel = 'CC') {
    if (!value) {
        return '';
    }

    const recipientList = (Array.isArray(value) ? value : String(value).split(/[;,]/))
        .map((entry) => String(entry || '').trim())
        .filter(Boolean);

    if (recipientList.length === 0) {
        return '';
    }

    const invalidEmail = recipientList.find((email) => !SIMPLE_EMAIL_REGEX.test(email));
    if (invalidEmail) {
        throw new Error(`Invalid ${headerLabel} email address: ${invalidEmail}`);
    }

    return recipientList.join(', ');
}

function normalizeCcHeader(ccValue) {
    return normalizeRecipientHeader(ccValue, 'CC');
}

function normalizeBccHeader(bccValue) {
    return normalizeRecipientHeader(bccValue, 'BCC');
}

async function buildServerEmailVariables(payload) {
    const maybeAuthorId = Number(payload?.authorId);
    let authorRow = null;

    if (Number.isInteger(maybeAuthorId) && maybeAuthorId > 0) {
        try {
            const authorResult = await pool.query(
                `SELECT first_name, last_name, email, paper_title, paper_id, user_id, temp_password
                 FROM authors
                 WHERE id = $1
                 LIMIT 1`,
                [maybeAuthorId]
            );
            authorRow = authorResult.rows[0] || null;
        } catch (error) {
            console.warn('Could not load author details for template replacement:', error.message);
        }
    }

    const firstName = payload?.firstName || authorRow?.first_name || '';
    const lastName = payload?.lastName || authorRow?.last_name || '';
    const email = payload?.to || payload?.email || authorRow?.email || '';
    const paperTitle = payload?.paperTitle || authorRow?.paper_title || 'N/A';
    const paperId = payload?.paperId || authorRow?.paper_id || '';
    const userId = payload?.userId || authorRow?.user_id || '';
    const password = payload?.password || authorRow?.temp_password || '';

    return {
        AUTHOR_FIRST_NAME: firstName,
        AUTHOR_LAST_NAME: lastName,
        AUTHOR_FULL_NAME: `${firstName} ${lastName}`.trim(),
        PAPER_TITLE: paperTitle,
        PAPER_ID: paperId,
        EMAIL: email,
        USERNAME: email,
        PASSWORD: password
    };
}

app.post('/send-email', async (req, res) => {
    try {
        const { to, subject, emailBody, firstName, authorId, templateType, cc, bcc } = req.body;
        const normalizedTemplateType = typeof templateType === 'string' ? templateType.trim().toLowerCase() : '';
        let resolvedSubject = subject;
        let resolvedEmailBody = emailBody;
        let ccHeader = '';
        let bccHeader = '';

        const markProgressFromEmail = async (messageId, mode) => {
            try {
                const maybeAuthorId = Number(authorId);
                if (!Number.isInteger(maybeAuthorId) || maybeAuthorId <= 0) {
                    return;
                }

                let stage = null;
                if (normalizedTemplateType === 'invitation') {
                    stage = 'invitation-send';
                } else if (normalizedTemplateType === 'first-reminder') {
                    stage = 'first-draft-reminder';
                } else if (normalizedTemplateType === 'final-submission') {
                    stage = 'paper-submission';
                } else if (/invitation/i.test(resolvedSubject || '')) {
                    stage = 'invitation-send';
                } else if (/first\s*draft\s*submission\s*reminder/i.test(resolvedSubject || '')) {
                    stage = 'first-draft-reminder';
                } else if (/final\s*paper\s*submission/i.test(resolvedSubject || '')) {
                    stage = 'paper-submission';
                }

                if (!stage) {
                    return;
                }

                const notes = `${stage} email sent via ${mode} (${messageId})`;
                const updateResult = await pool.query(
                    `UPDATE author_progress
                       SET status = 'completed',
                           completed_at = COALESCE(completed_at, NOW()),
                           notes = $1,
                           updated_at = NOW()
                     WHERE author_id = $2
                       AND stage = $3`,
                    [notes, maybeAuthorId, stage]
                );

                if (updateResult.rowCount === 0) {
                    console.warn(`Skipping progress update: author/stage not found (${maybeAuthorId}, ${stage}).`);
                }
            } catch (progressError) {
                console.warn('Progress update skipped:', progressError.message);
            }
        };

        if (!to || !subject || !emailBody) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: to, subject, emailBody'
            });
        }

        try {
            ccHeader = normalizeCcHeader(cc);
            bccHeader = normalizeBccHeader(bcc);
        } catch (ccError) {
            return res.status(400).json({
                success: false,
                error: ccError.message
            });
        }

        const variables = await buildServerEmailVariables(req.body);
        resolvedSubject = applyServerEmailTemplate(subject, variables);
        resolvedEmailBody = applyServerEmailTemplate(emailBody, variables);

        // If this is an invitation email, reset declined authors back to pending
        // so they see the accept/decline prompt again when they log in
        const isInvitationEmail = normalizedTemplateType === 'invitation' || /invitation/i.test(resolvedSubject || '');
        if (isInvitationEmail && authorId) {
            const maybeId = Number(authorId);
            if (Number.isInteger(maybeId) && maybeId > 0) {
                await pool.query(
                    `UPDATE authors
                        SET invitation_status = CASE
                                WHEN invitation_status = 'declined' THEN 'pending'
                                ELSE invitation_status
                            END,
                            rejection_email_sent_at = NULL
                      WHERE id = $1
                        AND (invitation_status = 'declined' OR rejection_email_sent_at IS NOT NULL)`,
                    [maybeId]
                );
            }
        }

        const mailOptions = {
            from: gmailUser || process.env.SES_FROM_EMAIL || 'noreply@localhost',
            to: to,
            subject: resolvedSubject,
            html: resolvedEmailBody,
            ...(ccHeader ? { cc: ccHeader } : {}),
            ...(bccHeader ? { bcc: bccHeader } : {})
        };

        if (transporter && gmailWorking) {
            // Try to send real email
            try {
                const result = await transporter.sendMail(mailOptions);
                console.log(`✅ Real email sent to ${to}:`, result.messageId);
                await markProgressFromEmail(result.messageId, 'real');
                
                res.json({
                    success: true,
                    messageId: result.messageId,
                    message: `Email sent successfully to ${to}`,
                    mode: 'real'
                });
                return;
            } catch (emailError) {
                console.log('❌ Real email failed:', emailError.message);
                console.log('📧 Switching to simulation mode for this email');
                gmailWorking = false;
            }
        }

        // Simulation mode (fallback)
        console.log('\n📧 ========== EMAIL SIMULATION ==========');
        console.log(`📬 To: ${to}`);
        if (ccHeader) {
            console.log(`📬 CC: ${ccHeader}`);
        }
        if (bccHeader) {
            console.log(`📬 BCC: ${bccHeader}`);
        }
        console.log(`📝 Subject: ${subject}`);
        console.log(`👤 Recipient: ${firstName || 'User'}`);
        console.log(`📄 Body Preview: ${emailBody.substring(0, 100)}...`);
        console.log('=========================================\n');

        const simulatedMessageId = 'simulated-' + Date.now();
        await markProgressFromEmail(simulatedMessageId, 'simulation');

        res.json({
            success: true,
            messageId: simulatedMessageId,
            message: `Email simulated successfully for ${to}`,
            mode: 'simulation',
            note: transporter
                ? 'Gmail authentication failed - email was simulated'
                : 'Gmail is not configured - email was simulated'
        });

    } catch (error) {
        console.error('Email service error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================================
// BULK EMAIL endpoint — send multiple emails in parallel
// ============================================================
app.post('/send-bulk-emails', async (req, res) => {
    try {
        const { emails } = req.body;

        if (!emails || !Array.isArray(emails) || emails.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: emails (array)'
            });
        }

        // Validate each email has required fields
        for (const email of emails) {
            if (!email.to || !email.subject || !email.emailBody) {
                return res.status(400).json({
                    success: false,
                    error: 'Each email must have: to, subject, emailBody'
                });
            }
        }

        // Helper function to send a single email
        const sendSingleEmail = async (emailData) => {
            const { to, subject, emailBody, firstName, authorId, templateType, cc, bcc } = emailData;
            const normalizedTemplateType = typeof templateType === 'string' ? templateType.trim().toLowerCase() : '';
            let resolvedSubject = subject;
            let resolvedEmailBody = emailBody;
            let ccHeader = '';
            let bccHeader = '';

            const markProgressFromEmail = async (messageId, mode) => {
                try {
                    const maybeAuthorId = Number(authorId);
                    if (!Number.isInteger(maybeAuthorId) || maybeAuthorId <= 0) {
                        return;
                    }

                    let stage = null;
                    if (normalizedTemplateType === 'invitation') {
                        stage = 'invitation-send';
                    } else if (normalizedTemplateType === 'first-reminder') {
                        stage = 'first-draft-reminder';
                    } else if (normalizedTemplateType === 'final-submission') {
                        stage = 'paper-submission';
                    } else if (/invitation/i.test(resolvedSubject || '')) {
                        stage = 'invitation-send';
                    } else if (/first\s*draft\s*submission\s*reminder/i.test(resolvedSubject || '')) {
                        stage = 'first-draft-reminder';
                    } else if (/final\s*paper\s*submission/i.test(resolvedSubject || '')) {
                        stage = 'paper-submission';
                    }

                    if (!stage) {
                        return;
                    }

                    const notes = `${stage} email sent via ${mode} (${messageId})`;
                    await pool.query(
                        `UPDATE author_progress
                         SET status = 'completed',
                             completed_at = COALESCE(completed_at, NOW()),
                             notes = $1,
                             updated_at = NOW()
                         WHERE author_id = $2
                           AND stage = $3`,
                        [notes, maybeAuthorId, stage]
                    );
                } catch (progressError) {
                    console.warn('Progress update skipped:', progressError.message);
                }
            };

            try {
                ccHeader = normalizeCcHeader(cc);
                bccHeader = normalizeBccHeader(bcc);
                const variables = await buildServerEmailVariables(emailData);
                resolvedSubject = applyServerEmailTemplate(subject, variables);
                resolvedEmailBody = applyServerEmailTemplate(emailBody, variables);

                // Reset declined authors back to pending if it's an invitation
                const isInvitationEmail = normalizedTemplateType === 'invitation' || /invitation/i.test(resolvedSubject || '');
                if (isInvitationEmail && authorId) {
                    const maybeId = Number(authorId);
                    if (Number.isInteger(maybeId) && maybeId > 0) {
                        await pool.query(
                            `UPDATE authors
                                SET invitation_status = CASE
                                        WHEN invitation_status = 'declined' THEN 'pending'
                                        ELSE invitation_status
                                    END,
                                    rejection_email_sent_at = NULL
                              WHERE id = $1
                                AND (invitation_status = 'declined' OR rejection_email_sent_at IS NOT NULL)`,
                            [maybeId]
                        );
                    }
                }

                const mailOptions = {
                    from: gmailUser || process.env.SES_FROM_EMAIL || 'noreply@localhost',
                    to: to,
                    subject: resolvedSubject,
                    html: resolvedEmailBody,
                    ...(ccHeader ? { cc: ccHeader } : {}),
                    ...(bccHeader ? { bcc: bccHeader } : {})
                };

                let messageId, mode;

                if (transporter && gmailWorking) {
                    try {
                        const result = await transporter.sendMail(mailOptions);
                        messageId = result.messageId;
                        mode = 'real';
                        console.log(`✅ Real email sent to ${to}: ${messageId}`);
                    } catch (emailError) {
                        console.log(`❌ Real email failed for ${to}:`, emailError.message);
                        gmailWorking = false;
                        // Fall through to simulation mode
                        messageId = 'simulated-' + Date.now();
                        mode = 'simulation';
                        console.log(`📧 Simulated email for ${to}: ${messageId}`);
                    }
                } else {
                    messageId = 'simulated-' + Date.now();
                    mode = 'simulation';
                    console.log(`📧 Simulated email for ${to}: ${messageId}`);
                }

                await markProgressFromEmail(messageId, mode);

                return {
                    success: true,
                    to,
                    messageId,
                    mode
                };
            } catch (error) {
                console.error(`Error sending email to ${to}:`, error.message);
                return {
                    success: false,
                    to,
                    error: error.message
                };
            }
        };

        // Send all emails in parallel
        const startTime = Date.now();
        const results = await Promise.all(emails.map(sendSingleEmail));
        const durationMs = Date.now() - startTime;

        const successCount = results.filter(r => r.success).length;
        const failureCount = results.filter(r => !r.success).length;

        console.log(`\n✉️  BULK EMAIL SUMMARY:`);
        console.log(`   Total: ${emails.length} | Success: ${successCount} | Failed: ${failureCount}`);
        console.log(`   Duration: ${(durationMs / 1000).toFixed(2)}s\n`);

        res.json({
            success: true,
            summary: {
                total: emails.length,
                successCount,
                failureCount,
                durationMs
            },
            results
        });

    } catch (error) {
        console.error('Bulk email service error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================================
// LOGIN endpoint — validates against admins table in RDS
// ============================================================
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    try {
        // Allow admin login by username or email.
        const result = await pool.query(
            `SELECT id, username, password_hash, full_name, email, role, is_active
             FROM admins
             WHERE LOWER(username) = LOWER($1)
                OR LOWER(email) = LOWER($1)
             LIMIT 1`,
            [username.trim()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid username or password' });
        }

        const admin = result.rows[0];

        if (!admin.is_active) {
            return res.status(403).json({ success: false, message: 'Account is disabled. Contact your administrator.' });
        }

        // Compare password with bcrypt hash
        const passwordMatch = await bcrypt.compare(password, admin.password_hash);
        if (!passwordMatch) {
            return res.status(401).json({ success: false, message: 'Invalid username or password' });
        }

        // Update last_login timestamp
        await pool.query('UPDATE admins SET last_login = NOW() WHERE id = $1', [admin.id]);

        // Return safe user object (no password hash)
        return res.json({
            success: true,
            user: {
                id: admin.id,
                username: admin.username,
                fullName: admin.full_name,
                email: admin.email,
                role: admin.role,
                userType: 'admin'
            }
        });

    } catch (err) {
        console.error('Login error:', err.message);
        return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }
});

// ============================================================
// AUTHOR LOGIN endpoint — validates against authors table
// ============================================================
app.post('/author-login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    try {
        const result = await pool.query(
            `SELECT id, user_id, first_name, last_name, email, paper_title, paper_id,
                    password_hash, invitation_status, current_stage, created_at, first_login_completed
             FROM authors
             WHERE LOWER(email) = LOWER($1)
                OR LOWER(user_id) = LOWER($1)
             ORDER BY CASE WHEN LOWER(user_id) = LOWER($1) THEN 0 ELSE 1 END, created_at DESC
             LIMIT 1`,
            [username.trim()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        const author = result.rows[0];

        const passwordMatch = await bcrypt.compare(password, author.password_hash);
        if (!passwordMatch) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        // Mark first login as completed for ALL papers by this author
        // (same email may have multiple papers in the system)
        if (!author.first_login_completed) {
            await pool.query(
                `UPDATE authors
                 SET first_login_completed = TRUE, updated_at = NOW()
                 WHERE LOWER(email) = LOWER($1) OR LOWER(user_id) = LOWER($1)`,
                [username.trim()]
            );
        }

        const progressResult = await pool.query(
            `SELECT stage, status, completed_at, notes
             FROM author_progress
             WHERE author_id = $1`,
            [author.id]
        );

        const progress = { currentStage: author.current_stage, stages: {} };
        const defaultStages = [
            'logins-created', 'invitation-send', 'first-draft-reminder',
            'paper-submission', 'review-in-progress'
        ];
        for (const stage of defaultStages) {
            progress.stages[stage] = { status: 'pending', completedAt: null, notes: '' };
        }
        for (const row of progressResult.rows) {
            progress.stages[row.stage] = {
                status: row.status,
                completedAt: row.completed_at,
                notes: row.notes || ''
            };
        }

        return res.json({
            success: true,
            user: {
                id: author.id,
                username: author.email,
                userId: author.user_id,
                firstName: author.first_name,
                lastName: author.last_name,
                fullName: author.first_name + ' ' + author.last_name,
                email: author.email,
                paperTitle: author.paper_title,
                paperId: author.paper_id,
                invitationStatus: author.invitation_status,
                currentStage: author.current_stage,
                firstLoginCompleted: true,
                progress,
                role: 'author',
                userType: 'author'
            }
        });

    } catch (err) {
        console.error('Author login error:', err.message);
        return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }
});

// ── Authors API ──────────────────────────────────────────────────────────────

const AUTHOR_PROGRESS_STAGES = [
    'logins-created', 'invitation-send', 'first-draft-reminder',
    'paper-submission', 'review-in-progress'
];

function sanitizeAuthorText(value) {
    return String(value || '').trim().replace(/[<>"'`]/g, '');
}

function normalizeExcelHeader(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getExcelValueByAliases(row, aliases) {
    const aliasSet = new Set(aliases.map(normalizeExcelHeader));
    for (const [key, value] of Object.entries(row || {})) {
        if (aliasSet.has(normalizeExcelHeader(key))) {
            return value;
        }
    }
    return '';
}

function splitAuthorName(fullName) {
    const cleaned = sanitizeAuthorText(fullName).replace(/\s+/g, ' ').trim();
    if (!cleaned) {
        return { firstName: 'Unknown', lastName: 'Author' };
    }
    const parts = cleaned.split(' ');
    if (parts.length === 1) {
        return { firstName: parts[0], lastName: 'Author' };
    }
    return {
        firstName: parts.slice(0, -1).join(' '),
        lastName: parts[parts.length - 1]
    };
}

function getUserIdPrefix(firstName, lastName) {
    const first = sanitizeAuthorText(firstName) || 'au';
    const last = sanitizeAuthorText(lastName) || 'th';
    return (first.substring(0, 2) + last.substring(0, 2)).toLowerCase().replace(/[^a-z0-9]/g, '') || 'auid';
}

function generateUniqueUserIdFromSet(existingUserIds, firstName, lastName) {
    const prefix = getUserIdPrefix(firstName, lastName);

    for (let attempt = 0; attempt < 8; attempt++) {
        const suffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        const candidate = prefix + suffix;
        if (!existingUserIds.has(candidate)) {
            existingUserIds.add(candidate);
            return candidate;
        }
    }

    const fallback = `${prefix}${Date.now().toString().slice(-6)}`;
    existingUserIds.add(fallback);
    return fallback;
}

function generateTemporaryPassword(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let plainPassword = '';
    for (let i = 0; i < length; i++) {
        plainPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return plainPassword;
}

async function seedAuthorProgressBatch(client, authorIds) {
    if (!Array.isArray(authorIds) || authorIds.length === 0) return;

    await client.query(
        `INSERT INTO author_progress (author_id, stage, status, completed_at, notes)
         SELECT
            a.author_id,
            s.stage,
            CASE WHEN s.stage = 'logins-created' THEN 'completed' ELSE 'pending' END,
            CASE WHEN s.stage = 'logins-created' THEN NOW() ELSE NULL END,
            CASE WHEN s.stage = 'logins-created' THEN 'Account created successfully' ELSE '' END
         FROM unnest($1::int[]) AS a(author_id)
         CROSS JOIN unnest($2::text[]) AS s(stage)
         ON CONFLICT (author_id, stage) DO NOTHING`,
        [authorIds, AUTHOR_PROGRESS_STAGES]
    );
}

async function normalizeCredentialsForEmailBatch(client, credentialsByEmail) {
    const emails = [];
    const passwordHashes = [];
    const tempPasswords = [];

    for (const [email, credential] of credentialsByEmail.entries()) {
        const safeEmail = String(email || '').trim().toLowerCase();
        if (!safeEmail || !credential || !credential.passwordHash || !credential.plainPassword) continue;
        emails.push(safeEmail);
        passwordHashes.push(credential.passwordHash);
        tempPasswords.push(credential.plainPassword);
    }

    if (emails.length === 0) return;

    await client.query(
        `WITH creds AS (
            SELECT *
            FROM unnest($1::text[], $2::text[], $3::text[])
                 AS t(email_key, password_hash, temp_password)
         )
         UPDATE authors AS a
         SET password_hash = c.password_hash,
             temp_password = c.temp_password,
             updated_at = NOW()
         FROM creds AS c
         WHERE LOWER(a.email) = c.email_key`,
        [emails, passwordHashes, tempPasswords]
    );
}

async function normalizeCredentialsForEmail(client, email, passwordHash, plainPassword) {
    const safeEmail = String(email || '').trim().toLowerCase();
    if (!safeEmail || !passwordHash || !plainPassword) return;

    await client.query(
        `UPDATE authors
         SET password_hash = $2,
             temp_password = $3,
             updated_at = NOW()
         WHERE LOWER(email) = LOWER($1)`,
        [safeEmail, passwordHash, plainPassword]
    );
}

// POST /authors/bulk-upload — import authors from Excel and dedupe by Abstract Number (paper_id)
app.post('/authors/bulk-upload', uploadAuthorExcel.single('authorsFile'), async (req, res) => {
    const bulkStartMs = Date.now();
    const createdByAdminId = Number(req.body.createdByAdminId);

    if (!Number.isInteger(createdByAdminId) || createdByAdminId <= 0) {
        return res.status(400).json({ success: false, message: 'Admin session required.' });
    }

    if (!req.file) {
        return res.status(400).json({ success: false, message: 'Excel file is required (.xlsx or .xls).' });
    }

    let rows = [];
    try {
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
            return res.status(400).json({ success: false, message: 'Excel file has no sheets.' });
        }
        rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], { defval: '' });
    } catch (err) {
        return res.status(400).json({ success: false, message: `Invalid Excel file: ${err.message}` });
    }

    if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ success: false, message: 'Excel file has no data rows.' });
    }

    const dedupByPaperId = new Map();
    let duplicatesRemoved = 0;
    let skippedMissingPaperId = 0;

    for (const row of rows) {
        const paperIdRaw = getExcelValueByAliases(row, ['Abstract Number', 'Paper ID']);
        const paperId = sanitizeAuthorText(paperIdRaw);
        if (!paperId) {
            skippedMissingPaperId += 1;
            continue;
        }
        if (dedupByPaperId.has(paperId)) {
            duplicatesRemoved += 1;
            continue;
        }

        const authorFullName = getExcelValueByAliases(row, ['Author 1']);
        const { firstName, lastName } = splitAuthorName(authorFullName);

        dedupByPaperId.set(paperId, {
            paperId,
            paperTitle: sanitizeAuthorText(getExcelValueByAliases(row, ['Title'])),
            abstractInfo: sanitizeAuthorText(getExcelValueByAliases(row, ['Abstract'])),
            firstName: sanitizeAuthorText(firstName),
            lastName: sanitizeAuthorText(lastName),
            company: sanitizeAuthorText(getExcelValueByAliases(row, ['Author 1 Affliation', 'Author 1 Affiliation', 'Affiliation', 'Company'])),
            email: sanitizeAuthorText(getExcelValueByAliases(row, ['Email'])).toLowerCase(),
            phone: sanitizeAuthorText(getExcelValueByAliases(row, ['Phone']))
        });
    }

    const normalizedRows = Array.from(dedupByPaperId.values());
    if (normalizedRows.length === 0) {
        return res.status(400).json({ success: false, message: 'No valid rows found. Abstract Number (Paper ID) is required.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const adminCheck = await client.query('SELECT id FROM admins WHERE id = $1', [createdByAdminId]);
        if (adminCheck.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Admin account not found.' });
        }

        const paperIds = normalizedRows.map((r) => r.paperId);
        const existingResult = await client.query(
            `SELECT id, paper_id
             FROM authors
             WHERE paper_id = ANY($1::text[])`,
            [paperIds]
        );
        const existingByPaperId = new Map(existingResult.rows.map((r) => [r.paper_id, r.id]));

        const userIdPrefixes = Array.from(new Set(normalizedRows.map((r) => getUserIdPrefix(r.firstName, r.lastName))));
        const existingUserIdsResult = await client.query(
            `SELECT user_id
             FROM authors
             WHERE user_id IS NOT NULL
               AND LEFT(user_id, 4) = ANY($1::text[])`,
            [userIdPrefixes]
        );
        const existingUserIds = new Set(existingUserIdsResult.rows.map((r) => r.user_id));

        const emailKeys = Array.from(new Set(
            normalizedRows
                .map((r) => String(r.email || '').trim().toLowerCase())
                .filter(Boolean)
        ));

        const existingEmailCredentialMap = new Map();
        if (emailKeys.length > 0) {
            const existingEmailCredentialsResult = await client.query(
                `SELECT LOWER(email) AS email_key, password_hash, temp_password, created_at
                 FROM authors
                 WHERE LOWER(email) = ANY($1::text[])
                 ORDER BY LOWER(email), created_at DESC`,
                [emailKeys]
            );

            for (const row of existingEmailCredentialsResult.rows) {
                if (!existingEmailCredentialMap.has(row.email_key)) {
                    existingEmailCredentialMap.set(row.email_key, {
                        passwordHash: row.password_hash,
                        plainPassword: row.temp_password || ''
                    });
                }
            }
        }

        const generatedCredentialByEmail = new Map();

        const emailsNeedingGeneratedCredentials = emailKeys.filter((emailKey) => !existingEmailCredentialMap.has(emailKey));
        if (emailsNeedingGeneratedCredentials.length > 0) {
            const generatedCredentials = await Promise.all(
                emailsNeedingGeneratedCredentials.map(async (emailKey) => {
                    const plainPassword = generateTemporaryPassword(8);
                    const passwordHash = await bcrypt.hash(plainPassword, BULK_UPLOAD_BCRYPT_ROUNDS);
                    return [emailKey, { plainPassword, passwordHash }];
                })
            );

            for (const [emailKey, credential] of generatedCredentials) {
                generatedCredentialByEmail.set(emailKey, credential);
            }
        }

        let created = 0;
        let updated = 0;
        let skippedMissingRequired = 0;
        const touchedEmailCredentials = new Map();
        const preparedRows = [];
        const createdPaperIds = [];

        for (const entry of normalizedRows) {
            if (!entry.email || !entry.company || !entry.paperTitle || !entry.abstractInfo) {
                skippedMissingRequired += 1;
                continue;
            }

            const safeFirst = entry.firstName || 'Unknown';
            const safeLast = entry.lastName || 'Author';
            const safeEmail = entry.email;
            const safeCompany = entry.company;
            const safePaperTitle = entry.paperTitle;
            const safeAbstract = entry.abstractInfo;
            const safePhone = entry.phone || null;

            let credential = existingEmailCredentialMap.get(safeEmail) || generatedCredentialByEmail.get(safeEmail);
            if (!credential) {
                const plainPassword = generateTemporaryPassword(8);
                const passwordHash = await bcrypt.hash(plainPassword, BULK_UPLOAD_BCRYPT_ROUNDS);
                credential = { plainPassword, passwordHash };
                generatedCredentialByEmail.set(safeEmail, credential);
            }

            const userId = generateUniqueUserIdFromSet(existingUserIds, safeFirst, safeLast);
            const exists = existingByPaperId.has(entry.paperId);
            if (!exists) {
                createdPaperIds.push(entry.paperId);
            }

            preparedRows.push({
                userId,
                passwordHash: credential.passwordHash,
                firstName: safeFirst,
                lastName: safeLast,
                email: safeEmail,
                phone: safePhone,
                company: safeCompany,
                paperTitle: safePaperTitle,
                abstractInfo: safeAbstract,
                paperId: entry.paperId,
                tempPassword: credential.plainPassword,
                createdByAdminId
            });
            touchedEmailCredentials.set(safeEmail, credential);
        }

        if (preparedRows.length > 0) {
            await client.query(
                `INSERT INTO authors
                    (user_id, password_hash, first_name, last_name, email, phone, company,
                     paper_title, abstract_info, paper_id, temp_password, created_by_admin_id)
                 SELECT *
                 FROM unnest(
                    $1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[],
                    $7::text[], $8::text[], $9::text[], $10::text[], $11::text[], $12::int[]
                 )
                 ON CONFLICT (paper_id)
                 DO UPDATE SET
                    first_name = EXCLUDED.first_name,
                    last_name = EXCLUDED.last_name,
                    email = EXCLUDED.email,
                    phone = EXCLUDED.phone,
                    company = EXCLUDED.company,
                    paper_title = EXCLUDED.paper_title,
                    abstract_info = EXCLUDED.abstract_info,
                    password_hash = EXCLUDED.password_hash,
                    temp_password = EXCLUDED.temp_password,
                    updated_at = NOW()`,
                [
                    preparedRows.map((r) => r.userId),
                    preparedRows.map((r) => r.passwordHash),
                    preparedRows.map((r) => r.firstName),
                    preparedRows.map((r) => r.lastName),
                    preparedRows.map((r) => r.email),
                    preparedRows.map((r) => r.phone),
                    preparedRows.map((r) => r.company),
                    preparedRows.map((r) => r.paperTitle),
                    preparedRows.map((r) => r.abstractInfo),
                    preparedRows.map((r) => r.paperId),
                    preparedRows.map((r) => r.tempPassword),
                    preparedRows.map((r) => r.createdByAdminId)
                ]
            );
        }

        created = createdPaperIds.length;
        updated = preparedRows.length - created;

        const createdAuthorIds = createdPaperIds.length > 0
            ? (await client.query('SELECT id FROM authors WHERE paper_id = ANY($1::text[])', [createdPaperIds])).rows.map((r) => r.id)
            : [];

        await seedAuthorProgressBatch(client, createdAuthorIds);

        await normalizeCredentialsForEmailBatch(client, touchedEmailCredentials);

        await client.query('COMMIT');
        clearAuthorsCache();

        const durationMs = Date.now() - bulkStartMs;
        console.log(`✅ Bulk upload processed ${preparedRows.length} row(s) in ${durationMs}ms`);

        return res.json({
            success: true,
            message: 'Bulk upload processed successfully.',
            summary: {
                totalRowsInFile: rows.length,
                processedRows: normalizedRows.length,
                created,
                updated,
                duplicatesRemovedByPaperId: duplicatesRemoved,
                skippedMissingPaperId,
                skippedMissingRequired,
                durationMs
            }
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('POST /authors/bulk-upload error:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to process bulk upload.' });
    } finally {
        client.release();
    }
});

// GET /author/my-papers — returns all papers for a given author email (used by author dashboard)
// Only returns papers where invitation-send stage is marked as completed
app.get('/author/my-papers', async (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });
    try {
        const result = await pool.query(
            `SELECT a.id, a.paper_id, a.paper_title, a.invitation_status, a.status, a.created_at,
                    a.acknowledgement_response, a.acknowledgement_updated_at,
                    a.expected_submission_date, a.expected_submission_updated_at,
                    a.first_draft_submitted, a.first_draft_submitted_at, a.first_draft_file_name, a.email
             FROM authors a
             INNER JOIN author_progress ap ON a.id = ap.author_id
             WHERE LOWER(a.email) = LOWER($1)
             AND ap.stage = 'invitation-send'
             AND ap.status = 'completed'
             ORDER BY a.created_at ASC`,
            [email.trim()]
        );
        
        // Format dates to prevent UTC conversion in JSON serialization
        const formattedPapers = result.rows.map(row => ({
            ...row,
            expected_submission_date: formatLocalDate(row.expected_submission_date)
        }));
        
        console.log(`📄 GET /author/my-papers returned ${formattedPapers.length} papers (invitation-send completed)`);
        return res.json({ success: true, papers: formattedPapers });
    } catch (err) {
        console.error('GET /author/my-papers error:', err.message);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

// GET /authors — return all authors (for Manage Credentials modal)
// Simple in-memory cache with 30 second TTL
let authorsCache = null;
let authorsCacheTime = 0;

app.get('/authors', async (req, res) => {
    try {
        // Check cache first
        const now = Date.now();
        if (authorsCache && (now - authorsCacheTime) < 30000) {
            return res.json(authorsCache);
        }

        // Single query with LEFT JOIN to avoid N+1 queries
        const result = await pool.query(
            `SELECT 
                a.id, a.user_id, a.first_name, a.last_name, a.email, a.phone, a.company,
                a.paper_title, a.abstract_info, a.paper_id, a.status, a.invitation_status,
                a.current_stage, a.temp_password, a.accepted_at, a.created_at,
                a.first_draft_submitted, a.first_draft_submitted_at, a.first_draft_file_name,
                a.acknowledgement_response, a.expected_submission_date, a.first_login_completed,
                a.rejection_email_sent_at,
                jsonb_agg(jsonb_build_object('stage', ap.stage, 'status', ap.status, 'completedAt', ap.completed_at, 'notes', ap.notes))  
                    FILTER (WHERE ap.stage IS NOT NULL) as progress_rows
             FROM authors a
             LEFT JOIN author_progress ap ON a.id = ap.author_id
             GROUP BY a.id
             ORDER BY a.created_at DESC`
        );

        const defaultStages = [
            'logins-created', 'invitation-send', 'first-draft-reminder',
            'paper-submission', 'review-in-progress'
        ];
        
        const progressByAuthor = new Map();
        for (const row of result.rows) {
            const base = { currentStage: null, stages: {} };
            for (const stage of defaultStages) {
                base.stages[stage] = { status: 'pending', completedAt: null, notes: '' };
            }
            
            if (row.progress_rows) {
                for (const p of row.progress_rows) {
                    base.stages[p.stage] = {
                        status: p.status,
                        completedAt: p.completedAt,
                        notes: p.notes || ''
                    };
                }
            }
            progressByAuthor.set(row.id, base);
        }

        // Map snake_case DB columns to camelCase for the frontend
        const authors = result.rows.map(r => ({
            id:               r.id,
            userId:           r.user_id,
            firstName:        r.first_name,
            lastName:         r.last_name,
            email:            r.email,
            phone:            r.phone,
            company:          r.company,
            paperTitle:       r.paper_title,
            abstractInfo:     r.abstract_info,
            paperId:          r.paper_id,
            status:           r.status,
            invitationStatus: r.invitation_status,
            invitationResponseDate: r.accepted_at,
            rejectionEmailSentAt: r.rejection_email_sent_at,
            currentStage:     r.current_stage,
            firstLoginCompleted: r.first_login_completed || false,
            progress:         progressByAuthor.get(r.id) || { currentStage: r.current_stage, stages: {} },
            firstDraftSubmitted: Boolean(r.first_draft_submitted),
            firstDraftSubmittedAt: r.first_draft_submitted_at,
            firstDraftFileName: r.first_draft_file_name,
            acknowledgementResponse: r.acknowledgement_response,
            expectedSubmissionDate: formatLocalDate(r.expected_submission_date),
            password:         r.temp_password,   // shown in admin credentials table
            createdAt:        r.created_at
        }));
        res.json({ success: true, authors });
        
        // Cache result with 30 second TTL
        authorsCache = { success: true, authors };
        authorsCacheTime = Date.now();
    } catch (err) {
        console.error('GET /authors error:', err.message);
        // Return cached data on error
        if (authorsCache) {
            return res.json(authorsCache);
        }
        res.status(500).json({ success: false, message: 'Failed to fetch authors.' });
    }
});

// Clear authors cache on write operations
const clearAuthorsCache = () => {
    authorsCache = null;
};

// POST /authors — create a new author (admin only)
app.post('/authors', async (req, res) => {
    const { firstName, lastName, email, phone, company, paperTitle, abstractInfo, paperId, createdByAdminId } = req.body;

    // Basic validation
    if (!firstName || !lastName || !email || !company || !paperTitle || !abstractInfo || !paperId) {
        return res.status(400).json({ success: false, message: 'All required fields must be filled.' });
    }
    if (!createdByAdminId) {
        return res.status(400).json({ success: false, message: 'Admin session required.' });
    }

    // Sanitize inputs
    const safeName = (s) => String(s).trim().replace(/[<>"'`]/g, '');
    const safeFirst   = safeName(firstName);
    const safeLast    = safeName(lastName);
    const safeEmail   = String(email).trim().toLowerCase();
    const safeCompany = safeName(company);
    const safePaperTitle = safeName(paperTitle);
    const safePaperId    = safeName(paperId);
    const safeAbstract   = String(abstractInfo).trim().replace(/[<>"'`]/g, '');
    const safePhone      = phone ? safeName(phone) : null;

    // Generate userId (first2 of first name + first2 of last name + 3 random digits)
    const prefix = (safeFirst.substring(0, 2) + safeLast.substring(0, 2)).toLowerCase();
    const suffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const userId = prefix + suffix;

    // Reuse existing credentials if this email already exists (same password per email)
    const existingCredential = await pool.query(
        `SELECT password_hash, temp_password
         FROM authors
         WHERE LOWER(email) = LOWER($1)
         ORDER BY created_at DESC
         LIMIT 1`,
        [safeEmail]
    );

    let plainPassword;
    let passwordHash;
    if (existingCredential.rowCount > 0 && existingCredential.rows[0].password_hash && existingCredential.rows[0].temp_password) {
        plainPassword = existingCredential.rows[0].temp_password;
        passwordHash = existingCredential.rows[0].password_hash;
    } else {
        plainPassword = generateTemporaryPassword(8);
        passwordHash = await bcrypt.hash(plainPassword, 10);
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Insert author
        const authorResult = await client.query(
            `INSERT INTO authors
                (user_id, password_hash, first_name, last_name, email, phone, company,
                 paper_title, abstract_info, paper_id, temp_password, created_by_admin_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
             RETURNING id, user_id, first_name, last_name, email, paper_title, paper_id,
                       invitation_status, current_stage, temp_password`,
            [userId, passwordHash, safeFirst, safeLast, safeEmail, safePhone, safeCompany,
             safePaperTitle, safeAbstract, safePaperId, plainPassword, createdByAdminId]
        );
        const author = authorResult.rows[0];

        // Insert all 5 progress stage rows
        const stages = [
            'logins-created', 'invitation-send', 'first-draft-reminder',
            'paper-submission', 'review-in-progress'
        ];
        for (const stage of stages) {
            const isFirst = stage === 'logins-created';
            await client.query(
                `INSERT INTO author_progress (author_id, stage, status, completed_at, notes)
                 VALUES ($1, $2, $3, $4, $5)`,
                [author.id, stage, isFirst ? 'completed' : 'pending',
                 isFirst ? new Date() : null, isFirst ? 'Account created successfully' : '']
            );
        }

        await normalizeCredentialsForEmail(client, safeEmail, passwordHash, plainPassword);

        await client.query('COMMIT');
        clearAuthorsCache();

        res.status(201).json({
            success: true,
            author: {
                id:               author.id,
                userId:           author.user_id,
                firstName:        author.first_name,
                lastName:         author.last_name,
                email:            author.email,
                paperTitle:       author.paper_title,
                paperId:          author.paper_id,
                invitationStatus: author.invitation_status,
                currentStage:     author.current_stage,
                password:         author.temp_password  // plaintext — shown once to admin
            }
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('POST /authors error:', err.message);
        if (err.code === '23505') {  // unique violation
            if (err.detail && err.detail.includes('email')) return res.status(409).json({ success: false, message: 'An author with this email already exists.' });
            if (err.detail && err.detail.includes('paper_id')) return res.status(409).json({ success: false, message: 'An author with this Paper ID already exists.' });
            if (err.detail && err.detail.includes('user_id')) return res.status(409).json({ success: false, message: 'User ID conflict. Please try again.' });
        }
        res.status(500).json({ success: false, message: 'Failed to create author.' });
    } finally {
        client.release();
    }
});

// Per-paper invitation response — updates a specific paper by paper_id
app.post('/author/paper-invitation-response', async (req, res) => {
    const { paperId, action, email } = req.body;
    if (!paperId || !action || !email) {
        return res.status(400).json({ success: false, message: 'paperId, action, and email are required.' });
    }
    if (!['accepted', 'declined'].includes(action)) {
        return res.status(400).json({ success: false, message: 'action must be accepted or declined.' });
    }
    try {
        const result = await pool.query(
            `UPDATE authors
                SET invitation_status = $1,
                    accepted_at = CASE WHEN $2 THEN NOW() ELSE NULL END
              WHERE LOWER(paper_id) = LOWER($3)
                AND LOWER(email) = LOWER($4)
              RETURNING id, paper_id, invitation_status, accepted_at`,
            [action, action === 'accepted', paperId, email]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Paper not found for this author.' });
        }
        return res.json({ success: true, paper: result.rows[0] });
    } catch (err) {
        console.error('POST /author/paper-invitation-response error:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to update invitation status.' });
    }
});

app.post('/author/paper-acknowledgement', async (req, res) => {
    const { paperId, email, response } = req.body;
    const allowedResponses = ['yes_on_time', 'no', 'other_responses'];

    if (!paperId || !email || !response) {
        return res.status(400).json({ success: false, message: 'paperId, email, and response are required.' });
    }

    if (!allowedResponses.includes(response)) {
        return res.status(400).json({ success: false, message: 'Invalid acknowledgement response.' });
    }

    try {
        const result = await pool.query(
            `UPDATE authors
                SET acknowledgement_response = $1,
                    acknowledgement_updated_at = NOW()
              WHERE LOWER(paper_id) = LOWER($2)
                AND LOWER(email) = LOWER($3)
              RETURNING id, paper_id, email, acknowledgement_response, acknowledgement_updated_at`,
            [response, paperId, email]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Paper not found for this author.' });
        }

        return res.json({ success: true, acknowledgement: result.rows[0] });
    } catch (err) {
        console.error('POST /author/paper-acknowledgement error:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to save acknowledgement.' });
    }
});

app.post('/author/paper-submission-date', async (req, res) => {
    const { paperId, email, expectedSubmissionDate } = req.body;

    console.log(`📝 Received date save: paperId="${paperId}", email="${email}", date="${expectedSubmissionDate}"`);

    if (!paperId || !email) {
        return res.status(400).json({ success: false, message: 'paperId and email are required.' });
    }

    const cleanPaperId = String(paperId).trim();
    const cleanEmail = String(email).trim();
    const cleanDate = expectedSubmissionDate ? String(expectedSubmissionDate).trim() : null;

    console.log(`🧹 After cleaning: paperId="${cleanPaperId}", date="${cleanDate}"`);

    try {
        const result = await pool.query(
            `UPDATE authors
                SET expected_submission_date = $1,
                    expected_submission_updated_at = NOW()
              WHERE TRIM(LOWER(paper_id)) = TRIM(LOWER($2))
                AND TRIM(LOWER(email)) = TRIM(LOWER($3))
              RETURNING id, paper_id, email, expected_submission_date, expected_submission_updated_at`,
            [cleanDate, cleanPaperId, cleanEmail]
        );

        if (result.rows.length === 0) {
            console.log(`❌ No paper found for ${cleanPaperId} / ${cleanEmail}`);
            return res.status(404).json({ success: false, message: 'Paper not found for this author.' });
        }

        const returnedDate = result.rows[0].expected_submission_date;
        console.log(`📊 Type of returned date: ${typeof returnedDate}, Value: ${returnedDate}, Constructor: ${returnedDate?.constructor?.name}`);
        
        // Format date properly for JSON to avoid UTC conversion
        const formattedRow = {
            ...result.rows[0],
            expected_submission_date: formatLocalDate(returnedDate)
        };
        
        console.log(`✅ Formatted for response: stored_date="${formattedRow.expected_submission_date}"`);
        return res.json({ success: true, submissionDate: formattedRow });
    } catch (err) {
        console.error('POST /author/paper-submission-date error:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to save submission date.' });
    }
});

// Author first draft upload endpoint
app.post('/author/upload-first-draft', uploadDraft.single('file'), async (req, res) => {
    const { paperId, email } = req.body;
    
    if (!paperId || !email || !req.file) {
        return res.status(400).json({ success: false, message: 'paperId, email, and file are required.' });
    }

    try {
        // Generate safe filename
        const originalName = String(req.file.originalname || 'first-draft').replace(/[^a-zA-Z0-9._-]/g, '_');
        const storedName = `${email}_${paperId}_${originalName}`;

        let s3Url = null;
        let localPath = null;
        let s3Key = null;

        // Upload to S3 (primary storage)
        try {
            const s3Response = await uploadToS3(req.file.buffer, storedName, req.file.mimetype, 'first-drafts');
            s3Key = s3Response.key;
            s3Url = s3Response.location;
            console.log(`✅ First draft uploaded to S3: ${s3Key}`);
        } catch (s3Err) {
            console.error('S3 upload failed:', s3Err.message);
            // Continue with local backup even if S3 fails
        }

        // Save to local backup storage (redundancy)
        const localBackupDir = path.join(__dirname, 'uploads', 'first-drafts', email.replace(/[^a-zA-Z0-9._-]/g, '_'));
        fs.mkdirSync(localBackupDir, { recursive: true });
        localPath = path.join(localBackupDir, storedName);
        fs.writeFileSync(localPath, req.file.buffer);
        console.log(`✅ First draft backup saved locally: ${localPath}`);

        // Update database with submission info
        const dbResult = await pool.query(
            `UPDATE authors
             SET first_draft_submitted = true,
                 first_draft_submitted_at = NOW(),
                 first_draft_file_url = $1,
                 first_draft_file_name = $2,
                 first_draft_s3_key = $3,
                 first_draft_local_path = $4,
                 first_draft_file_size = $5,
                 first_draft_mime_type = $6
             WHERE LOWER(email) = LOWER($7)
               AND LOWER(paper_id) = LOWER($8)
             RETURNING id, paper_id, email, first_draft_submitted_at`,
            [s3Url, storedName, s3Key, localPath, req.file.size, req.file.mimetype, email, paperId]
        );

        if (dbResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Author paper record not found.' });
        }

        // Log submission for audit trail
        const submission = dbResult.rows[0];
        console.log(`📋 First draft submission logged: Author=${email}, Paper=${paperId}, Size=${req.file.size} bytes, Time=${submission.first_draft_submitted_at}`);

        return res.json({ 
            success: true, 
            message: 'First draft uploaded successfully and backed up securely',
            submission: {
                paperId: submission.paper_id,
                email: submission.email,
                submittedAt: submission.first_draft_submitted_at,
                fileSize: req.file.size,
                fileName: originalName
            }
        });
    } catch (err) {
        console.error('POST /author/upload-first-draft error:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to upload first draft: ' + err.message });
    }
});

// Retrieve first draft for download
app.get('/author/download-first-draft/:paperId', async (req, res) => {
    const { paperId } = req.params;
    const email = req.query.email;

    if (!paperId || !email) {
        return res.status(400).json({ success: false, message: 'paperId and email are required.' });
    }

    try {
        // Fetch submission details from database
        const result = await pool.query(
            `SELECT first_draft_submitted, first_draft_file_name, first_draft_s3_key, 
                    first_draft_local_path, first_draft_mime_type
             FROM authors
             WHERE LOWER(paper_id) = LOWER($1)
               AND LOWER(email) = LOWER($2)`,
            [paperId, email]
        );

        if (result.rows.length === 0 || !result.rows[0].first_draft_submitted) {
            return res.status(404).json({ success: false, message: 'First draft not found for this paper.' });
        }

        const submission = result.rows[0];

        // Try S3 first (cloud backup)
        if (submission.first_draft_s3_key) {
            try {
                const signedUrl = await getS3SignedUrl(submission.first_draft_s3_key, 3600); // 1 hour expiry
                console.log(`📥 First draft download from S3: ${submission.first_draft_s3_key}`);
                return res.json({ 
                    success: true, 
                    downloadUrl: signedUrl,
                    fileName: submission.first_draft_file_name,
                    source: 'cloud'
                });
            } catch (s3Err) {
                console.error('S3 download failed, trying local backup:', s3Err.message);
            }
        }

        // Fall back to local storage
        if (submission.first_draft_local_path && fs.existsSync(submission.first_draft_local_path)) {
            const fileBuffer = fs.readFileSync(submission.first_draft_local_path);
            res.setHeader('Content-Type', submission.first_draft_mime_type || 'application/octet-stream');
            res.setHeader('Content-Disposition', `attachment; filename="${submission.first_draft_file_name}"`);
            console.log(`📥 First draft download from local backup: ${submission.first_draft_file_name}`);
            return res.send(fileBuffer);
        }

        return res.status(500).json({ success: false, message: 'First draft file not found in any storage.' });
    } catch (err) {
        console.error('GET /author/download-first-draft error:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to retrieve first draft: ' + err.message });
    }
});

// Author invitation response (accept/decline) persisted in PostgreSQL
app.post('/authors/invitation-response', async (req, res) => {
    const { authorId, userId, action } = req.body;
    const isAccepted = action === 'accepted';

    if (!action || !['accepted', 'declined'].includes(action)) {
        return res.status(400).json({ success: false, message: 'action must be either accepted or declined.' });
    }
    if (!authorId && !userId) {
        return res.status(400).json({ success: false, message: 'authorId or userId is required.' });
    }

    try {
        const result = await pool.query(
            `UPDATE authors
                SET invitation_status = $1::varchar(20),
                    accepted_at = CASE WHEN $2::boolean THEN NOW() ELSE NULL END,
                    rejection_email_sent_at = CASE
                        WHEN $1::varchar(20) = 'declined' THEN NOW()
                        ELSE NULL
                    END
              WHERE ($3::int IS NOT NULL AND id = $3::int)
                 OR ($4::text IS NOT NULL AND user_id = $4::text)
              RETURNING id, user_id, invitation_status, accepted_at, current_stage, rejection_email_sent_at`,
            [action, isAccepted, authorId || null, userId || null]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Author not found.' });
        }

        const row = result.rows[0];
        return res.json({
            success: true,
            author: {
                id: row.id,
                userId: row.user_id,
                invitationStatus: row.invitation_status,
                acceptedAt: row.accepted_at,
                currentStage: row.current_stage,
                rejectionEmailSentAt: row.rejection_email_sent_at
            }
        });
    } catch (err) {
        console.error('POST /authors/invitation-response error:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to update invitation status.' });
    }
});

// Upload first draft file for an author
app.post('/authors/:authorId/submissions/first-draft', uploadDraft.single('draftFile'), async (req, res) => {
    const authorId = Number(req.params.authorId);
    const comments = String(req.body.comments || '').trim();
    const submissionType = String(req.body.submissionType || 'first-draft').trim().toLowerCase();
    const isFinalPaper = submissionType === 'final-paper';

    if (!Number.isInteger(authorId) || authorId <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid authorId.' });
    }
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'Draft file is required.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const authorExists = await client.query('SELECT id FROM authors WHERE id = $1', [authorId]);
        if (authorExists.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Author not found.' });
        }

        // Upload to S3
        const s3Upload = await uploadToS3(req.file.buffer, req.file.originalname, req.file.mimetype);
        
        // Generate signed URL for display
        const signedUrl = await getS3SignedUrl(s3Upload.key);

        const insertResult = await client.query(
            `INSERT INTO paper_submissions
                (author_id, file_name, stored_name, file_path, mime_type, file_size, comments)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id, file_name, stored_name, mime_type, file_size, comments, submitted_at`,
            [
                authorId,
                req.file.originalname,
                s3Upload.key,
                s3Upload.location,
                req.file.mimetype,
                req.file.size,
                comments || null
            ]
        );

        const submissionRow = insertResult.rows[0];
        await attachSubmissionToChatIfMissing({
            authorId,
            submissionRow,
            client
        });

        await client.query(
            `UPDATE author_progress
                SET status = 'completed',
                    completed_at = COALESCE(completed_at, NOW()),
                    notes = $1,
                    updated_at = NOW()
              WHERE author_id = $2
                AND stage = 'paper-submission'`,
            [isFinalPaper ? 'Final paper submitted' : 'First draft submitted', authorId]
        );

        await client.query('COMMIT');

        const row = insertResult.rows[0];
        return res.json({
            success: true,
            submission: {
                id: row.id,
                fileName: row.file_name,
                storedName: row.stored_name,
                fileType: row.mime_type,
                fileSize: Number(row.file_size || 0),
                comments: row.comments || '',
                submittedAt: row.submitted_at,
                submissionType: isFinalPaper ? 'final-paper' : 'first-draft',
                fileUrl: signedUrl,
                s3Key: s3Upload.key
            }
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('POST /authors/:authorId/submissions/first-draft error:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to upload first draft.' });
    } finally {
        client.release();
    }
});

// Get submissions for an author
app.get('/authors/:authorId/submissions', async (req, res) => {
    const authorId = Number(req.params.authorId);
    if (!Number.isInteger(authorId) || authorId <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid authorId.' });
    }

    try {
        const result = await pool.query(
            `SELECT id, file_name, stored_name, mime_type, file_size, comments, submitted_at
             FROM paper_submissions
             WHERE author_id = $1
             ORDER BY submitted_at DESC`,
            [authorId]
        );

        const submissions = await Promise.all(result.rows.map(async (r) => {
            const localFallbackPath = String(r.stored_name || '').startsWith('first-drafts/')
                ? `/uploads/${r.stored_name}`
                : `/uploads/first-drafts/${r.stored_name}`;
            let fileUrl = localFallbackPath;

            try {
                // Prefer S3 signed URL for current storage mode.
                fileUrl = await getS3SignedUrl(r.stored_name);
            } catch (_signedUrlError) {
                // Keep legacy local path fallback for older records.
            }

            return {
                id: r.id,
                fileName: r.file_name,
                storedName: r.stored_name,
                fileType: r.mime_type,
                fileSize: Number(r.file_size || 0),
                comments: r.comments || '',
                submittedAt: r.submitted_at,
                type: 'first-draft',
                fileUrl
            };
        }));

        res.json({ success: true, submissions, latest: submissions[0] || null });
    } catch (err) {
        console.error('GET /authors/:authorId/submissions error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch submissions.' });
    }
});

// Chat attachment upload — multipart file upload to S3
const uploadChatAttachment = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }
});

app.post('/chat/upload', uploadChatAttachment.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file provided.' });
    }

    try {
        const s3Upload = await uploadToS3(
            req.file.buffer,
            req.file.originalname,
            req.file.mimetype,
            'chat-attachments'
        );
        const fileUrl = await getS3SignedUrl(s3Upload.key);

        return res.json({
            success: true,
            file: {
                name: req.file.originalname,
                size: req.file.size,
                type: req.file.mimetype,
                url: fileUrl,
                s3Key: s3Upload.key
            }
        });
    } catch (err) {
        console.error('POST /chat/upload error:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to upload file.' });
    }
});

// Ensure chat session for author
app.post('/chat/sessions/ensure', async (req, res) => {
    const authorId = Number(req.body.authorId);
    if (!Number.isInteger(authorId) || authorId <= 0) {
        return res.status(400).json({ success: false, message: 'Valid authorId is required.' });
    }

    try {
        const authorResult = await pool.query(
            'SELECT id, first_name, last_name, email, paper_title FROM authors WHERE id = $1',
            [authorId]
        );
        if (authorResult.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Author not found.' });
        }

        const { row, created } = await getOrCreateChatSession(authorId);

        const latestSubmission = await pool.query(
            `SELECT id, file_name, stored_name, mime_type, file_size, submitted_at
             FROM paper_submissions
             WHERE author_id = $1
             ORDER BY submitted_at DESC
             LIMIT 1`,
            [authorId]
        );
        if (latestSubmission.rowCount > 0) {
            await attachSubmissionToChatIfMissing({
                authorId,
                submissionRow: latestSubmission.rows[0],
                client: pool
            });
        }

        const refreshedSession = await pool.query(
            'SELECT id, author_id, created_at, updated_at, last_message_at FROM chat_sessions WHERE id = $1',
            [row.id]
        );
        const effectiveSession = refreshedSession.rows[0] || row;
        return res.json({
            success: true,
            created,
            session: {
                id: effectiveSession.id,
                authorId: effectiveSession.author_id,
                createdAt: effectiveSession.created_at,
                updatedAt: effectiveSession.updated_at,
                lastMessageAt: effectiveSession.last_message_at,
                author: {
                    id: authorResult.rows[0].id,
                    firstName: authorResult.rows[0].first_name,
                    lastName: authorResult.rows[0].last_name,
                    email: authorResult.rows[0].email,
                    paperTitle: authorResult.rows[0].paper_title
                }
            }
        });
    } catch (err) {
        console.error('POST /chat/sessions/ensure error:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to initialize chat session.' });
    }
});

// Get author chat session summary (creates session if missing)
app.get('/chat/sessions/by-author/:authorId', async (req, res) => {
    const authorId = Number(req.params.authorId);
    if (!Number.isInteger(authorId) || authorId <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid authorId.' });
    }

    try {
        const authorResult = await pool.query(
            'SELECT id, first_name, last_name, email, paper_title FROM authors WHERE id = $1',
            [authorId]
        );
        if (authorResult.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Author not found.' });
        }

        const { row } = await getOrCreateChatSession(authorId);

        const latestSubmission = await pool.query(
            `SELECT id, file_name, stored_name, mime_type, file_size, submitted_at
             FROM paper_submissions
             WHERE author_id = $1
             ORDER BY submitted_at DESC
             LIMIT 1`,
            [authorId]
        );
        if (latestSubmission.rowCount > 0) {
            await attachSubmissionToChatIfMissing({
                authorId,
                submissionRow: latestSubmission.rows[0],
                client: pool
            });
        }
        const metricsResult = await pool.query(
            `SELECT
                COUNT(*)::int AS total_messages,
                COUNT(*) FILTER (WHERE sender_type IN ('author','system') AND read_by_admin = FALSE)::int AS unread_for_admin,
                COUNT(*) FILTER (WHERE sender_type = 'admin' AND read_by_author = FALSE)::int AS unread_for_author,
                MAX(created_at) AS last_message_at
             FROM chat_messages
             WHERE session_id = $1`,
            [row.id]
        );

        const lastMessageResult = await pool.query(
            `SELECT id, sender_type, sender_name, message, attachments, created_at
             FROM chat_messages
             WHERE session_id = $1
             ORDER BY created_at DESC
             LIMIT 1`,
            [row.id]
        );

        const metrics = metricsResult.rows[0];
        const last = lastMessageResult.rows[0] || null;
        res.json({
            success: true,
            session: {
                id: row.id,
                authorId: row.author_id,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
                lastMessageAt: metrics.last_message_at || row.last_message_at,
                author: {
                    id: authorResult.rows[0].id,
                    firstName: authorResult.rows[0].first_name,
                    lastName: authorResult.rows[0].last_name,
                    email: authorResult.rows[0].email,
                    paperTitle: authorResult.rows[0].paper_title
                },
                totalMessages: Number(metrics.total_messages || 0),
                unreadForAdmin: Number(metrics.unread_for_admin || 0),
                unreadForAuthor: Number(metrics.unread_for_author || 0),
                lastMessage: last
                    ? {
                        id: last.id,
                        senderType: last.sender_type,
                        senderName: last.sender_name,
                        message: last.message || '',
                        attachments: Array.isArray(last.attachments) ? last.attachments : [],
                        createdAt: last.created_at
                    }
                    : null
            }
        });
    } catch (err) {
        console.error('GET /chat/sessions/by-author/:authorId error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to load author chat session.' });
    }
});

// Admin list of chat sessions with unread counters
app.get('/chat/sessions/admin', async (_req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                a.id AS author_id,
                a.first_name,
                a.last_name,
                a.email,
                a.paper_title,
                a.user_id,
                cs.id AS session_id,
                cs.created_at AS session_created_at,
                cs.updated_at AS session_updated_at,
                cs.last_message_at AS session_last_message_at,
                COALESCE(msg_counts.total_messages, 0)::int AS total_messages,
                COALESCE(msg_counts.unread_for_admin, 0)::int AS unread_for_admin,
                COALESCE(msg_counts.unread_for_author, 0)::int AS unread_for_author,
                lm.id AS last_message_id,
                lm.sender_type AS last_sender_type,
                lm.sender_name AS last_sender_name,
                lm.message AS last_message,
                lm.created_at AS last_message_at,
                ps.submitted_at AS latest_submission_at,
                ps.file_name AS latest_submission_file
             FROM authors a
             LEFT JOIN chat_sessions cs ON cs.author_id = a.id
             LEFT JOIN LATERAL (
                SELECT
                    COUNT(*)::int AS total_messages,
                    COUNT(*) FILTER (WHERE sender_type IN ('author','system') AND read_by_admin = FALSE)::int AS unread_for_admin,
                    COUNT(*) FILTER (WHERE sender_type = 'admin' AND read_by_author = FALSE)::int AS unread_for_author
                FROM chat_messages m
                WHERE m.session_id = cs.id
             ) msg_counts ON TRUE
             LEFT JOIN LATERAL (
                SELECT id, sender_type, sender_name, message, created_at
                FROM chat_messages m
                WHERE m.session_id = cs.id
                ORDER BY created_at DESC
                LIMIT 1
             ) lm ON TRUE
             LEFT JOIN LATERAL (
                SELECT submitted_at, file_name
                FROM paper_submissions p
                WHERE p.author_id = a.id
                ORDER BY submitted_at DESC
                LIMIT 1
             ) ps ON TRUE
             ORDER BY COALESCE(cs.last_message_at, lm.created_at, ps.submitted_at, a.created_at) DESC NULLS LAST, a.id DESC`
        );

        const sessions = result.rows.map((r) => ({
            author: {
                id: r.author_id,
                userId: r.user_id,
                firstName: r.first_name,
                lastName: r.last_name,
                email: r.email,
                paperTitle: r.paper_title
            },
            sessionId: r.session_id,
            hasSession: Boolean(r.session_id),
            createdAt: r.session_created_at,
            updatedAt: r.session_updated_at,
            lastMessageAt: r.last_message_at || r.session_last_message_at,
            totalMessages: Number(r.total_messages || 0),
            unreadForAdmin: Number(r.unread_for_admin || 0),
            unreadForAuthor: Number(r.unread_for_author || 0),
            latestSubmissionAt: r.latest_submission_at,
            latestSubmissionFile: r.latest_submission_file,
            lastMessage: r.last_message_id
                ? {
                    id: r.last_message_id,
                    senderType: r.last_sender_type,
                    senderName: r.last_sender_name,
                    message: r.last_message || '',
                    createdAt: r.last_message_at
                }
                : null
        }));

        res.json({ success: true, sessions });
    } catch (err) {
        console.error('GET /chat/sessions/admin error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to load chat sessions.' });
    }
});

// List messages for chat session
app.get('/chat/sessions/:sessionId/messages', async (req, res) => {
    const sessionId = Number(req.params.sessionId);
    if (!Number.isInteger(sessionId) || sessionId <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid sessionId.' });
    }

    try {
        const sessionResult = await pool.query(
            `SELECT cs.id, cs.author_id, a.first_name, a.last_name, a.email, a.paper_title
             FROM chat_sessions cs
             JOIN authors a ON a.id = cs.author_id
             WHERE cs.id = $1`,
            [sessionId]
        );
        if (sessionResult.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Chat session not found.' });
        }

        const messagesResult = await pool.query(
            `SELECT id, sender_type, sender_name, message, attachments, read_by_admin, read_by_author, created_at
             FROM chat_messages
             WHERE session_id = $1
             ORDER BY created_at ASC`,
            [sessionId]
        );

        const sessionRow = sessionResult.rows[0];
        const messages = messagesResult.rows.map((m) => ({
            id: m.id,
            senderType: m.sender_type,
            senderName: m.sender_name,
            message: m.message || '',
            attachments: Array.isArray(m.attachments) ? m.attachments : [],
            readByAdmin: m.read_by_admin,
            readByAuthor: m.read_by_author,
            timestamp: m.created_at
        }));

        return res.json({
            success: true,
            session: {
                id: sessionRow.id,
                authorId: sessionRow.author_id,
                author: {
                    id: sessionRow.author_id,
                    firstName: sessionRow.first_name,
                    lastName: sessionRow.last_name,
                    email: sessionRow.email,
                    paperTitle: sessionRow.paper_title
                }
            },
            messages
        });
    } catch (err) {
        console.error('GET /chat/sessions/:sessionId/messages error:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to load chat messages.' });
    }
});

// Send message to chat session
app.post('/chat/sessions/:sessionId/messages', async (req, res) => {
    const sessionId = Number(req.params.sessionId);
    const senderType = String(req.body.senderType || '').trim().toLowerCase();
    const senderName = String(req.body.senderName || '').trim() || null;
    const message = String(req.body.message || '').trim();
    const attachments = Array.isArray(req.body.attachments) ? req.body.attachments : [];

    if (!Number.isInteger(sessionId) || sessionId <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid sessionId.' });
    }
    if (!['admin', 'author', 'system'].includes(senderType)) {
        return res.status(400).json({ success: false, message: 'senderType must be admin, author, or system.' });
    }
    if (!message && attachments.length === 0) {
        return res.status(400).json({ success: false, message: 'Message text or attachments are required.' });
    }

    const readByAdmin = senderType !== 'author';
    const readByAuthor = senderType !== 'admin';

    try {
        const sessionResult = await pool.query(
            `SELECT
                cs.id,
                cs.author_id,
                COALESCE(ap.notes, '') AS paper_submission_notes
             FROM chat_sessions cs
             LEFT JOIN author_progress ap
               ON ap.author_id = cs.author_id
              AND ap.stage = 'paper-submission'
             WHERE cs.id = $1`,
            [sessionId]
        );
        if (sessionResult.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Chat session not found.' });
        }

        const paperSubmissionNotes = String(sessionResult.rows[0].paper_submission_notes || '').toLowerCase();
        const finalSubmissionPending =
            paperSubmissionNotes.includes('paper-submission email sent via') &&
            !paperSubmissionNotes.includes('final paper submitted');

        if (senderType === 'author' && finalSubmissionPending) {
            return res.status(423).json({
                success: false,
                message: 'Chat is frozen until final paper submission is completed.'
            });
        }

        const insertResult = await pool.query(
            `INSERT INTO chat_messages
                (session_id, sender_type, sender_name, message, attachments, read_by_admin, read_by_author)
             VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
             RETURNING id, sender_type, sender_name, message, attachments, read_by_admin, read_by_author, created_at`,
            [
                sessionId,
                senderType,
                senderName,
                message || null,
                JSON.stringify(attachments),
                readByAdmin,
                readByAuthor
            ]
        );

        await pool.query(
            `UPDATE chat_sessions
             SET updated_at = NOW(),
                 last_message_at = NOW()
             WHERE id = $1`,
            [sessionId]
        );

        const m = insertResult.rows[0];
        return res.json({
            success: true,
            message: {
                id: m.id,
                senderType: m.sender_type,
                senderName: m.sender_name,
                message: m.message || '',
                attachments: Array.isArray(m.attachments) ? m.attachments : [],
                readByAdmin: m.read_by_admin,
                readByAuthor: m.read_by_author,
                timestamp: m.created_at
            }
        });
    } catch (err) {
        console.error('POST /chat/sessions/:sessionId/messages error:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to send chat message.' });
    }
});

// Mark messages as read by admin or author
app.post('/chat/sessions/:sessionId/read', async (req, res) => {
    const sessionId = Number(req.params.sessionId);
    const readerType = String(req.body.readerType || '').trim().toLowerCase();

    if (!Number.isInteger(sessionId) || sessionId <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid sessionId.' });
    }
    if (!['admin', 'author'].includes(readerType)) {
        return res.status(400).json({ success: false, message: 'readerType must be admin or author.' });
    }

    try {
        const sessionResult = await pool.query('SELECT id FROM chat_sessions WHERE id = $1', [sessionId]);
        if (sessionResult.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Chat session not found.' });
        }

        let updateResult;
        if (readerType === 'admin') {
            updateResult = await pool.query(
                `UPDATE chat_messages
                 SET read_by_admin = TRUE
                 WHERE session_id = $1
                   AND sender_type IN ('author', 'system')
                   AND read_by_admin = FALSE`,
                [sessionId]
            );
        } else {
            updateResult = await pool.query(
                `UPDATE chat_messages
                 SET read_by_author = TRUE
                 WHERE session_id = $1
                   AND sender_type = 'admin'
                   AND read_by_author = FALSE`,
                [sessionId]
            );
        }

        await pool.query('UPDATE chat_sessions SET updated_at = NOW() WHERE id = $1', [sessionId]);
        return res.json({ success: true, updated: updateResult.rowCount || 0 });
    } catch (err) {
        console.error('POST /chat/sessions/:sessionId/read error:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to mark messages as read.' });
    }
});

// Get unread message count for specific author's chat (admin perspective)
app.get('/chat/unread-count/author/:authorId', async (req, res) => {
    const authorId = Number(req.params.authorId);
    
    if (!Number.isInteger(authorId) || authorId <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid authorId.' });
    }
    
    // Check cache first
    const cached = getCachedUnreadCount(`author_${authorId}`);
    if (cached !== null) {
        return res.json({ success: true, unreadCount: cached, source: 'cache' });
    }

    try {
        const result = await pool.query(`
            SELECT COUNT(*) as unread_count
            FROM chat_messages cm
            INNER JOIN chat_sessions cs ON cm.session_id = cs.id
            WHERE cs.author_id = $1
              AND cm.sender_type IN ('author', 'system')
              AND cm.read_by_admin = FALSE
        `, [authorId]);
        
        const unreadCount = parseInt(result.rows[0].unread_count) || 0;
        setCachedUnreadCount(`author_${authorId}`, unreadCount);
        return res.json({ success: true, unreadCount });
    } catch (err) {
        console.error('GET /chat/unread-count/author error:', err.message);
        // Return cached value on error
        const cached = getCachedUnreadCount(`author_${authorId}`);
        if (cached !== null) {
            return res.json({ success: true, unreadCount: cached, source: 'cache' });
        }
        return res.status(500).json({ success: false, message: 'Failed to get unread count.' });
    }
});

// Simple in-memory cache for chat unread counts (15 second TTL)
const chatUnreadCache = new Map();
const getCachedUnreadCount = (key) => {
    const cached = chatUnreadCache.get(key);
    if (cached && Date.now() - cached.time < 15000) return cached.count;
    return null;
};
const setCachedUnreadCount = (key, count) => {
    chatUnreadCache.set(key, { count, time: Date.now() });
};

// Get unread message count for specific paper's chat (author perspective)
app.get('/chat/unread-count/paper/:paperId', async (req, res) => {
    const paperId = String(req.params.paperId || '').trim();
    
    if (!paperId) {
        return res.status(400).json({ success: false, message: 'Invalid paperId.' });
    }
    
    // Check cache first
    const cached = getCachedUnreadCount(`paper_${paperId}`);
    if (cached !== null) {
        return res.json({ success: true, unreadCount: cached, source: 'cache' });
    }

    try {
        const result = await pool.query(`
            SELECT COUNT(*) as unread_count
            FROM chat_messages cm
            INNER JOIN chat_sessions cs ON cm.session_id = cs.id
            WHERE cs.author_id = (SELECT id FROM authors WHERE paper_id = $1 LIMIT 1)
              AND cm.sender_type = 'admin'
              AND cm.read_by_author = FALSE
        `, [paperId]);
        
        const unreadCount = parseInt(result.rows[0].unread_count) || 0;
        setCachedUnreadCount(`paper_${paperId}`, unreadCount);
        return res.json({ success: true, unreadCount });
    } catch (err) {
        console.error('GET /chat/unread-count/paper error:', err.message);
        // Return cached value on error to avoid log spam
        const cached = getCachedUnreadCount(`paper_${paperId}`);
        if (cached !== null) {
            return res.json({ success: true, unreadCount: cached, source: 'cache' });
        }
        return res.status(500).json({ success: false, message: 'Failed to get unread count.' });
    }
});

// Delete authors by IDs
app.delete('/authors', async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, message: 'ids array is required.' });
    }

    const safeIds = ids
        .map((id) => Number.parseInt(id, 10))
        .filter((id) => Number.isInteger(id) && id > 0);

    if (safeIds.length === 0) {
        return res.status(400).json({ success: false, message: 'No valid author IDs provided.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const fileRows = await client.query(
            'SELECT file_path FROM paper_submissions WHERE author_id = ANY($1::int[])',
            [safeIds]
        );
        const filesToDelete = fileRows.rows.map(r => r.file_path).filter(Boolean);

        await client.query('DELETE FROM paper_submissions WHERE author_id = ANY($1::int[])', [safeIds]);
        await client.query("DELETE FROM sessions WHERE user_type = 'author' AND user_id = ANY($1::int[])", [safeIds]);
        await client.query("DELETE FROM email_logs WHERE recipient_type = 'author' AND recipient_id = ANY($1::int[])", [safeIds]);
        // Delete dependent rows first
        await client.query('DELETE FROM author_progress WHERE author_id = ANY($1::int[])', [safeIds]);
        const result = await client.query('DELETE FROM authors WHERE id = ANY($1::int[]) RETURNING id', [safeIds]);
        await client.query('COMMIT');
        clearAuthorsCache();

        for (const fp of filesToDelete) {
            fs.unlink(fp, () => {});
        }
        res.json({ success: true, deleted: result.rows.map(r => r.id), requested: safeIds });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('DELETE /authors error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to delete author(s).' });
    } finally {
        client.release();
    }
});

// PUT /authors/:id — update an existing author
app.put('/authors/:id', async (req, res) => {
    const authorId = parseInt(req.params.id, 10);
    
    // Validate authorId is a valid integer
    if (isNaN(authorId) || authorId <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid author ID.' });
    }

    const { firstName, lastName, email, phone, company, paperTitle, abstractInfo, paperId, userId, password } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !company || !paperTitle || !abstractInfo || !paperId) {
        return res.status(400).json({ success: false, message: 'All required fields must be filled.' });
    }

    // Sanitize inputs
    const safeName = (s) => String(s).trim().replace(/[<>"'`]/g, '');
    const safeFirst       = safeName(firstName);
    const safeLast        = safeName(lastName);
    const safeEmail       = String(email).trim().toLowerCase();
    const safeCompany     = safeName(company);
    const safePaperTitle  = safeName(paperTitle);
    const safePaperId     = safeName(paperId);
    const safeAbstract    = String(abstractInfo).trim().replace(/[<>"'`]/g, '');
    const safePhone       = phone ? safeName(phone) : null;
    const safeUserId      = userId ? safeName(userId) : null;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check if author exists
        const checkAuthor = await client.query('SELECT id, email FROM authors WHERE id = $1', [authorId]);
        if (checkAuthor.rowCount === 0) {
            await client.query('ROLLBACK');
            console.error(`PUT /authors/${authorId} - Author not found in DB. ID=${authorId}, Type=${typeof authorId}`);
            return res.status(404).json({ success: false, message: 'Author not found.' });
        }

        // If email changed, check for duplicates (but allow same email across different papers)
        const oldEmail = checkAuthor.rows[0].email;
        if (safeEmail !== oldEmail) {
            const emailCheck = await client.query(
                `SELECT COUNT(*) as count FROM authors WHERE LOWER(email) = LOWER($1) AND id != $2`,
                [safeEmail, authorId]
            );
            // Email can be reused, so we don't block on count > 0
        }

        // Update the author record
        let updateQuery = `
            UPDATE authors
            SET first_name = $2,
                last_name = $3,
                email = $4,
                phone = $5,
                company = $6,
                paper_title = $7,
                abstract_info = $8,
                paper_id = $9,
                updated_at = NOW()
        `;
        const params = [authorId, safeFirst, safeLast, safeEmail, safePhone, safeCompany, safePaperTitle, safeAbstract, safePaperId];

        // If userId is provided and different, update it
        if (safeUserId) {
            updateQuery += `, user_id = $10`;
            params.push(safeUserId);
        }

        // If password is provided, hash it for dedicated duplicate-email sync below.
        let plainPassword = null;
        let passwordHash = null;
        if (password && password.trim()) {
            plainPassword = password.trim();
            passwordHash = await bcrypt.hash(plainPassword, 10);
        }

        updateQuery += ` WHERE id = $1 RETURNING id, user_id, first_name, last_name, email, phone, company, paper_title, abstract_info, paper_id, temp_password`;

        const result = await client.query(updateQuery, params);

        // Keep credentials synchronized for all duplicate-email rows.
        if (plainPassword && passwordHash) {
            const bulkResult = await client.query(
                `UPDATE authors
                 SET password_hash = $1,
                     temp_password = $2,
                     updated_at = NOW()
                 WHERE LOWER(TRIM(email)) = LOWER(TRIM($3))
                    OR LOWER(TRIM(email)) = LOWER(TRIM($4))`,
                [passwordHash, plainPassword, safeEmail, oldEmail]
            );
            console.log(`✅ Password updated for all ${bulkResult.rowCount} authors with email: ${safeEmail}`);
        }

        await client.query('COMMIT');
        clearAuthorsCache();

        const author = result.rows[0];
        res.json({
            success: true,
            message: 'Author updated successfully.',
            author: {
                id: author.id,
                userId: author.user_id,
                firstName: author.first_name,
                lastName: author.last_name,
                email: author.email,
                phone: author.phone,
                company: author.company,
                paperTitle: author.paper_title,
                abstractInfo: author.abstract_info,
                paperId: author.paper_id,
                password: plainPassword || author.temp_password
            }
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`PUT /authors/${authorId} error:`, err.message);
        if (err.code === '23505') {
            if (err.detail && err.detail.includes('paper_id')) {
                return res.status(409).json({ success: false, message: 'An author with this Paper ID already exists.' });
            }
            if (err.detail && err.detail.includes('user_id')) {
                return res.status(409).json({ success: false, message: 'User ID already in use.' });
            }
        }
        res.status(500).json({ success: false, message: 'Failed to update author.' });
    } finally {
        client.release();
    }
});

// Upload admin document with malware scan validation
app.post('/admin/documents', uploadAdminDocument.single('documentFile'), async (req, res) => {
    const createdByAdminId = Number(req.body.createdByAdminId);

    if (!req.file) {
        return res.status(400).json({ success: false, message: 'Document file is required.' });
    }

    if (!Number.isInteger(createdByAdminId) || createdByAdminId <= 0) {
        return res.status(400).json({ success: false, message: 'Valid admin session is required.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const adminExists = await client.query('SELECT id FROM admins WHERE id = $1', [createdByAdminId]);
        if (adminExists.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Admin account not found.' });
        }

        const scanResult = MALWARE_SCAN_REQUIRED
            ? await scanBufferForMalware(req.file.buffer, req.file.originalname)
            : {
                scannerAvailable: false,
                clean: true,
                status: 'unavailable',
                engine: null,
                reason: 'Malware scanning temporarily disabled by configuration'
            };
        if (!scanResult.scannerAvailable && MALWARE_SCAN_REQUIRED) {
            await client.query('ROLLBACK');
            return res.status(503).json({
                success: false,
                message: `Malware scanner is not available (${scanResult.reason || 'unknown reason'}). Document upload is blocked by security policy.`
            });
        }

        if (scanResult.status === 'error' && MALWARE_SCAN_REQUIRED) {
            await client.query('ROLLBACK');
            return res.status(500).json({
                success: false,
                message: `Malware scan failed: ${scanResult.reason || 'Unknown error'}`
            });
        }

        if (!scanResult.clean && scanResult.status === 'infected') {
            await client.query('ROLLBACK');
            return res.status(422).json({
                success: false,
                message: 'Upload blocked. Malware signature detected in file.',
                details: scanResult.signature || null
            });
        }

        const s3Upload = await uploadToS3(req.file.buffer, req.file.originalname, req.file.mimetype, 'admin-documents');
        const fileUrl = await getS3SignedUrl(s3Upload.key);

        const insertResult = await client.query(
            `INSERT INTO admin_documents
                (original_file_name, stored_name, file_path, mime_type, file_size, uploaded_by_admin_id,
                 malware_scan_status, malware_scan_engine, malware_signature)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             RETURNING id, original_file_name, stored_name, mime_type, file_size, uploaded_at,
                       malware_scan_status, malware_scan_engine`,
            [
                req.file.originalname,
                s3Upload.key,
                s3Upload.location,
                req.file.mimetype,
                req.file.size,
                createdByAdminId,
                scanResult.status || 'clean',
                scanResult.engine || null,
                scanResult.signature || scanResult.reason || null
            ]
        );

        await client.query('COMMIT');
        const row = insertResult.rows[0];
        return res.json({
            success: true,
            document: {
                id: row.id,
                fileName: row.original_file_name,
                storedName: row.stored_name,
                fileType: row.mime_type,
                fileSize: Number(row.file_size || 0),
                uploadedAt: row.uploaded_at,
                malwareScanStatus: row.malware_scan_status,
                malwareScanEngine: row.malware_scan_engine,
                fileUrl
            }
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('POST /admin/documents error:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to upload admin document.' });
    } finally {
        client.release();
    }
});

// List uploaded admin documents
app.get('/admin/documents', async (_req, res) => {
    try {
        const result = await pool.query(
            `SELECT d.id,
                    d.original_file_name,
                    d.stored_name,
                    d.mime_type,
                    d.file_size,
                    d.uploaded_at,
                    d.malware_scan_status,
                    d.malware_scan_engine,
                    a.full_name AS uploaded_by
             FROM admin_documents d
             LEFT JOIN admins a ON a.id = d.uploaded_by_admin_id
             ORDER BY d.uploaded_at DESC`
        );

        const documents = await Promise.all(result.rows.map(async (row) => {
            let fileUrl = '';
            try {
                fileUrl = await getS3SignedUrl(row.stored_name);
            } catch (_err) {
                fileUrl = '';
            }

            return {
                id: row.id,
                fileName: row.original_file_name,
                storedName: row.stored_name,
                fileType: row.mime_type,
                fileSize: Number(row.file_size || 0),
                uploadedAt: row.uploaded_at,
                uploadedBy: row.uploaded_by || 'Unknown',
                malwareScanStatus: row.malware_scan_status,
                malwareScanEngine: row.malware_scan_engine,
                fileUrl
            };
        }));

        return res.json({ success: true, documents });
    } catch (err) {
        console.error('GET /admin/documents error:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to load admin documents.' });
    }
});

// Delete one uploaded admin document
app.delete('/admin/documents/:id', async (req, res) => {
    const documentId = Number(req.params.id);
    if (!Number.isInteger(documentId) || documentId <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid document id.' });
    }

    try {
        const result = await pool.query(
            `DELETE FROM admin_documents
             WHERE id = $1
             RETURNING id, stored_name`,
            [documentId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Document not found.' });
        }

        const storedName = result.rows[0].stored_name;
        if (storedName) {
            try {
                await s3Client.send(new DeleteObjectCommand({
                    Bucket: S3_BUCKET,
                    Key: storedName
                }));
            } catch (s3Error) {
                console.warn('S3 delete failed for admin document:', s3Error.message);
            }
        }

        return res.json({ success: true, deletedId: documentId });
    } catch (err) {
        console.error('DELETE /admin/documents/:id error:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to delete document.' });
    }
});

// Get shared admin documents (public endpoint for authors)
app.get('/documents/shared', async (_req, res) => {
    try {
        const result = await pool.query(
            `SELECT d.id,
                    d.original_file_name,
                    d.stored_name,
                    d.mime_type,
                    d.file_size,
                    d.uploaded_at,
                    d.malware_scan_status,
                    a.full_name AS uploaded_by
             FROM admin_documents d
             LEFT JOIN admins a ON a.id = d.uploaded_by_admin_id
             ORDER BY d.uploaded_at DESC`
        );

        const documents = await Promise.all(result.rows.map(async (row) => {
            let fileUrl = '';
            try {
                fileUrl = await getS3SignedUrl(row.stored_name);
            } catch (_err) {
                fileUrl = '';
            }

            return {
                id: row.id,
                fileName: row.original_file_name,
                storedName: row.stored_name,
                fileType: row.mime_type,
                fileSize: Number(row.file_size || 0),
                uploadedAt: row.uploaded_at,
                uploadedBy: row.uploaded_by || 'Admin',
                malwareScanStatus: row.malware_scan_status,
                fileUrl
            };
        }));

        return res.json({ success: true, documents });
    } catch (err) {
        console.error('GET /documents/shared error:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to load shared documents.' });
    }
});

// ============================================================
// EMAIL TEMPLATE ENDPOINTS
// ============================================================

// Get all email templates
app.get('/admin/email-templates', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, template_type, subject, body_html, body_plain, updated_at, updated_by
             FROM email_templates
             ORDER BY template_type ASC`
        );

        const templates = result.rows.map(row => ({
            id: row.id,
            templateType: row.template_type,
            subject: row.subject,
            bodyHtml: row.body_html,
            bodyPlain: row.body_plain,
            updatedAt: row.updated_at,
            updatedBy: row.updated_by
        }));

        return res.json({ success: true, templates });
    } catch (err) {
        console.error('GET /admin/email-templates error:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to load email templates.' });
    }
});

// Get single email template by type
app.get('/admin/email-templates/:templateType', async (req, res) => {
    const templateType = req.params.templateType;

    // Validate template type
    if (!['invitation', 'rejection', 'first-reminder', 'final-submission'].includes(templateType)) {
        return res.status(400).json({ success: false, message: 'Invalid template type.' });
    }

    try {
        const result = await pool.query(
            `SELECT id, template_type, subject, body_html, body_plain, updated_at, updated_by
             FROM email_templates
             WHERE template_type = $1`,
            [templateType]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Template not found.' });
        }

        const row = result.rows[0];
        return res.json({
            success: true,
            template: {
                id: row.id,
                templateType: row.template_type,
                subject: row.subject,
                bodyHtml: row.body_html,
                bodyPlain: row.body_plain,
                updatedAt: row.updated_at,
                updatedBy: row.updated_by
            }
        });
    } catch (err) {
        console.error(`GET /admin/email-templates/${templateType} error:`, err.message);
        return res.status(500).json({ success: false, message: 'Failed to load template.' });
    }
});

// Update email template
app.put('/admin/email-templates/:templateType', async (req, res) => {
    const templateType = req.params.templateType;
    const { subject, bodyHtml, bodyPlain } = req.body;

    // Validate template type
    if (!['invitation', 'rejection', 'first-reminder', 'final-submission'].includes(templateType)) {
        return res.status(400).json({ success: false, message: 'Invalid template type.' });
    }

    // Validate input
    if (!subject || !bodyHtml) {
        return res.status(400).json({ success: false, message: 'Subject and body are required.' });
    }

    try {
        const result = await pool.query(
            `UPDATE email_templates
             SET subject = $1,
                 body_html = $2,
                 body_plain = $3,
                 updated_at = NOW(),
                 updated_by = $4
             WHERE template_type = $5
             RETURNING id, template_type, subject, body_html, body_plain, updated_at, updated_by`,
            [subject, bodyHtml, bodyPlain || '', null, templateType]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Template not found.' });
        }

        const row = result.rows[0];
        return res.json({
            success: true,
            message: 'Email template updated successfully.',
            template: {
                id: row.id,
                templateType: row.template_type,
                subject: row.subject,
                bodyHtml: row.body_html,
                bodyPlain: row.body_plain,
                updatedAt: row.updated_at,
                updatedBy: row.updated_by
            }
        });
    } catch (err) {
        console.error(`PUT /admin/email-templates/${templateType} error:`, err.message);
        return res.status(500).json({ success: false, message: 'Failed to update template.' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'running',
        port: PORT,
        gmailConfigured,
        gmail: gmailWorking ? 'connected' : 'disconnected',
        smtpFrom: gmailUser || process.env.SES_FROM_EMAIL || 'noreply@localhost',
        service: 'IEEE Dashboard Server'
    });
});

// Serve login page by default
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve author dashboard
app.get('/author-dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'author-dashboard.html'));
});

// Start server
app.listen(PORT, async () => {
    console.log('🚀 ================================');
    console.log('🎯 IEEE Dashboard Server Started');
    console.log(`🌐 Server: http://localhost:${PORT}`);
    console.log(`📧 Gmail: ${gmailUser || '(not configured)'}`);
    
    // Validate S3 configuration
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        console.log(`☁️  S3 Bucket: ${S3_BUCKET} (us-east-1)`);
        console.log('✅ S3 Storage configured and ready');
    } else {
        console.log('⚠️  S3 not configured - set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env');
    }
    
    console.log('🚀 ================================');
});
