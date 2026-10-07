-- HifiTidal/Tidal 계정 목록 조회 시 계정별 배정 조인(account_id) 가속
CREATE INDEX IF NOT EXISTS tidal_assignments_account_id_idx
    ON public.tidal_assignments (account_id);
