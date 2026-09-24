-- Run this in your Supabase SQL Editor

-- 1. Add friend_email and notified_at columns to splits table
ALTER TABLE splits 
  ADD COLUMN IF NOT EXISTS friend_email TEXT,
  ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;

-- 2. Create split_notifications table (for in-app real-time alerts)
CREATE TABLE IF NOT EXISTS split_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  split_id UUID NOT NULL REFERENCES splits(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  friend_name TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  expense_name TEXT,
  status TEXT NOT NULL DEFAULT 'unread', -- 'unread', 'read', 'settled'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Enable Row Level Security on split_notifications
ALTER TABLE split_notifications ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policy: users can only see their own notifications
CREATE POLICY "Users can view their own split notifications"
  ON split_notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = recipient_user_id);

-- 5. RLS Policy: only service role can insert (via API)
CREATE POLICY "Service role can insert split notifications"
  ON split_notifications
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 6. RLS Policy: users can update their own notifications (mark as read/settled)
CREATE POLICY "Users can update their own split notifications"
  ON split_notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = recipient_user_id);

-- 7. Enable Realtime on this table
ALTER PUBLICATION supabase_realtime ADD TABLE split_notifications;
