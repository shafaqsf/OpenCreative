-- Remove the prebuilt ad_type workflow column and keep a generic workflow JSONB column.
-- This migration is safe to run even on a fresh database where ad_type never existed.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'ad_type'
  ) THEN
    ALTER TABLE projects DROP COLUMN ad_type;
  END IF;
END $$;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS workflow JSONB NOT NULL DEFAULT '{"elements": [], "camera": {"x": 0, "y": 0, "zoom": 1}}';