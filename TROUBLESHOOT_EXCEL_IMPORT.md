# Excel Import 오류 해결 가이드

## 오류 메시지
```
090323@hifitidal.com-slot-1
Slot 1: there is no unique or exclusion constraint matching the ON CONFLICT specification
```

## 원인
`order_accounts` 테이블에 필요한 UNIQUE constraint가 없는 상태에서 `upsert` 작업 시도

---

## 해결 방법

### 1단계: 데이터베이스 제약조건 확인

**Supabase SQL Editor**에서 다음 쿼리 실행:

```sql
-- order_accounts 테이블의 제약조건 확인
SELECT
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'order_accounts'::regclass;
```

**기대 결과:**
- `order_accounts_tidal_id_key` (UNIQUE constraint on tidal_id)
- `order_accounts_account_slot_key` (UNIQUE constraint on account_id, slot_number)

만약 이 제약조건들이 **없다면** → **2단계로**

---

### 2단계: Migration 020 실행 (제약조건 없는 경우)

**Supabase Dashboard > SQL Editor**에서 실행:

```sql
-- [Dalbus v2.6] Add unique constraints to order_accounts

-- 1. tidal_id 중복 데이터 확인 (있으면 먼저 정리 필요)
SELECT tidal_id, COUNT(*)
FROM order_accounts
WHERE tidal_id IS NOT NULL AND tidal_id != ''
GROUP BY tidal_id
HAVING COUNT(*) > 1;

-- 2. (account_id, slot_number) 중복 확인
SELECT account_id, slot_number, COUNT(*)
FROM order_accounts
GROUP BY account_id, slot_number
HAVING COUNT(*) > 1;

-- 3. 중복이 없으면 제약조건 추가
ALTER TABLE public.order_accounts
ADD CONSTRAINT order_accounts_tidal_id_key UNIQUE (tidal_id);

ALTER TABLE public.order_accounts
ADD CONSTRAINT order_accounts_account_slot_key UNIQUE (account_id, slot_number);
```

---

### 3단계: 중복 데이터 처리 (2단계에서 중복 발견 시)

#### 옵션 A: 중복 데이터 삭제 (신중하게!)
```sql
-- 중복된 tidal_id 중 가장 오래된 것만 남기고 삭제
WITH duplicates AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY tidal_id ORDER BY assigned_at ASC) as rn
  FROM order_accounts
  WHERE tidal_id IS NOT NULL AND tidal_id != ''
)
DELETE FROM order_accounts
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);
```

#### 옵션 B: 수동 수정
```sql
-- 중복 데이터 조회하여 수동으로 처리
SELECT * FROM order_accounts
WHERE tidal_id IN (
  SELECT tidal_id FROM order_accounts
  WHERE tidal_id IS NOT NULL
  GROUP BY tidal_id HAVING COUNT(*) > 1
)
ORDER BY tidal_id, assigned_at;
```

---

### 4단계: 임포트 코드 개선 (선택사항)

현재 코드의 문제점:
- `onConflict: 'tidal_id'`만 사용 → `tidal_id`가 비어있으면 충돌 감지 불가
- 빈 `tidal_id`로 여러 슬롯 임포트 시 첫 번째만 성공

**개선안:**

```typescript
// src/app/api/admin/accounts/import/route.ts (수정 필요)

// AS-IS (문제)
const { error: slotError } = await supabaseAdmin
    .from('order_accounts')
    .upsert({...}, { onConflict: 'tidal_id' });

// TO-BE (개선)
// 1. tidal_id가 있으면 upsert
if (slot.tidal_id && slot.tidal_id.trim()) {
    const { error: slotError } = await supabaseAdmin
        .from('order_accounts')
        .upsert({...}, { onConflict: 'tidal_id' });
} else {
    // 2. tidal_id가 없으면 (account_id, slot_number)로 upsert
    const { error: slotError } = await supabaseAdmin
        .from('order_accounts')
        .upsert({...}, {
            onConflict: 'account_id,slot_number',
            ignoreDuplicates: false
        });
}
```

---

## 빠른 해결 방법 (권장)

### 현재 상황에서 즉시 해결:

1. **Supabase SQL Editor** 접속
2. 다음 SQL 실행:

```sql
-- 제약조건이 없는지 확인
SELECT conname FROM pg_constraint
WHERE conrelid = 'order_accounts'::regclass
AND conname = 'order_accounts_tidal_id_key';

-- 결과가 없으면 제약조건 추가
ALTER TABLE public.order_accounts
ADD CONSTRAINT order_accounts_tidal_id_key UNIQUE (tidal_id);

ALTER TABLE public.order_accounts
ADD CONSTRAINT order_accounts_account_slot_key UNIQUE (account_id, slot_number);
```

3. 제약조건 추가 후 **엑셀 임포트 재시도**

---

## 예방 조치

### 향후 배포 시 체크리스트:
- [ ] `supabase/migrations/*.sql` 파일을 순서대로 모두 실행
- [ ] 특히 018, 019, 020 마이그레이션 확인
- [ ] 제약조건 확인 쿼리 실행

---

## 추가 디버깅

### 엑셀 파일 데이터 확인:

만약 마이그레이션 후에도 오류가 계속되면:

```sql
-- 현재 DB에 이미 존재하는 tidal_id 확인
SELECT tidal_id FROM order_accounts
WHERE tidal_id = '090323@hifitidal.com';

-- 엑셀에서 임포트하려는 데이터와 충돌 가능성 확인
```

### 임포트 API 로그 확인:
- Vercel Dashboard > Logs > Function Logs
- `/api/admin/accounts/import` 엔드포인트의 상세 에러 확인
