-- Persist generated media outputs so project results survive canvas/session changes.

CREATE TABLE IF NOT EXISTS generated_media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  output_index INTEGER NOT NULL DEFAULT 0,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  url TEXT NOT NULL,
  model TEXT,
  prompt TEXT,
  source_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generated_media_project_id_created_at
  ON generated_media(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generated_media_project_node
  ON generated_media(project_id, node_id);
