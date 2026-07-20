-- 회원 전용 1:1 문의(질문 게시판) 테이블
-- 로그인 회원만 작성/열람 가능하며, 각 문의는 작성자 본인과 관리자만 볼 수 있다.
CREATE TABLE IF NOT EXISTS public.inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'answered')),
    answer_content TEXT,
    answered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inquiries_user_id ON public.inquiries(user_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_created_at ON public.inquiries(created_at DESC);

-- Enable RLS
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

-- 1. 조회: 본인 문의만 열람 가능 (비공개 보장)
CREATE POLICY "Users can view own inquiries" ON public.inquiries
    FOR SELECT USING (auth.uid() = user_id);

-- 2. 작성: 로그인 회원이 본인 명의로만 작성 가능
CREATE POLICY "Users can insert own inquiries" ON public.inquiries
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 3. 수정: 본인 문의만 수정 가능 (답변 등록은 서비스롤 사용 관리자 API가 처리)
CREATE POLICY "Users can update own inquiries" ON public.inquiries
    FOR UPDATE USING (auth.uid() = user_id);

-- 4. 삭제: 본인 문의만 삭제 가능
CREATE POLICY "Users can delete own inquiries" ON public.inquiries
    FOR DELETE USING (auth.uid() = user_id);

-- 관리자 답변/조회/삭제는 SUPABASE_SERVICE_ROLE_KEY(supabaseAdmin) 클라이언트로 처리하며 RLS를 우회한다.
