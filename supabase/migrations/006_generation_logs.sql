-- Store workflow/generation run messages for debugging failed nodes.

CREATE TABLE IF NOT EXISTS generation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('info', 'warning', 'error')),
  message TEXT NOT NULL,
  model TEXT,
  prompt TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generation_logs_project_id_created_at
  ON generation_logs(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generation_logs_project_node
  ON generation_logs(project_id, node_id);
