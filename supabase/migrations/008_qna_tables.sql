-- Create Q&A table
CREATE TABLE IF NOT EXISTS public.qna (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    guest_name TEXT,
    guest_password TEXT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_secret BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'answered')),
    answer_content TEXT,
    answered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.qna ENABLE ROW LEVEL SECURITY;

-- Policies
-- 1. Read: Everyone can read public posts.
CREATE POLICY "Public posts are viewable by everyone" ON public.qna
    FOR SELECT USING (is_secret = false);

-- 2. Read: Users can read their own secret posts.
CREATE POLICY "Users can view own secret posts" ON public.qna
    FOR SELECT USING (auth.uid() = user_id);

-- 3. Read: Guests can read their own secret posts (handled via API usually, but basic policy here).
-- Note: Guest access to secret posts typically requires password verification on API side, bypassing RLS for that specific fetch.

-- 4. Insert: Everyone can insert (Authenticated or Anonymous).
CREATE POLICY "Everyone can insert posts" ON public.qna
    FOR INSERT WITH CHECK (true);

-- 5. Update: Users can update their own posts.
CREATE POLICY "Users can update own posts" ON public.qna
    FOR UPDATE USING (auth.uid() = user_id);

-- 6. Update: Guests (handled via API with password check).

-- 7. Delete: Users can delete their own posts.
CREATE POLICY "Users can delete own posts" ON public.qna
    FOR DELETE USING (auth.uid() = user_id);

-- 8. Admin: Full access (handled via Service Role or specific Admin policy if mapped).
-- For now, we rely on SupabaseAdmin client for Admin operations which bypasses RLS.
