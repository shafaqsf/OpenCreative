-- Keep the project workflow JSON default aligned with the current canvas state shape.
-- Existing rows keep their workflow data; application normalization backfills missing keys.

ALTER TABLE projects
  ALTER COLUMN workflow SET DEFAULT
  '{"elements": [], "camera": {"x": 0, "y": 0, "zoom": 1}, "connections": [], "ui": {"snapToGrid": true, "showGrid": true}}'::jsonb;
