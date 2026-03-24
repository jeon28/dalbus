-- [Dalbus] Add 'deleted' status to account_status enum
-- 이 쿼리를 Supabase SQL Editor에서 실행해주세요.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t 
        JOIN pg_enum e ON t.oid = e.enumtypid 
        WHERE t.typname = 'account_status' AND e.enumlabel = 'deleted'
    ) THEN
        ALTER TYPE account_status ADD VALUE 'deleted';
    END IF;
END $$;
