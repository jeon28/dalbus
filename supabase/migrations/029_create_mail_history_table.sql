-- [DAL-01] Create mail_history table for logging sent emails
CREATE TABLE IF NOT EXISTS public.mail_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_name TEXT,
    recipient_email TEXT NOT NULL,
    mail_type TEXT NOT NULL,
    subject TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL, -- 'success', 'failed'
    error_message TEXT,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster searching
CREATE INDEX IF NOT EXISTS idx_mail_history_recipient_email ON public.mail_history(recipient_email);
CREATE INDEX IF NOT EXISTS idx_mail_history_sent_at ON public.mail_history(sent_at DESC);

-- RLS Policies
ALTER TABLE public.mail_history ENABLE ROW LEVEL SECURITY;

-- Only admins can view mail history
CREATE POLICY "Admins can view mail history" 
ON public.mail_history 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Only service logic (admin) can insert mail history
CREATE POLICY "Admins can insert mail history" 
ON public.mail_history 
FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);
