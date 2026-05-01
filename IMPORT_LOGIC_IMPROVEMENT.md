# Excel Import 로직 개선안

## 현재 문제점

### 1. onConflict 단일 컬럼 의존
```typescript
onConflict: 'tidal_id'
```
- `tidal_id`가 비어있으면 충돌 감지 불가
- 같은 슬롯에 여러 번 임포트 시 중복 생성 가능

### 2. 에러 처리 부족
- constraint 없을 때 전체 임포트 실패
- 부분 실패 시 어디까지 성공했는지 불명확

---

## 개선안

### 방안 A: 조건부 upsert (권장)

```typescript
// 2. Handle Slot Assignments
for (const slot of master.slots) {
    if (!slot.tidal_id) continue;

    try {
        // orderId 조회 로직...

        // ✅ tidal_id 유무에 따라 다른 전략 사용
        if (slot.tidal_id && slot.tidal_id.trim()) {
            // tidal_id가 있으면: tidal_id로 upsert
            const { error: slotError } = await supabaseAdmin
                .from('order_accounts')
                .upsert({
                    account_id: masterAccountId,
                    slot_number: slot.slot_number,
                    tidal_id: slot.tidal_id,
                    slot_password: slot.slot_password || '',
                    order_id: orderId
                }, {
                    onConflict: 'tidal_id',
                    ignoreDuplicates: false
                });

            if (slotError) throw slotError;
        } else {
            // tidal_id가 없으면: (account_id, slot_number)로 upsert
            // 먼저 기존 슬롯 확인
            const { data: existing } = await supabaseAdmin
                .from('order_accounts')
                .select('id')
                .eq('account_id', masterAccountId)
                .eq('slot_number', slot.slot_number)
                .maybeSingle();

            if (existing) {
                // UPDATE
                const { error: updateError } = await supabaseAdmin
                    .from('order_accounts')
                    .update({
                        slot_password: slot.slot_password || '',
                        order_id: orderId
                    })
                    .eq('id', existing.id);

                if (updateError) throw updateError;
            } else {
                // INSERT
                const { error: insertError } = await supabaseAdmin
                    .from('order_accounts')
                    .insert({
                        account_id: masterAccountId,
                        slot_number: slot.slot_number,
                        tidal_id: slot.tidal_id || null,
                        slot_password: slot.slot_password || '',
                        order_id: orderId
                    });

                if (insertError) throw insertError;
            }
        }

        results.success.slots++;
    } catch (error: unknown) {
        const e = error as Error;
        console.error('Slot upsert error:', e);
        results.failed.push({
            id: `${master.login_id}-slot-${slot.slot_number + 1}`,
            reason: `Slot ${slot.slot_number + 1}: ${e.message}`
        });
    }
}
```

---

### 방안 B: DB Function 사용 (고급)

Supabase SQL Editor에서 함수 생성:

```sql
CREATE OR REPLACE FUNCTION upsert_order_account(
    p_account_id UUID,
    p_slot_number INT,
    p_tidal_id TEXT,
    p_slot_password TEXT,
    p_order_id UUID
) RETURNS VOID AS $$
BEGIN
    IF p_tidal_id IS NOT NULL AND p_tidal_id != '' THEN
        -- tidal_id로 upsert
        INSERT INTO order_accounts (account_id, slot_number, tidal_id, slot_password, order_id)
        VALUES (p_account_id, p_slot_number, p_tidal_id, p_slot_password, p_order_id)
        ON CONFLICT (tidal_id)
        DO UPDATE SET
            slot_password = EXCLUDED.slot_password,
            order_id = EXCLUDED.order_id,
            assigned_at = NOW();
    ELSE
        -- (account_id, slot_number)로 upsert
        INSERT INTO order_accounts (account_id, slot_number, tidal_id, slot_password, order_id)
        VALUES (p_account_id, p_slot_number, p_tidal_id, p_slot_password, p_order_id)
        ON CONFLICT (account_id, slot_number)
        DO UPDATE SET
            slot_password = EXCLUDED.slot_password,
            order_id = EXCLUDED.order_id,
            assigned_at = NOW();
    END IF;
END;
$$ LANGUAGE plpgsql;
```

TypeScript에서 호출:

```typescript
await supabaseAdmin.rpc('upsert_order_account', {
    p_account_id: masterAccountId,
    p_slot_number: slot.slot_number,
    p_tidal_id: slot.tidal_id || null,
    p_slot_password: slot.slot_password || '',
    p_order_id: orderId
});
```

---

## 권장 조치 순서

### 즉시 (오늘):
1. ✅ **Migration 020 실행** (Supabase SQL Editor)
2. ✅ **엑셀 임포트 재시도**
3. ✅ 성공 여부 확인

### 단기 (이번 주):
4. **방안 A 코드 적용** (조건부 upsert)
5. 테스트 데이터로 검증

### 중기 (다음 업데이트):
6. 엑셀 검증 로직 추가 (임포트 전 중복 체크)
7. 진행률 표시 UI 개선

---

## 테스트 시나리오

### Case 1: 신규 마스터 + 신규 슬롯
- 예상: 성공

### Case 2: 기존 마스터 + tidal_id 동일한 슬롯
- 예상: UPDATE (기존 슬롯 정보 갱신)

### Case 3: 기존 마스터 + 같은 slot_number에 다른 tidal_id
- 예상: 에러 (onConflict 충돌) → 실패 목록에 표시

### Case 4: tidal_id 없는 슬롯 여러 개
- 현재: 첫 번째만 성공, 나머지 실패
- 개선 후: 모두 성공 (slot_number로 구분)
