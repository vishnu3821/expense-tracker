-- Create expenses table
CREATE TABLE public.expenses (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    name text NOT NULL,
    amount numeric NOT NULL,
    date date NOT NULL,
    image_url text NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT expenses_pkey PRIMARY KEY (id),
    CONSTRAINT expenses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
);

-- Enable RLS for expenses
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Create policies for expenses
CREATE POLICY "Users can view their own expenses" ON public.expenses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own expenses" ON public.expenses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own expenses" ON public.expenses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own expenses" ON public.expenses FOR DELETE USING (auth.uid() = user_id);

-- user_savings table and policies (if not already existing in other schema files)
-- CREATE TABLE IF NOT EXISTS public.user_savings (...);
-- ALTER TABLE public.user_savings ENABLE ROW LEVEL SECURITY;
-- ...

-- Create storage bucket for receipts
INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', true);

-- Allow authenticated uploads to 'receipts' bucket
CREATE POLICY "Allow authenticated uploads" 
ON storage.objects 
FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'receipts');

-- Allow public read access to 'receipts' bucket
CREATE POLICY "Allow public select" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'receipts');

-- Allow delete access to 'receipts' bucket for authenticated users
CREATE POLICY "Allow authenticated delete" 
ON storage.objects 
FOR DELETE 
TO authenticated 
USING (bucket_id = 'receipts');

-- Create splits table for tracking owed money
CREATE TABLE public.splits (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    expense_id uuid REFERENCES public.expenses(id) ON DELETE CASCADE,
    friend_name text NOT NULL,
    amount numeric NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT splits_pkey PRIMARY KEY (id),
    CONSTRAINT splits_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
);

-- Enable RLS for splits
ALTER TABLE public.splits ENABLE ROW LEVEL SECURITY;

-- Create policies for splits
CREATE POLICY "Users can view their own splits" ON public.splits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own splits" ON public.splits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own splits" ON public.splits FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own splits" ON public.splits FOR DELETE USING (auth.uid() = user_id);
