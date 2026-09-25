-- Run this in Supabase SQL Editor

-- 1. Add status and sender info columns
ALTER TABLE friends ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined'));
ALTER TABLE friends ADD COLUMN IF NOT EXISTS user_username TEXT;
ALTER TABLE friends ADD COLUMN IF NOT EXISTS user_email TEXT;

-- 2. Update any old rows (already accepted ones from before) to 'accepted'
UPDATE friends SET status = 'accepted' WHERE status = 'pending' AND created_at < now() - interval '1 minute';

-- 3. Drop old catch-all policy
DROP POLICY IF EXISTS "Users can manage their own friends" ON friends;

-- 4. Granular RLS policies
-- Anyone in user_id or friend_id can read
CREATE POLICY "Friends: users can read their connections"
  ON friends FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Only sender can insert
CREATE POLICY "Friends: users can send requests"
  ON friends FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Sender or receiver can update (cancel / accept / decline)
CREATE POLICY "Friends: users can update status"
  ON friends FOR UPDATE TO authenticated
  USING (auth.uid() = friend_id OR auth.uid() = user_id);

-- Sender or receiver can delete
CREATE POLICY "Friends: users can remove connections"
  ON friends FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id);
