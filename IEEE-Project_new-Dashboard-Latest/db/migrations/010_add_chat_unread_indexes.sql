-- Migration: Add indexes for chat unread-count queries
-- Date: 2026-06-30
-- Purpose: Reduce RDS load for admin/author unread polling and batch unread lookups

-- Support admin-side unread count lookups by author_id
CREATE INDEX IF NOT EXISTS idx_chat_sessions_author
ON chat_sessions(author_id);

-- Support admin-side unread count lookups filtered by session, sender type, and admin read flag
CREATE INDEX IF NOT EXISTS idx_chat_messages_admin_unread
ON chat_messages(session_id, sender_type, read_by_admin);

-- Support author-side unread count lookups filtered by session, sender type, and author read flag
CREATE INDEX IF NOT EXISTS idx_chat_messages_author_unread
ON chat_messages(session_id, sender_type, read_by_author);