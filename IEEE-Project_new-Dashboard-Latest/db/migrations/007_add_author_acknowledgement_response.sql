-- Migration: Add per-paper acknowledgement response fields to authors table
-- Date: 2026-06-22

ALTER TABLE authors
ADD COLUMN IF NOT EXISTS acknowledgement_response VARCHAR(40),
ADD COLUMN IF NOT EXISTS acknowledgement_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_authors_acknowledgement_response
ON authors(acknowledgement_response)
WHERE acknowledgement_response IS NOT NULL;
