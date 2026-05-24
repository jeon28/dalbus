# 무통장 입금 운영 강화 작업 정리

**작업일:** 2026-05-25
**작업 범위:** 결제 계좌 노출 보안 강화 + 매칭 코드 도입 + 결제 안내 UX 개편
**전제:** PG 미도입, 무통장 입금 단독 운영 유지

---

## 1. 작업 배경

### 식별된 문제점
1. `/api/public/banks` 가 무인증 공개 API로 모든 계좌가 JSON으로 노출 (`curl` 한 줄로 크롤링 가능)
2. 상품 상세 페이지(`service/[id]/page.tsx`)에서 select 드롭다운으로 *주문 전*에 모든 계좌 평문 노출
3. 결제완료 페이지에서 `sessionStorage` 에 계좌·입금자명·연락처 평문 저장
4. 입금자명만으로 어드민 수동 매칭 → 위장 공격(동명이인 도용) 가능
5. 주문 ID/번호 추측 가능성, 결제 안내 재조회 경로 부재

### 해결 방향
- 계좌 노출은 **주문 확정 후에만**, 그 주문에 한정해서
- 주문별 **4자리 매칭 코드** 자동 발급으로 자동 매칭률 향상
- `sessionStorage` 평문 저장 제거 → **주문 UUID + 서버 API 조회** 방식
- 입금 마감(48시간) 명시 및 카운트다운 노출

---

## 2. 변경된 파일

### 🆕 신규 파일

| 파일 경로 | 역할 |
|---|---|
| `supabase/migrations/20260525_add_match_code_and_bank_assignment_to_orders.sql` | DB 스키마 마이그레이션 |
| `src/app/api/orders/[id]/payment-info/route.ts` | 주문 UUID 기반 결제 안내 조회 API |
| `docs/PAYMENT_BANK_REVAMP_20260525.md` | 본 변경 정리 문서 |

### ✏️ 수정된 파일

| 파일 경로 | 변경 요약 |
|---|---|
| `src/app/api/orders/route.ts` | 주문 생성 시 활성 계좌 1개 자동 할당 + 라운드로빈 |
| `src/app/api/public/banks/route.ts` | `410 Gone` 반환으로 변경 (엔드포인트 폐기) |
| `src/app/service/[id]/page.tsx` | 계좌 select 드롭다운 제거, 안내 문구로 교체, sessionStorage 제거 |
| `src/app/public/checkout/success/page.tsx` | API 기반 재조회 + UX 전면 개편 |

---

## 3. DB 스키마 변경

### `orders` 테이블에 컬럼 추가
```sql
ALTER TABLE orders
    ADD COLUMN match_code TEXT,
    ADD COLUMN assigned_bank_account_id UUID REFERENCES bank_accounts(id),
    ADD COLUMN payment_due_at TIMESTAMPTZ;
```

- `match_code`: 4자리 영숫자 코드 (0/O, 1/I/L 제외 → 사용자 입력 오타 방지)
- `assigned_bank_account_id`: 주문별로 1개 계좌 고정 할당
- `payment_due_at`: 입금 마감 시간 (기본 INSERT 시 NOW + 48h)

### 인덱스
- `orders_match_code_unique`: pending 주문의 match_code 유니크 인덱스
- `orders_assigned_bank_account_idx`: 계좌별 주문 조회 가속
- `orders_payment_due_at_idx`: 만료 처리 크론용 부분 인덱스

### 함수 / 트리거
- `generate_match_code()`: 4자리 코드 생성, pending 주문 내 중복 회피, 5자리 fallback
- `set_order_payment_defaults()`: INSERT 트리거, `match_code`/`payment_due_at` 자동 부여
- 기존 pending 주문 백필 포함

---

## 4. API 변경

### `POST /api/orders` (수정)
주문 생성 시 서버에서 활성 계좌를 자동 할당하도록 변경.
- 클라이언트가 전송한 계좌 ID는 신뢰하지 않음
- `bank_accounts.is_active=true` 중 `sort_order` 기준 정렬
- 직전 pending 주문의 계좌를 회피해 부하 분산 (단순 라운드로빈)
- 응답에 `assigned_bank_account` 조인 데이터 포함
- 계좌가 0개일 경우 `503` 반환

### `GET /api/orders/[id]/payment-info` (신설)
주문 UUID 기반으로 결제 안내 정보를 조회.
- UUID는 추측 불가능한 식별자 → URL 토큰 역할
- pending 상태 주문만 계좌 정보 반환
- 결제 완료된 주문은 계좌 정보 미반환 (재유포 방지)
- 반환 필드: `order_number`, `amount`, `match_code`, `payment_due_at`, `bank`, `product_name`, `duration_months`, `depositor_name`, `buyer_name`, `buyer_email`

### `GET /api/public/banks` (폐기)
- `410 Gone` 반환
- 클라이언트 측 호출처는 모두 제거됨
- 향후 완전 삭제 가능 (현재는 변경 추적 용도로 유지)

---

## 5. 프론트엔드 변경

### `src/app/service/[id]/page.tsx`
- `BankAccount` 인터페이스 제거
- `bankAccounts`, `selectedBankId` state 제거
- `/api/public/banks` fetch 로직 제거
- 결제 수단 영역의 계좌 select 드롭다운 → **안내 박스**로 교체
  ```
  결제하기 버튼을 누르시면 입금 계좌를 안내해드립니다
  • 주문별 고유 입금 코드가 발급됩니다
  • 안내된 계좌로 정확한 금액을 입금해주세요
  • 48시간 내 미입금 시 주문이 자동 취소됩니다
  ```
- 주문 성공 후 `sessionStorage.setItem('checkout_success', ...)` 제거
- `router.push('/public/checkout/success?orderId=' + order.id)` 로 변경

### `src/app/public/checkout/success/page.tsx`
- `sessionStorage` 의존성 완전 제거
- URL의 `orderId` 쿼리 파라미터로 `/api/orders/[id]/payment-info` 호출
- 새 컴포넌트: `CountdownBadge` (실시간 입금 마감 카운트다운, 1시간 미만 시 amber 경고)
- 새 컴포넌트: `CopyButton` (계좌번호, 금액, 입금자명 모두 클립보드 복사 가능)
- 입금자명 자동 합성: `홍길동K7F3` 형태 (이름 + 매칭코드)
- 토스 송금 딥링크: `supertoss://send?bank=...&accountNo=...&amount=...&msg=...`
- 분기 처리:
  - `pending` → 입금 안내 카드 표시
  - 완료된 주문 → "이미 결제가 완료된 주문" 안내
  - 계좌 정보 없음 → 오류 안내 + 고객센터 문의 유도
- 회원가입 전환 폼은 기존 동작 유지 (게스트 → 회원 전환)
- `Suspense` 래퍼 추가 (`useSearchParams` SSR 호환)

---

## 6. 보안 개선 효과

| 위협 | 변경 전 | 변경 후 |
|---|---|---|
| 무인증 계좌 크롤링 | `curl /api/public/banks` 로 전체 노출 | `410 Gone` 반환, 차단 |
| 주문 전 계좌 노출 | 상품 페이지에서 모든 계좌 평문 노출 | 주문 확정 후에만 1개 계좌 노출 |
| sessionStorage 평문 저장 | 계좌·입금자명·연락처 평문 저장 | UUID 기반 서버 조회로 대체 |
| 입금자명 위장 공격 | 입금자명만으로 매칭 → 동명이인 도용 가능 | `match_code` 4자리 강제로 자동 매칭률↑ |
| 결제 완료 주문의 계좌 재유포 | 항상 동일하게 노출 | 완료 후 계좌 미노출 |
| 미입금 주문 누적 | 무제한 대기 | 48시간 후 자동 만료 정책 (크론은 별도 도입 필요) |

---

## 7. 운영 적용 절차

### Step 1. DB 마이그레이션 적용 (필수)
Supabase SQL Editor에서 다음 파일 실행:
```
supabase/migrations/20260525_add_match_code_and_bank_assignment_to_orders.sql
```

### Step 2. 환경 확인
- `bank_accounts` 테이블에 `is_active=true` 인 활성 계좌가 최소 1개 존재해야 함
- 활성 계좌가 0개면 신규 주문 생성 시 `503` 반환

### Step 3. 코드 배포
- `npm run build` 통과 확인 완료
- 라우트 등록 확인: `/api/orders/[id]/payment-info` 추가됨

### Step 4. 검증 시나리오
1. 게스트로 상품 주문 → 결제 완료 페이지에서 계좌·매칭코드·카운트다운 표시 확인
2. 결제 완료 페이지를 닫고 동일 URL로 재진입 → 동일 정보 재조회 가능 확인
3. 어드민에서 해당 주문을 `paid`로 변경 후 결제 안내 페이지 재진입 → 계좌 정보 미노출 확인
4. `curl https://<도메인>/api/public/banks` → `410 Gone` 확인

---

## 8. 향후 작업 (Phase 2 / 3)

본 작업은 무통장 입금 전용 운영의 **Phase 1 보안 패치**입니다.
다음 단계로 권장되는 작업:

### Phase 2 (단기, 2-4주)
- **이메일 안내 보강**: 결제 안내 메일에 `match_code` · 계좌 · 마감시간 포함
- **매직링크 비회원 재조회**: 이메일 OTP 기반 주문 재조회 (sessionStorage 의존 완전 제거)
- **어드민 매칭 큐**: 자동 매칭 후보 / 미매칭 / 다중 후보 분리 UI
- **미입금 자동 만료 크론**: 48시간 초과 pending 주문 자동 `cancelled` 처리
- **주문번호 형식 보강**: `ORD-YYYYMMDD-XXXX` 에 랜덤 토큰 추가 (현재는 sequential)

### Phase 3 (중기, 1-2개월)
- 입금 알림 SaaS 또는 카카오톡 알림 자동 매칭 봇 (자동 매칭률 70-90%)
- 현금영수증 발급 워크플로우 (10만원 이상 거래 의무)
- 만료 알림 + 원클릭 재주문 (구독 자동 갱신 대안)

### PG 전환 트리거 KPI
다음 중 2개 이상 만족 시 PortOne 도입 본격 검토:
- 일 평균 주문 30건 이상
- CS 입금 관련 문의 비율 40% 이상
- 야간(22시 이후) 주문 비율 30% 이상
- 월 매출 1,000만원 이상
- 갱신/재구매율 40% 이상

---

## 9. 법적 확인 필요 사항

본 작업은 보안·UX 개선이며, 다음 사항은 **별도 법무/세무 자문이 필요**합니다:

1. **5만원 이상 거래 + 무통장 입금 단독 운영**: 전자상거래법 시행령 §25-2 에 따른 에스크로 또는 소비자피해보상보험 가입 의무 확인
2. **사업자 계좌 사용 여부**: 개인 계좌 사용 시 통신판매업 신고·세무 리스크
3. **현금영수증 의무 발급**: 10만원 이상 현금 거래는 발급 의무 (부가가치세법 §32, §60)
4. **개인정보 처리방침**: `bank_accounts`, `match_code`, `payment_due_at` 추가에 따른 처리 항목 업데이트 검토

---

## 10. 빌드/검증 결과

- ✅ `npx tsc --noEmit`: 타입 에러 없음
- ✅ `npm run build`: 빌드 성공
- ✅ 신규 라우트 등록 확인: `/api/orders/[id]/payment-info`
- ✅ `/api/public/banks`: `410 Gone` 응답으로 차단됨
- ⚠️ ESLint: 프로젝트의 ESLint 9 설정 호환성 이슈는 본 작업과 무관 (별도 대응 필요)

---

**작업자:** Claude (Opus 4.7)
**관련 분석 문서:** `ecommerce-pm-analyst` 에이전트 분석 리포트 (대화 내 기록)
