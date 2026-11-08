-- =====================================================================
-- 비밀번호 변경 이력 (password_history)
--  - tidal_assignments / legacy_tidal_assignments 의 tidal_password
--  - tidal_accounts    / legacy_tidal_accounts    의 login_pw
--  가 바뀔 때 트리거가 자동으로 기록한다. (화면·엑셀 가져오기·이동 등 경로와 무관)
--  Supabase SQL Editor 에서 그대로 실행하면 된다. 여러 번 실행해도 안전.
-- =====================================================================

create table if not exists public.password_history (
    id           uuid primary key default gen_random_uuid(),
    source_table text        not null,          -- 어느 테이블에서 바뀌었나
    row_id       uuid        not null,          -- 그 테이블의 행 id (배정 id 또는 계정 id)
    account_id   uuid,                          -- 그룹(계정) id
    tidal_id     text,                          -- 배정의 Tidal ID (계정 테이블이면 null)
    login_id     text,                          -- 그룹 ID (계정 테이블이면 채움)
    field        text        not null,          -- 'tidal_password' | 'login_pw'
    old_value    text,
    new_value    text,
    changed_at   timestamptz not null default now(),
    changed_by   text                           -- (예비) 변경자. 현재는 트리거만 기록하므로 null
);

create index if not exists password_history_row_id_idx     on public.password_history (row_id);
create index if not exists password_history_account_id_idx on public.password_history (account_id);
create index if not exists password_history_tidal_id_idx   on public.password_history (lower(tidal_id));
create index if not exists password_history_changed_at_idx on public.password_history (changed_at desc);

alter table public.password_history enable row level security;

drop policy if exists "password_history_admin_select" on public.password_history;
create policy "password_history_admin_select"
    on public.password_history for select
    using (public.is_admin());
-- insert 는 트리거(security definer)만 수행. 일반 사용자 쓰기 정책 없음.

-- ---------- 배정 테이블용 트리거 함수 ----------
create or replace function public.log_assignment_password_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.tidal_password is distinct from old.tidal_password then
        insert into public.password_history
            (source_table, row_id, account_id, tidal_id, field, old_value, new_value)
        values
            (tg_table_name, new.id, new.account_id, new.tidal_id, 'tidal_password', old.tidal_password, new.tidal_password);
    end if;
    return new;
end;
$$;

-- ---------- 계정(그룹) 테이블용 트리거 함수 ----------
create or replace function public.log_account_password_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.login_pw is distinct from old.login_pw then
        insert into public.password_history
            (source_table, row_id, account_id, login_id, field, old_value, new_value)
        values
            (tg_table_name, new.id, new.id, new.login_id, 'login_pw', old.login_pw, new.login_pw);
    end if;
    return new;
end;
$$;

-- ---------- 트리거 ----------
drop trigger if exists trg_log_password_tidal_assignments on public.tidal_assignments;
create trigger trg_log_password_tidal_assignments
    after update of tidal_password on public.tidal_assignments
    for each row execute function public.log_assignment_password_change();

drop trigger if exists trg_log_password_legacy_tidal_assignments on public.legacy_tidal_assignments;
create trigger trg_log_password_legacy_tidal_assignments
    after update of tidal_password on public.legacy_tidal_assignments
    for each row execute function public.log_assignment_password_change();

drop trigger if exists trg_log_password_tidal_accounts on public.tidal_accounts;
create trigger trg_log_password_tidal_accounts
    after update of login_pw on public.tidal_accounts
    for each row execute function public.log_account_password_change();

drop trigger if exists trg_log_password_legacy_tidal_accounts on public.legacy_tidal_accounts;
create trigger trg_log_password_legacy_tidal_accounts
    after update of login_pw on public.legacy_tidal_accounts
    for each row execute function public.log_account_password_change();
