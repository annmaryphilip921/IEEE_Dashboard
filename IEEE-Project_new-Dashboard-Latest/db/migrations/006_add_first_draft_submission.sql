-- Migration: Add first draft submission columns to authors table
-- Date: 2026-06-22
-- Purpose: Track first draft submissions with dual storage (S3 + local backup)

ALTER TABLE authors
ADD COLUMN IF NOT EXISTS first_draft_submitted BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS first_draft_submitted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS first_draft_file_url TEXT,
ADD COLUMN IF NOT EXISTS first_draft_file_name VARCHAR(500),
ADD COLUMN IF NOT EXISTS first_draft_s3_key VARCHAR(500),
ADD COLUMN IF NOT EXISTS first_draft_local_path TEXT,
ADD COLUMN IF NOT EXISTS first_draft_file_size INTEGER,
ADD COLUMN IF NOT EXISTS first_draft_mime_type VARCHAR(100);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_authors_first_draft_submitted_at 
ON authors(first_draft_submitted_at DESC) WHERE first_draft_submitted = TRUE;

CREATE INDEX IF NOT EXISTS idx_authors_first_draft_s3_key 
ON authors(first_draft_s3_key) WHERE first_draft_s3_key IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN authors.first_draft_s3_key IS 'S3 cloud storage key for primary backup';
COMMENT ON COLUMN authors.first_draft_local_path IS 'Local filesystem path for redundant backup';
COMMENT ON COLUMN authors.first_draft_file_size IS 'File size in bytes for tracking storage';
COMMENT ON COLUMN authors.first_draft_mime_type IS 'MIME type for proper file handling on download';
