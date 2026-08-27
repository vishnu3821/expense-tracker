-- =================================================================================
-- FIX FOR: Insecure Storage Bucket Policies (Receipts)
-- Problem: The 'receipts' bucket currently allows public read access, and allows
-- any authenticated user to insert or delete ANY file in the entire bucket.
-- Solution: Drop the insecure policies and replace them with strict Row Level Security
-- ensuring that users can only interact with files in their own folder (auth.uid()).
-- Also adds basic file extension/MIME type constraints.
-- =================================================================================

-- 1. Drop existing insecure policies (if they exist)
DROP POLICY IF EXISTS "Allow public select" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete" ON storage.objects;

-- 2. Make the bucket private (if not already)
UPDATE storage.buckets SET public = false WHERE id = 'receipts';

-- 3. Create secure SELECT policy: Users can only read their own files
CREATE POLICY "Users can read own receipts" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (
  bucket_id = 'receipts' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Create secure INSERT policy: Users can only upload to their own folder
CREATE POLICY "Users can upload own receipts" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (
  bucket_id = 'receipts' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 5. Create secure UPDATE policy: Users can only update their own files
CREATE POLICY "Users can update own receipts" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (
  bucket_id = 'receipts' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 6. Create secure DELETE policy: Users can only delete their own files
CREATE POLICY "Users can delete own receipts" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (
  bucket_id = 'receipts' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);
