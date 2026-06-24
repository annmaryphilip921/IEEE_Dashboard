-- Enforce manual admin-created author model on existing databases

ALTER TABLE authors
    ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

-- Keep acceptance timestamp consistent with invitation state
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_author_acceptance_timestamp'
    ) THEN
        ALTER TABLE authors
        ADD CONSTRAINT chk_author_acceptance_timestamp
        CHECK (
            (invitation_status = 'accepted' AND accepted_at IS NOT NULL)
            OR (invitation_status IN ('pending', 'declined') AND accepted_at IS NULL)
        );
    END IF;
END $$;

-- Manual admin creation requires created_by_admin_id.
-- This will fail intentionally if existing rows have NULL creator.
ALTER TABLE authors
    ALTER COLUMN created_by_admin_id SET NOT NULL;

-- Prevent deleting admin records that are linked to created authors
ALTER TABLE authors
    DROP CONSTRAINT IF EXISTS authors_created_by_admin_id_fkey,
    ADD CONSTRAINT authors_created_by_admin_id_fkey
    FOREIGN KEY (created_by_admin_id) REFERENCES admins(id) ON DELETE RESTRICT;
