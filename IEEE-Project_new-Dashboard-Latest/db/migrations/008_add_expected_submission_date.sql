-- Migration: Add expected submission date fields for acknowledged papers
-- Date: 2026-06-22

ALTER TABLE authors
ADD COLUMN IF NOT EXISTS expected_submission_date DATE,
ADD COLUMN IF NOT EXISTS expected_submission_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_authors_expected_submission_date
ON authors(expected_submission_date)
WHERE expected_submission_date IS NOT NULL;
