-- Migration: Add author documents table for admin-uploaded documents
-- Date: 2026-06-25
-- Purpose: Allow admins to upload documents specifically for authors to download

-- Create author_documents table to track documents uploaded for specific authors
CREATE TABLE IF NOT EXISTS author_documents (
    id              SERIAL PRIMARY KEY,
    author_id       INTEGER NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
    original_file_name VARCHAR(500) NOT NULL,
    stored_name     VARCHAR(500) NOT NULL,
    file_path       TEXT,
    mime_type       VARCHAR(100),
    file_size       INTEGER,
    uploaded_by_admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE RESTRICT,
    malware_scan_status VARCHAR(20) DEFAULT 'clean'
                    CHECK (malware_scan_status IN ('clean', 'error', 'infected', 'unavailable')),
    malware_scan_engine VARCHAR(50),
    malware_signature TEXT,
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_author_documents_author_id 
ON author_documents(author_id);

CREATE INDEX IF NOT EXISTS idx_author_documents_uploaded_at 
ON author_documents(uploaded_at DESC);

CREATE INDEX IF NOT EXISTS idx_author_documents_admin_id 
ON author_documents(uploaded_by_admin_id);

-- Add comments for documentation
COMMENT ON TABLE author_documents IS 'Documents uploaded by admins for specific authors to download';
COMMENT ON COLUMN author_documents.stored_name IS 'S3 key or local storage path';
COMMENT ON COLUMN author_documents.file_path IS 'S3 URL or local file path';
COMMENT ON COLUMN author_documents.malware_scan_status IS 'Status of malware scan: clean, error, infected, or unavailable';
