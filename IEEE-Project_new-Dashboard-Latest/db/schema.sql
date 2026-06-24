-- ============================================================
-- IEEE PCIC Conference Management System
-- PostgreSQL Schema for AWS RDS
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLE: admins
-- Stores all admin/staff accounts who manage the conference
-- ============================================================
CREATE TABLE IF NOT EXISTS admins (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR(50) NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,                        -- bcrypt hashed, never plain text
    full_name       VARCHAR(100) NOT NULL,
    email           VARCHAR(150) NOT NULL UNIQUE,
    role            VARCHAR(50) NOT NULL                  -- 'Super Admin' | 'Project Manager' | 'Supervisor' | 'Technical Admin' | 'IEEE Admin'
                    CHECK (role IN ('Super Admin', 'Project Manager', 'Supervisor', 'Technical Admin', 'IEEE Admin')),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    last_login      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: authors (Users)
-- Stores authors created manually by admins.
-- IMPORTANT: This table is intentionally not pre-seeded.
-- ============================================================
CREATE TABLE IF NOT EXISTS authors (
    id                      SERIAL PRIMARY KEY,
    user_id                 VARCHAR(20) NOT NULL UNIQUE,  -- e.g. "jodo001"
    password_hash           TEXT NOT NULL,                -- bcrypt hashed
    first_name              VARCHAR(100) NOT NULL,
    last_name               VARCHAR(100) NOT NULL,
    email                   VARCHAR(150) NOT NULL,
    phone                   VARCHAR(30),
    company                 VARCHAR(200),
    paper_title             VARCHAR(500),
    abstract_info           TEXT,
    paper_id                VARCHAR(50) UNIQUE,           -- e.g. "IEEE-2025-001"
    status                  VARCHAR(20) NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'inactive', 'suspended')),
    invitation_status       VARCHAR(20) NOT NULL DEFAULT 'pending'
                            CHECK (invitation_status IN ('pending', 'accepted', 'declined')),
    invited_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at             TIMESTAMPTZ,
    rejection_email_sent_at TIMESTAMPTZ,
    first_login_completed   BOOLEAN NOT NULL DEFAULT FALSE,
    current_stage           VARCHAR(50) NOT NULL DEFAULT 'logins-created',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_admin_id     INTEGER NOT NULL REFERENCES admins(id) ON DELETE RESTRICT,
    CONSTRAINT chk_author_acceptance_timestamp
        CHECK (
            (invitation_status = 'accepted' AND accepted_at IS NOT NULL)
            OR (invitation_status IN ('pending', 'declined') AND accepted_at IS NULL)
        )
);

-- ============================================================
-- TABLE: reviewers
-- Stores peer reviewers assigned to evaluate submitted papers
-- ============================================================
CREATE TABLE IF NOT EXISTS reviewers (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR(50) NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,                        -- bcrypt hashed
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    email           VARCHAR(150) NOT NULL UNIQUE,
    phone           VARCHAR(30),
    institution     VARCHAR(200),
    expertise       TEXT[],                               -- array of expertise areas e.g. ['AI', 'IoT', 'Cybersecurity']
    bio             TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'inactive')),
    max_papers      INTEGER NOT NULL DEFAULT 3,           -- max papers they can review at once
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: author_progress
-- Tracks each author through the 7-stage submission pipeline
-- One row per author per stage
-- ============================================================
CREATE TABLE IF NOT EXISTS author_progress (
    id          SERIAL PRIMARY KEY,
    author_id   INTEGER NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
    stage       VARCHAR(50) NOT NULL
                CHECK (stage IN (
                    'logins-created',
                    'invitation-send',
                    'first-draft-reminder',
                    'second-draft-reminder',
                    'paper-submission',
                    'sent-for-review',
                    'review-in-progress'
                )),
    status      VARCHAR(20) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'completed', 'skipped')),
    completed_at TIMESTAMPTZ,
    notes       TEXT,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (author_id, stage)
);

-- ============================================================
-- TABLE: paper_reviews
-- Links reviewers to author papers; stores review outcomes
-- ============================================================
CREATE TABLE IF NOT EXISTS paper_reviews (
    id              SERIAL PRIMARY KEY,
    author_id       INTEGER NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
    reviewer_id     INTEGER NOT NULL REFERENCES reviewers(id) ON DELETE CASCADE,
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    due_date        TIMESTAMPTZ,
    submitted_at    TIMESTAMPTZ,
    status          VARCHAR(20) NOT NULL DEFAULT 'assigned'
                    CHECK (status IN ('assigned', 'in-progress', 'completed', 'withdrawn')),
    decision        VARCHAR(30)
                    CHECK (decision IN ('accept', 'minor-revision', 'major-revision', 'reject', NULL)),
    score           SMALLINT CHECK (score BETWEEN 1 AND 10),
    comments        TEXT,
    internal_notes  TEXT,                                 -- only visible to admins
    UNIQUE (author_id, reviewer_id)
);

-- ============================================================
-- TABLE: email_logs
-- Audit trail of every email sent through the system
-- ============================================================
CREATE TABLE IF NOT EXISTS email_logs (
    id              SERIAL PRIMARY KEY,
    recipient_email VARCHAR(150) NOT NULL,
    recipient_type  VARCHAR(20) NOT NULL
                    CHECK (recipient_type IN ('author', 'reviewer', 'admin')),
    recipient_id    INTEGER,                              -- author_id or reviewer_id
    subject         VARCHAR(300) NOT NULL,
    email_type      VARCHAR(50) NOT NULL,                 -- 'invitation' | 'first-draft-reminder' | 'second-draft-reminder' | 'review-assigned'
    status          VARCHAR(20) NOT NULL DEFAULT 'sent'
                    CHECK (status IN ('sent', 'failed', 'simulated')),
    sent_by_admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
    message_id      VARCHAR(200),                         -- SES message ID
    error_message   TEXT,
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: admin_stage_dates
-- Stores start/end date-time windows for admin workflow stages
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_stage_dates (
    id              SERIAL PRIMARY KEY,
    stage           VARCHAR(50) NOT NULL UNIQUE,
    start_time      TIMESTAMPTZ,
    end_time        TIMESTAMPTZ,
    created_by      INTEGER REFERENCES admins(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: sessions
-- Server-side session management (replaces localStorage auth)
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         INTEGER NOT NULL,
    user_type       VARCHAR(20) NOT NULL
                    CHECK (user_type IN ('admin', 'author', 'reviewer')),
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_accessed   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_authors_email         ON authors(email);
CREATE INDEX IF NOT EXISTS idx_authors_paper_id      ON authors(paper_id);
CREATE INDEX IF NOT EXISTS idx_authors_status        ON authors(status);
CREATE INDEX IF NOT EXISTS idx_reviewers_email       ON reviewers(email);
CREATE INDEX IF NOT EXISTS idx_author_progress_aid   ON author_progress(author_id);
CREATE INDEX IF NOT EXISTS idx_paper_reviews_aid     ON paper_reviews(author_id);
CREATE INDEX IF NOT EXISTS idx_paper_reviews_rid     ON paper_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient  ON email_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_admin_stage_dates_stage ON admin_stage_dates(stage);
CREATE INDEX IF NOT EXISTS idx_sessions_user         ON sessions(user_id, user_type);
CREATE INDEX IF NOT EXISTS idx_sessions_expires      ON sessions(expires_at);

-- ============================================================
-- AUTO-UPDATE updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_admins_updated_at
    BEFORE UPDATE ON admins
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_authors_updated_at
    BEFORE UPDATE ON authors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_reviewers_updated_at
    BEFORE UPDATE ON reviewers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- SEED: Admin accounts
-- Use env-driven seeding only (no hardcoded credentials in source files)
-- Run: node db/seed-admins.js with ADMIN_SEED_JSON set
-- ============================================================
