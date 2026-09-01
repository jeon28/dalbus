-- 그룹 ID(login_id) 대문자 일괄 통일 (2026-08-21)
--
-- 배경: 그룹 생성/수정 API가 login_id를 소문자로 강제 변환하고 있어(ha01 등) 화면 표기
--       규칙(HA01)과 어긋난 행이 남아 있다. API는 대문자 저장으로 고쳤고, 이 스크립트는
--       기존 행을 한 번에 맞춘다.
--
-- 대상: public.tidal_accounts, public.legacy_tidal_accounts, public.accounts(구 테이블, 있으면)
--
-- 안전장치
--   * 그룹 ID 형태(영문 접두사 + 숫자, 예: HA01 / HIFI-001 / HA_01)인 값만 바꾼다.
--     구 accounts 테이블에는 login_id가 이메일 형태(tidal@example.com)인 행이 있을 수 있어
--     그런 값은 건드리지 않는다.
--   * 대문자로 바꿨을 때 같은 테이블 안에서 ID가 겹치면 예외를 던져 전체 롤백한다.
--     (ha01 과 HA01 이 동시에 존재하는 경우 등 — 사람이 먼저 정리해야 한다)
--   * legacy_tidal_accounts 는 updated_at 트리거가 있어 변환된 행의 updated_at 이 갱신된다.
--
-- 실행 순서
--   1) "1. 점검" 쿼리(주석 해제)로 바뀔 행과 충돌 여부를 먼저 눈으로 확인
--   2) "2. 변환" 블록 실행


-- ============================================================
-- 1. 점검 (읽기 전용)
-- ============================================================

-- 1-1. 대문자로 바뀔 행
-- SELECT 'tidal_accounts' AS table_name, id, login_id AS before, upper(btrim(login_id)) AS after
-- FROM public.tidal_accounts
-- WHERE login_id ~ '^[A-Za-z]+[-_ ]?[0-9]+$' AND login_id <> upper(btrim(login_id))
-- UNION ALL
-- SELECT 'legacy_tidal_accounts', id, login_id, upper(btrim(login_id))
-- FROM public.legacy_tidal_accounts
-- WHERE login_id ~ '^[A-Za-z]+[-_ ]?[0-9]+$' AND login_id <> upper(btrim(login_id))
-- UNION ALL
-- SELECT 'accounts', id, login_id, upper(btrim(login_id))
-- FROM public.accounts
-- WHERE login_id ~ '^[A-Za-z]+[-_ ]?[0-9]+$' AND login_id <> upper(btrim(login_id))
-- ORDER BY table_name, after;

-- 1-2. 그룹 ID 형태가 아니어서 변환 대상에서 빠지는 행 (이메일 등 — 그대로 남는다)
-- SELECT 'tidal_accounts' AS table_name, id, login_id
-- FROM public.tidal_accounts
-- WHERE login_id <> upper(btrim(login_id)) AND login_id !~ '^[A-Za-z]+[-_ ]?[0-9]+$'
-- UNION ALL
-- SELECT 'legacy_tidal_accounts', id, login_id
-- FROM public.legacy_tidal_accounts
-- WHERE login_id <> upper(btrim(login_id)) AND login_id !~ '^[A-Za-z]+[-_ ]?[0-9]+$'
-- UNION ALL
-- SELECT 'accounts', id, login_id
-- FROM public.accounts
-- WHERE login_id <> upper(btrim(login_id)) AND login_id !~ '^[A-Za-z]+[-_ ]?[0-9]+$';

-- 1-3. 충돌 (대문자로 만들면 같은 테이블 안에서 겹치는 그룹 ID) — 결과가 있으면 먼저 정리
-- SELECT 'legacy_tidal_accounts' AS table_name, upper(btrim(login_id)) AS login_id,
--        count(*) AS cnt, string_agg(login_id || '=' || id::text, ', ') AS rows
-- FROM public.legacy_tidal_accounts
-- WHERE login_id ~ '^[A-Za-z]+[-_ ]?[0-9]+$'
-- GROUP BY 1, 2 HAVING count(*) > 1;


-- ============================================================
-- 2. 변환 (충돌이 있으면 예외 → 전체 롤백)
-- ============================================================

BEGIN;

DO $$
DECLARE
    -- 그룹 ID 형태만 변환 대상으로 삼는다 (이메일 등 제외)
    group_id_pattern CONSTANT TEXT := '^[A-Za-z]+[-_ ]?[0-9]+$';
    tbl              TEXT;
    conflict         TEXT;
    changed          INT;
    total            INT := 0;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['tidal_accounts', 'legacy_tidal_accounts', 'accounts'] LOOP

        IF to_regclass('public.' || tbl) IS NULL THEN
            RAISE NOTICE '건너뜀: public.% (테이블 없음)', tbl;
            CONTINUE;
        END IF;

        -- (a) 변환 결과가 이미 존재하는 다른 행과 겹치는 경우 (ha01 -> HA01, 그런데 HA01 이 이미 있음)
        EXECUTE format($q$
            SELECT string_agg(DISTINCT a.login_id || ' -> ' || upper(btrim(a.login_id)), ', ')
            FROM public.%1$I a
            WHERE a.login_id ~ %2$L
              AND a.login_id <> upper(btrim(a.login_id))
              AND EXISTS (
                  SELECT 1 FROM public.%1$I b
                  WHERE b.id <> a.id
                    AND b.login_id = upper(btrim(a.login_id))
              )
        $q$, tbl, group_id_pattern) INTO conflict;

        IF conflict IS NOT NULL THEN
            RAISE EXCEPTION
                '중단: public.% 에서 대문자 변환 시 기존 그룹 ID와 충돌합니다 -> %. 한쪽 ID를 먼저 바꿔주세요.',
                tbl, conflict;
        END IF;

        -- (b) 변환 대상끼리 겹치는 경우 (ha01 과 Ha01 이 함께 존재)
        EXECUTE format($q$
            SELECT string_agg(t.login_id || ' (' || t.cnt || '건)', ', ')
            FROM (
                SELECT upper(btrim(login_id)) AS login_id, count(*) AS cnt
                FROM public.%1$I
                WHERE login_id ~ %2$L
                GROUP BY 1
                HAVING count(*) > 1
            ) t
        $q$, tbl, group_id_pattern) INTO conflict;

        IF conflict IS NOT NULL THEN
            RAISE EXCEPTION
                '중단: public.% 에 대소문자만 다른 중복 그룹 ID가 있습니다 -> %. 한쪽 ID를 먼저 바꿔주세요.',
                tbl, conflict;
        END IF;

        -- (c) 변환
        EXECUTE format($q$
            UPDATE public.%1$I
            SET login_id = upper(btrim(login_id))
            WHERE login_id ~ %2$L
              AND login_id <> upper(btrim(login_id))
        $q$, tbl, group_id_pattern);

        GET DIAGNOSTICS changed = ROW_COUNT;
        total := total + changed;
        RAISE NOTICE 'public.%: %건 변환', tbl, changed;
    END LOOP;

    RAISE NOTICE '총 %건 변환 완료', total;
END $$;

COMMIT;


-- ============================================================
-- 3. 확인
-- ============================================================
-- SELECT login_id FROM public.legacy_tidal_accounts ORDER BY login_id;
-- SELECT login_id FROM public.tidal_accounts ORDER BY login_id;
