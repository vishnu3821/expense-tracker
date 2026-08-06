-- =================================================================================
-- FIX FOR: auth_users_exposed
-- Problem: The view "admin_user_emails" exposes user personal information to the public API.
-- Solution: Secure the view by restricting access so that ONLY the specific admin email 
-- can query and receive data from auth.users.
-- =================================================================================

CREATE OR REPLACE VIEW public.admin_user_emails AS 
SELECT id, email, created_at 
FROM auth.users 
WHERE auth.jwt() ->> 'email' = 'p.vishnuprabhakar@gmail.com';


-- =================================================================================
-- FIX FOR: rls_disabled_in_public
-- Problem: One or more tables are publicly accessible without Row-Level Security.
-- Solution: Enable RLS and create appropriate policies ensuring users can only
-- access their own data.
-- =================================================================================

-- 1. Enable RLS and create policies for 'user_savings' table
ALTER TABLE public.user_savings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own savings" ON public.user_savings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own savings" ON public.user_savings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own savings" ON public.user_savings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own savings" ON public.user_savings FOR DELETE USING (auth.uid() = user_id);

-- 2. Enable RLS and create policies for 'education_fees' table
ALTER TABLE public.education_fees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own education fees" ON public.education_fees FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own education fees" ON public.education_fees FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own education fees" ON public.education_fees FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own education fees" ON public.education_fees FOR DELETE USING (auth.uid() = user_id);

-- 3. Enable RLS and create policies for 'user_fcm_tokens' table
ALTER TABLE public.user_fcm_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own tokens" ON public.user_fcm_tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own tokens" ON public.user_fcm_tokens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own tokens" ON public.user_fcm_tokens FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own tokens" ON public.user_fcm_tokens FOR DELETE USING (auth.uid() = user_id);

-- 4. Re-apply RLS for 'expenses' table just in case it was accidentally disabled
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
-- Note: The expenses policies should already exist per your schema.sql. 
-- If they are missing on the server, you can run these:
-- CREATE POLICY "Users can view their own expenses" ON public.expenses FOR SELECT USING (auth.uid() = user_id);
-- CREATE POLICY "Users can insert their own expenses" ON public.expenses FOR INSERT WITH CHECK (auth.uid() = user_id);
-- CREATE POLICY "Users can update their own expenses" ON public.expenses FOR UPDATE USING (auth.uid() = user_id);
-- CREATE POLICY "Users can delete their own expenses" ON public.expenses FOR DELETE USING (auth.uid() = user_id);
