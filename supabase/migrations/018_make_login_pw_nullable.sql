-- [Dalbus v2.4] Allow null login_pw for accounts
-- The Excel import might not provide a master password initially.
ALTER TABLE public.accounts ALTER COLUMN login_pw DROP NOT NULL;
