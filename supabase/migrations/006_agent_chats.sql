-- Persist agent chats, messages, and per-request workflow checkpoints.

CREATE TABLE IF NOT EXISTS agent_chats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New chat',
  pinned BOOLEAN NOT NULL DEFAULT false,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_chats_project_id ON agent_chats(project_id);
CREATE INDEX IF NOT EXISTS idx_agent_chats_project_updated
  ON agent_chats(project_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id UUID REFERENCES agent_chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_messages_chat_id
  ON agent_messages(chat_id, created_at ASC);

CREATE TABLE IF NOT EXISTS agent_checkpoints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id UUID REFERENCES agent_chats(id) ON DELETE CASCADE,
  message_id UUID REFERENCES agent_messages(id) ON DELETE CASCADE,
  label TEXT,
  workflow_state JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_checkpoints_chat_message
  ON agent_checkpoints(chat_id, message_id);
