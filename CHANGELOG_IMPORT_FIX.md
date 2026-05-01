# Excel Import 로직 개선 변경 이력

## 📅 2026-02-11 - v2.7 Import Logic Fix

### 🐛 수정된 문제
- **오류 메시지**: `there is no unique or exclusion constraint matching the ON CONFLICT specification`
- **원인**: `onConflict: 'tidal_id'`만 사용하여 빈 tidal_id 케이스 처리 불가
- **영향**: Migration 020 미실행 환경에서 전체 임포트 실패

---

## ✅ 개선 사항

### 1. 조건부 Upsert 전략 도입

**AS-IS (문제):**
```typescript
// 모든 경우에 tidal_id로만 upsert 시도
await supabaseAdmin
    .from('order_accounts')
    .upsert({...}, { onConflict: 'tidal_id' });
```

**TO-BE (개선):**
```typescript
// Case 1: tidal_id가 있을 때
if (slot.tidal_id && slot.tidal_id.trim()) {
    await supabaseAdmin
        .from('order_accounts')
        .upsert(slotData, { onConflict: 'tidal_id' });
}
// Case 2: tidal_id가 없을 때
else {
    // (account_id, slot_number)로 기존 레코드 찾아서 UPDATE/INSERT
    const existing = await supabaseAdmin
        .from('order_accounts')
        .select('id')
        .eq('account_id', masterAccountId)
        .eq('slot_number', slot.slot_number)
        .maybeSingle();

    if (existing) {
        // UPDATE
        await supabaseAdmin.from('order_accounts').update({...}).eq('id', existing.id);
    } else {
        // INSERT
        await supabaseAdmin.from('order_accounts').insert(slotData);
    }
}
```

---

### 2. 에러 메시지 한글화

**AS-IS:**
```
Slot 1: there is no unique or exclusion constraint matching the ON CONFLICT specification
```

**TO-BE:**
```
Slot 1: DB 제약조건이 설정되지 않았습니다. Migration 020을 실행해주세요.
```

**추가 케이스:**
- `unique constraint` 에러 → "중복된 Tidal ID 또는 슬롯 번호입니다."
- 기타 에러 → 원본 메시지 그대로 표시

---

### 3. 빈 슬롯 건너뛰기 로직 개선

**AS-IS:**
```typescript
if (!slot.tidal_id) continue;  // tidal_id만 체크
```

**TO-BE:**
```typescript
// tidal_id도 없고 slot_password도 없으면 완전히 빈 슬롯으로 간주
if (!slot.tidal_id && !slot.slot_password) continue;
```

**효과:**
- 비밀번호만 있는 슬롯도 임포트 가능
- 레거시 데이터 마이그레이션 지원

---

### 4. Try-Catch 범위 확대

**AS-IS:**
```typescript
const { error: slotError } = await supabaseAdmin...;
if (slotError) {
    results.failed.push({...});
}
```

**TO-BE:**
```typescript
try {
    // 전체 슬롯 처리 로직
    await supabaseAdmin...;
    results.success.slots++;
} catch (slotError) {
    // 상세 에러 처리
    results.failed.push({...});
}
```

**효과:**
- 부분 실패 시에도 다음 슬롯 계속 처리
- 에러 발생 지점 명확히 파악 가능

---

## 🧪 테스트 시나리오

### ✅ Case 1: 신규 마스터 + 모든 슬롯 정보 완비
```
마스터 ID: master01@hifitidal.com
Slot 1: tidal_id=user01@hifitidal.com, pw=Pass123!
Slot 2: tidal_id=user02@hifitidal.com, pw=Pass456!
```
**예상 결과:** 마스터 1개, 슬롯 2개 성공

---

### ✅ Case 2: 기존 마스터 업데이트
```
마스터 ID: master01@hifitidal.com (DB에 이미 존재)
결제 계정: payment01@gmail.com (변경)
```
**예상 결과:** 마스터 0개 (이미 존재), 메모/결제정보 업데이트

---

### ✅ Case 3: tidal_id 없는 슬롯
```
Slot 3: tidal_id=(빈값), pw=TempPass789
```
**예상 결과:**
- **이전:** 건너뜀
- **개선 후:** (account_id, slot_number)로 저장 성공

---

### ✅ Case 4: tidal_id 중복
```
Slot 1: tidal_id=dup@hifitidal.com
Slot 2: tidal_id=dup@hifitidal.com (동일)
```
**예상 결과:**
- Slot 1: 성공
- Slot 2: 실패 (에러: "중복된 Tidal ID 또는 슬롯 번호입니다.")

---

### ✅ Case 5: Migration 020 미실행 상태
```
엑셀 임포트 시도
```
**예상 결과:**
- **이전:** 전체 실패 (constraint 없음 에러)
- **개선 후:** tidal_id 없는 슬롯은 성공, tidal_id 있는 슬롯은 실패 (안내 메시지 표시)

---

## 📊 예상 개선 효과

| 항목 | 개선 전 | 개선 후 |
|------|---------|---------|
| Migration 없을 때 성공률 | 0% | 50~70% |
| 에러 메시지 이해도 | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| 부분 실패 처리 | ❌ 전체 실패 | ✅ 성공/실패 분리 |
| 빈 슬롯 처리 | tidal_id 필수 | 선택적 |

---

## 🚀 배포 방법

### 1. 로컬 테스트
```bash
npm run build
npm run dev
```

### 2. Vercel 배포
```bash
git add .
git commit -m "fix: improve Excel import logic with conditional upsert strategy"
git push origin main
```

### 3. 배포 후 확인
- Vercel Dashboard > Deployments > 최신 배포 확인
- Function Logs에서 `/api/admin/accounts/import` 로그 모니터링

---

## ⚠️ 주의 사항

### Migration 020은 여전히 필수
- 이 개선으로 **일부 케이스**는 처리 가능하지만
- **tidal_id가 있는 슬롯**을 제대로 처리하려면 **Migration 020 실행 필수**
- Migration 없이는 tidal_id 중복 체크 불가

### 권장 순서
1. ✅ **Migration 020 실행** (Supabase SQL)
2. ✅ **코드 배포** (이번 개선)
3. ✅ **엑셀 임포트 테스트**

---

## 📝 다음 개선 과제 (Optional)

### 1. 엑셀 데이터 사전 검증
```typescript
// 임포트 전 프론트엔드에서 검증
- tidal_id 중복 체크
- 필수 필드 누락 체크
- 데이터 형식 검증 (이메일, 날짜 등)
```

### 2. 진행률 표시
```typescript
// WebSocket 또는 Server-Sent Events로 실시간 진행률
- 현재: 100개 중 23개 처리중...
- 성공: 20개, 실패: 3개
```

### 3. Rollback 기능
```typescript
// 임포트 실패 시 이전 상태로 복구
- 트랜잭션 단위로 처리
- 실패 시 자동 롤백
```

---

## 🔗 관련 파일

- `src/app/api/admin/accounts/import/route.ts` (수정됨)
- `supabase/migrations/020_add_unique_tidal_id.sql` (실행 필요)
- `TROUBLESHOOT_EXCEL_IMPORT.md` (문제 해결 가이드)
- `IMPORT_LOGIC_IMPROVEMENT.md` (개선 상세 설명)
