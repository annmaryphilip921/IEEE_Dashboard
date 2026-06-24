-- Migration: Add Admin Stage Dates Table
-- Stores start/end date-time windows for admin workflow criteria.

CREATE TABLE IF NOT EXISTS admin_stage_dates (
    id              SERIAL PRIMARY KEY,
    stage           VARCHAR(50) NOT NULL UNIQUE,
    start_time      TIMESTAMPTZ,
    end_time        TIMESTAMPTZ,
    created_by      INTEGER REFERENCES admins(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_stage_dates_stage ON admin_stage_dates(stage);

-- Optional one-time backfill from old table if it exists.
DO $$
BEGIN
    IF to_regclass('public.timeline_schedules') IS NOT NULL THEN
        INSERT INTO admin_stage_dates (stage, start_time, end_time, created_at, updated_at)
        SELECT stage, start_time, end_time, COALESCE(created_at, NOW()), COALESCE(updated_at, NOW())
        FROM timeline_schedules
        ON CONFLICT (stage)
        DO UPDATE SET
            start_time = EXCLUDED.start_time,
            end_time = EXCLUDED.end_time,
            updated_at = NOW();
    END IF;
END $$;
