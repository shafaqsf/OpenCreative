-- Disable Row Level Security on all application tables so the browser-based
-- anon Supabase client can read/write directly (this app has no auth).
-- This mirrors the existing tables which are accessed without RLS policies.
-- DISABLE is idempotent: safe to run on tables where RLS is already off.

ALTER TABLE IF EXISTS folders DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS generated_media DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS agent_chats DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS agent_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS agent_checkpoints DISABLE ROW LEVEL SECURITY;