# 달버스(Dalbus) 비즈니스 로직 문서

> 최종 업데이트: v1.6.1
> 소스코드를 보지 않아도 서비스 로직을 이해할 수 있도록 작성된 문서입니다.

---

## 목차

1. [주문 내역 - 단계별 상태 관리](#1-주문-내역---단계별-상태-관리)
2. [서비스 관리 - 요금제 관리](#2-서비스-관리---요금제-관리)
3. [Tidal 계정 관리](#3-tidal-계정-관리)
4. [메일 발송 관리](#4-메일-발송-관리)

---

## 1. 주문 내역 - 단계별 상태 관리

주문은 두 개의 상태 컬럼으로 관리됩니다.

| 컬럼 | 역할 | 값 |
|------|------|-----|
| `payment_status` | 결제 상태 | `pending` / `paid` / `failed` / `cancelled` / `refunded` |
| `assignment_status` | 배정 상태 | `waiting` / `assigned` / `completed` |

UI에서 표시하는 **4단계 상태**는 두 컬럼의 조합으로 결정됩니다.

```
주문신청 → 입금확인 → 배정완료 → 작업완료
```

---

### 단계 1: 주문신청

**설명**
사용자가 서비스 페이지(`/service/[id]`)에서 요금제를 선택하고 구매자 정보를 입력한 뒤 주문을 제출한 초기 상태입니다. 아직 입금이 확인되지 않은 상태를 의미합니다.

**상태 조건**
```
payment_status ≠ 'paid'
(즉, payment_status = 'pending' | 'failed' | 'cancelled' | 'refunded')
```

**저장되는 테이블 및 필드**

**`orders` 테이블 INSERT**
| 필드 | 값 | 설명 |
|------|-----|------|
| `id` | UUID 자동 생성 | 주문 고유 ID |
| `order_number` | YYMMDDNN 형식 자동 생성 | 예: 260315-01 |
| `user_id` | 로그인 사용자의 UUID 또는 NULL | 비회원은 NULL |
| `product_id` | 선택한 상품 ID | products 테이블 FK |
| `plan_id` | 선택한 요금제 ID | product_plans 테이블 FK |
| `payment_status` | `'pending'` | 결제 대기 |
| `assignment_status` | `'waiting'` | 배정 대기 |
| `order_type` | `'NEW'` 또는 `'EXT'` | 신규 / 연장 |
| `related_order_id` | NULL 또는 기존 주문 ID | 연장 시 원본 주문 참조 |
| `buyer_name` | 입력값 | 구매자명 |
| `buyer_email` | 입력값 | 구매자 이메일 |
| `buyer_phone` | 입력값 | 구매자 전화번호 |
| `depositor_name` | 입력값 | 입금자명 (무통장 입금 시) |
| `amount` | 요금제 가격 | 결제 금액 |
| `is_guest` | `true` / `false` | 비회원 여부 |
| `created_at` | 현재 시각 자동 | 주문 생성 시각 |

**발생하는 이벤트**
- 사용자에게 **주문 접수 안내 이메일** 자동 발송 (`mail_history` 기록)
- 관리자에게 **신규 주문 알림 이메일** 자동 발송 (`mail_history` 기록)

---

### 단계 2: 입금확인

**설명**
관리자가 무통장 입금 또는 카드 결제를 확인하고 `payment_status`를 `paid`로 변경한 상태입니다. 계정 배정은 아직 이루어지지 않았습니다.

**상태 조건**
```
payment_status = 'paid'
AND assignment_status ≠ 'assigned'
AND assignment_status ≠ 'completed'
(즉, assignment_status = 'waiting')
```

**저장되는 테이블 및 필드**

**`orders` 테이블 UPDATE**
| 필드 | 변경값 | 설명 |
|------|--------|------|
| `payment_status` | `'paid'` | 결제 확인 완료 |

**처리 방법**
관리자 주문 내역 화면에서 직접 상태를 변경하거나, 향후 PortOne 결제 연동 시 Webhook을 통해 자동 변경될 예정입니다.

---

### 단계 3: 배정완료

**설명**
관리자가 Tidal 계정 관리 페이지에서 특정 공유 계정의 슬롯에 주문을 배정한 상태입니다. 사용자의 Tidal ID/PW가 확정됩니다.

**상태 조건**
```
assignment_status = 'assigned'
```

**저장되는 테이블 및 필드**

**`order_accounts` 테이블 INSERT (또는 UPDATE)**
| 필드 | 값 | 설명 |
|------|-----|------|
| `id` | UUID 자동 생성 | 배정 레코드 고유 ID |
| `order_id` | 주문 UUID | orders 테이블 FK |
| `account_id` | 마스터 계정 UUID | accounts 테이블 FK |
| `order_number` | 주문번호 복사 | 조회 편의용 |
| `slot_number` | 0~5 (UI: 1~6번) | 슬롯 위치 |
| `type` | `'master'` / `'user'` | 슬롯 역할 (slot 0 = master) |
| `tidal_id` | 개인 Tidal 계정 ID | 사용자에게 전달되는 ID |
| `tidal_password` | 개인 Tidal 비밀번호 | 사용자에게 전달되는 PW |
| `buyer_name` | 구매자명 복사 | 검색 편의용 |
| `buyer_email` | 구매자 이메일 복사 | 메일 발송용 |
| `buyer_phone` | 구매자 전화번호 복사 | 연락 용도 |
| `start_date` | 서비스 시작일 | 주문일 기준 자동 계산 |
| `end_date` | 서비스 종료일 | `start_date + (duration_months × 30일)` |
| `is_active` | `true` | 활성 배정 여부 |
| `assigned_at` | 현재 시각 | 배정 완료 시각 |

**`orders` 테이블 UPDATE**
| 필드 | 변경값 | 설명 |
|------|--------|------|
| `assignment_status` | `'assigned'` | 배정 완료 |
| `assigned_at` | 현재 시각 | 배정 시각 기록 |

**`accounts` 테이블 UPDATE**
| 필드 | 변경값 | 설명 |
|------|--------|------|
| `used_slots` | 활성 슬롯 수 재계산 | order_accounts의 is_active=true 행 수 |

**날짜 계산 규칙**
```
start_date = 주문 생성일 (created_at 날짜 부분)
end_date   = start_date + (duration_months × 30일)

예시: 주문일 2026-03-15, 3개월 요금제
→ start_date = 2026-03-15
→ end_date   = 2026-06-13 (90일 후)
```
> ⚠️ 달력 기준(1개월 = 28/30/31일)이 아닌 **30일 균일 계산** 방식을 사용합니다.

---

### 단계 4: 작업완료

**설명**
관리자가 최종 처리(예: 사용자에게 계정 정보 전달, 세팅 완료)를 확인하고 종료 처리한 상태입니다. 이 단계에서 계정 배정 완료 이메일이 자동 발송됩니다.

**상태 조건**
```
assignment_status = 'completed'
```

**저장되는 테이블 및 필드**

**`orders` 테이블 UPDATE**
| 필드 | 변경값 | 설명 |
|------|--------|------|
| `assignment_status` | `'completed'` | 작업 완료 |

**발생하는 이벤트**
`assignment_status`가 `'completed'`로 변경되는 시점에:
- 사용자에게 **배정 완료 안내 이메일** 자동 발송
  - 포함 내용: Tidal ID, Tidal PW, 서비스 종료일
- `mail_history` 테이블에 발송 기록 저장 (성공/실패 무관 기록)

---

### 주문 상태 전체 흐름 요약

```
사용자 주문 제출
       ↓
[주문신청] payment_status='pending', assignment_status='waiting'
       ↓ 관리자 입금 확인
[입금확인] payment_status='paid', assignment_status='waiting'
       ↓ 관리자 계정 슬롯 배정
[배정완료] payment_status='paid', assignment_status='assigned'
       ↓ 관리자 최종 작업 완료 처리
[작업완료] payment_status='paid', assignment_status='completed'
          → 사용자에게 배정 완료 이메일 자동 발송
```

---

### 연장(EXT) 주문의 특이사항

- `order_type = 'EXT'` 로 구분
- `related_order_id`에 기존 주문 ID 저장
- 기존 슬롯에 동일 구매자의 EXT 주문이 배정될 경우, 기존 슬롯을 업데이트(덮어쓰기) 처리
  - 판단 기준: `related_order_id` 일치 또는 `buyer_email/buyer_name` 일치
- 마이페이지에서 '연장' 버튼 클릭 시 `/service/[id]?mode=EXT` 로 이동

---

## 2. 서비스 관리 - 요금제 관리

서비스 관리 화면(`/admin/services/[id]`)에서 각 상품의 요금제를 추가/수정/삭제합니다.

### 요금제 테이블 구조

**`product_plans` 테이블**
| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | UUID | 요금제 고유 ID |
| `product_id` | UUID | 상품 FK |
| `duration_months` | integer | 이용 기간 (개월 수) |
| `price` | integer | 요금 (원) |
| `discount_rate` | integer | 할인율 (%) |
| `is_active` | boolean | 활성 여부 |

---

### 요금제 추가 규칙

요금제를 추가할 때 **중복 체크**가 적용됩니다.

**중복 조건**
```
같은 product_id + 같은 duration_months + is_active = true
```

**예시**
- Tidal 1개월 요금제 (is_active=true) 가 이미 존재하는 상태에서
- Tidal 1개월 요금제를 **추가(신규 생성)**하려 하면 → ❌ `'이미 동일한 개월 수의 활성 요금제가 존재합니다.'` 오류
- Tidal 3개월 요금제를 추가하면 → ✅ 허용
- 기존 1개월 요금제를 `is_active=false`로 비활성화한 뒤, 새 1개월 요금제를 추가하면 → ✅ 허용

**핵심**: 비활성(`is_active=false`) 요금제는 중복 체크에서 제외됩니다. 동일 개월 수도 비활성 상태라면 공존 가능합니다.

---

### 요금제 수정 규칙

수정 시에도 동일한 중복 체크가 적용됩니다.

- 비활성 → 활성으로 변경할 때, 동일 product_id + 동일 duration_months의 활성 요금제가 이미 있으면 → ❌ 오류
- `duration_months` 변경 시, 변경하려는 값과 동일한 활성 요금제가 있으면 → ❌ 오류

---

### 요금제 삭제 규칙

**삭제 제한 조건**
현재 코드상 요금제 삭제(`DELETE /api/admin/plans/[id]`)는 **DB 수준의 참조 무결성**에만 의존합니다.

- `orders.plan_id`가 해당 요금제를 참조하는 주문이 존재하면, DB FK 제약으로 삭제 실패
- 참조하는 주문이 없으면 삭제 가능

**권장 운영 방식**
삭제 대신 `is_active = false`로 비활성화 처리를 권장합니다. 삭제 시 과거 주문 데이터의 요금제 참조가 깨질 수 있습니다.

---

## 3. Tidal 계정 관리

### 개념 정리

```
마스터 계정 (accounts 테이블)
    └── 슬롯 #1 (type='master') ← order_accounts 레코드
    └── 슬롯 #2 (type='user')
    └── 슬롯 #3 (type='user')
    └── 슬롯 #4 (type='user')
    └── 슬롯 #5 (type='user')
    └── 슬롯 #6 (type='user')
```

- **마스터 계정**: Tidal 패밀리 플랜의 결제 주체 계정 (`accounts` 테이블)
- **슬롯**: 마스터 계정에 배정된 개별 사용자 자리 (`order_accounts` 테이블)
- 슬롯은 최대 6개 (`max_slots = 6`)
- DB의 `slot_number`는 **0~5** (0-based index), UI 표시는 **#1~#6** (1-based)
- `slot_number = 0` (UI: #1) 이 master 타입, 나머지는 user 타입

---

### 3-1. 공통 CRUD

#### CREATE - 마스터 계정 추가

**화면**: Tidal 계정 관리 우상단 "계정 추가" 버튼

**API**: `POST /api/admin/accounts`

**저장되는 필드**
| 필드 | 입력 | 설명 |
|------|------|------|
| `product_id` | 상품 선택 | 어느 상품(Tidal)에 속하는지 |
| `login_id` | 필수 입력 | 마스터 Tidal 로그인 이메일 (소문자 정규화) |
| `login_pw` | 선택 입력 | 마스터 Tidal 비밀번호 |
| `payment_email` | 선택 입력 | 결제용 이메일 (소문자 정규화) |
| `payment_day` | 선택 입력 | 결제일 (1~31) |
| `max_slots` | 입력 또는 기본값 | 최대 슬롯 수 (기본 6) |
| `memo` | 선택 입력 | 관리자 메모 |

**자동 처리**
- `login_id`와 `payment_email`은 저장 시 자동으로 소문자 + 공백 제거 처리

---

#### READ - 마스터 계정 + 슬롯 조회

**API**: `GET /api/admin/accounts`

- 마스터 계정 목록과 각 슬롯(`order_accounts`) 데이터를 한 번에 조회
- **비활성 슬롯 자동 필터**: `is_active = false`인 슬롯은 목록에서 제외
- `used_slots`는 DB 저장값이 아닌, **활성 슬롯 수를 실시간 재계산**하여 반환
- 슬롯은 `slot_number` 오름차순 정렬

---

#### UPDATE - 마스터 계정 수정

**API**: `PATCH /api/admin/accounts/[id]`

- `login_id`, `login_pw`, `payment_email`, `payment_day`, `memo`, `max_slots` 수정 가능

---

#### UPDATE - 슬롯 수정

**API**: `PUT /api/admin/assignments/[id]`
(`[id]`는 `order_accounts.id`)

**수정 가능 필드**
| 필드 | 설명 |
|------|------|
| `tidal_id` | 슬롯의 개인 Tidal ID (소문자 정규화) |
| `tidal_password` | 슬롯의 개인 Tidal PW |
| `buyer_name/email/phone` | 구매자 정보 |
| `start_date` / `end_date` | 구독 시작/종료일 |
| `type` | `'master'` / `'user'` 타입 변경 |
| `is_active` | 활성/비활성 여부 |
| `order_number` | 주문번호 |

**타입 변경 시 슬롯 재배치 (Two-Pass Update)**

`type` 또는 `is_active`가 변경되면 해당 마스터 계정의 **모든 슬롯이 자동 재정렬**됩니다.

```
재정렬 규칙:
  1. master 타입 슬롯 → 가장 앞으로 (slot_number = 0)
  2. 나머지 user 타입 슬롯 → 기존 순서 유지 (1, 2, 3...)
  3. master가 2개인 경우 → 변경 대상 외 나머지는 자동으로 user로 강등

두 번의 업데이트로 유니크 제약 충돌 방지:
  Pass 1: 임시 번호로 변경 (기존번호 + 1000)
  Pass 2: 최종 순서로 변경 (0, 1, 2...)
```

예시: 슬롯 #3 (user)을 master로 변경하면
- 슬롯 #3 → slot_number=0, type='master'
- 기존 슬롯 #1 (master) → type='user', slot_number=1
- 나머지 슬롯들은 2, 3, 4...로 재번호

---

#### DELETE - 슬롯 삭제

**API**: `DELETE /api/admin/assignments/[id]`
(`[id]`는 `order_accounts.id`)

**삭제 처리 방식: 하드 삭제 (Hard Delete)**

슬롯을 삭제하면 `order_accounts` 레코드가 **DB에서 완전히 삭제**됩니다.
단, `is_active = false`로 비활성화한 슬롯은 논리적으로 숨겨진 상태가 됩니다.

> 관리자 화면에서 "삭제" 시 실제 동작은 `is_active = false` 소프트 삭제 또는 하드 삭제 중 어느 것인지 구현에 따라 다를 수 있습니다. API DELETE 엔드포인트는 실제 행을 삭제합니다.

**삭제 후 자동 처리 (4단계)**

1. **슬롯 재배치**: 남은 슬롯들의 `slot_number`를 재정렬 (Two-Pass 방식)
   - master 타입은 항상 slot_number=0 유지
2. **used_slots 동기화**: 마스터 계정의 `used_slots`를 남은 슬롯 수로 업데이트
3. **주문 상태 복원**: 삭제된 슬롯에 연결된 주문이 있으면
   - `orders.assignment_status` → `'waiting'` (배정 대기로 되돌림)
   - `orders.assigned_at` → `null`

**마스터 계정 삭제 제한**

- **그룹원(슬롯)이 존재하는 마스터 계정은 삭제 불가**
- 마스터 계정 삭제 전, 모든 슬롯을 먼저 삭제해야 합니다
- UI에서는 그룹원이 있는 마스터를 빨간색으로 표시하여 삭제 예정 상태를 시각화

---

#### 슬롯 이동 (Move)

**API**: `POST /api/admin/accounts/move`

다른 마스터 계정으로 슬롯을 이동합니다.

**필요 정보**
- `assignment_id` 또는 `order_id`: 이동할 슬롯 식별
- `target_account_id`: 이동 대상 마스터 계정 ID
- `target_slot_number`: 이동 대상 슬롯 번호 (선택사항)
- `target_tidal_password`: 변경할 비밀번호 (선택사항)

**이동 가능 조건**
- 대상 마스터 계정의 `used_slots < max_slots` (빈 슬롯 존재)
- 지정한 `target_slot_number`가 이미 사용 중이면 이동 불가

**이동 후 자동 처리**
- 소스 계정: `used_slots - 1`
- 대상 계정: `used_slots + 1`
- `order_accounts.account_id`와 `slot_number` 업데이트

> `order_id`가 없는 슬롯(수동 생성 슬롯)도 이동 가능합니다.

---

#### Excel 임포트

**API**: `POST /api/admin/accounts/import`

대량의 마스터 계정과 슬롯 데이터를 Excel 파일로 일괄 업로드합니다.

**Excel 컬럼 구조**

| 컬럼명 | 대상 |
|--------|------|
| `마스터 ID` 또는 `그룹 ID` | accounts.login_id |
| `결제 계정` | accounts.payment_email |
| `결제일` | accounts.payment_day |
| `메모` | accounts.memo |
| `Slot` | order_accounts.slot_number (Slot 1~6) |
| `소속 ID` | order_accounts.tidal_id |
| `소속 PW` | order_accounts.tidal_password |
| `고객명` | order_accounts.buyer_name |
| `고객 이메일` | order_accounts.buyer_email |
| `고객 전화` | order_accounts.buyer_phone |
| `시작일` | order_accounts.start_date |
| `종료일` | order_accounts.end_date |

**날짜 처리**: Excel 시리얼 숫자(예: 46095) → ISO 날짜 문자열(예: `2026-03-14`) 자동 변환

**Two-Pass Update 처리**
같은 마스터 계정의 슬롯들이 번호를 교체하는 경우 유니크 제약 충돌 방지:
- Pass 1: 임시 음수(또는 고값) 슬롯 번호 할당
- Pass 2: 최종 슬롯 번호 할당

**처리 결과 반환**
```json
{
  "success": {
    "masters": { "created": 2, "updated": 5 },
    "slots":   { "created": 8, "updated": 12 }
  },
  "failed": [{ "id": "master_id", "reason": "오류 메시지" }]
}
```

---

### 3-2. List View (목록 뷰)

**접근**: Tidal 계정 관리 상단의 "목록" 탭

**특징**
- 마스터 계정 1행씩 표시
- 표시 정보: 마스터 ID, 결제 이메일, 결제일, 슬롯 현황 (`used_slots / max_slots`), 메모, 상태
- **슬롯 현황 바**: `used_slots / max_slots` 비율을 시각적 바로 표시
- 빠른 마스터 계정 전체 현황 파악에 적합
- 클릭 시 해당 마스터의 Grid View로 이동 (URL 파라미터 `?account=id`)

**정렬**: 생성일 기준 최신순 (기본)

---

### 3-3. Grid View (그리드 뷰)

**접근**: Tidal 계정 관리 상단의 "그리드" 탭, 또는 List View에서 계정 클릭

**특징**
- 마스터 계정별 **6개 슬롯을 열로 표시**하는 2차원 표 형태
- 각 슬롯 셀에 표시: Tidal ID, 구매자명, 시작일~종료일, 남은 일수, type 배지

**슬롯 상태별 시각화**
| 상태 | 표시 |
|------|------|
| 빈 슬롯 | 회색 "+" 버튼 |
| 만료 30일 이내 | 노란색 경고 |
| 만료됨 | 빨간색 표시 |
| 정상 | 파란색/초록색 |
| master 타입 | 'M' 배지 표시 |

**Grid View 전용 기능**

1. **슬롯 추가**: "+" 버튼 클릭 → 기존 주문 선택 또는 수동 입력으로 슬롯 생성
2. **슬롯 편집**: 슬롯 셀 편집 아이콘 → Tidal ID/PW, 날짜, 구매자 정보 수정
3. **슬롯 이동**: 이동 아이콘 → 다른 마스터 계정으로 슬롯 이동
4. **슬롯 삭제**: 삭제 아이콘 → 슬롯 제거 (삭제 후 슬롯 자동 재배치)
5. **알림 발송**: 메일 아이콘 → 해당 슬롯 사용자에게 계정 정보 이메일 발송

**날짜 양방향 동기화**
슬롯 편집 모달에서:
- `end_date` 수정 → `period_months` 자동 계산
- `period_months` 수정 → `end_date` 자동 계산 (`start_date + period_months × 30일`)

**비활성 슬롯 관리**
- 상단 "비활성" 탭 → `/admin/tidal/inactive` 페이지
- `is_active = false`로 설정된 슬롯 목록 조회
- 재활성화 또는 영구 삭제 가능

---

### 3-4. 슬롯 배정 번호 (배정번호)

배정번호는 `{그룹ID}-{슬롯번호}` 형식으로 표시됩니다.

예: 마스터 계정의 `login_id`가 `tidal@example.com`이고 slot_number가 2(UI: #3)인 경우
→ 배정번호: `tidal@example.com-3`

관리자 주문 내역 및 회원별 계정 조회 모달에서 이 형식으로 표시됩니다.

---

### 3-5. 관리자 메모 자동 타임스탬프

마스터 계정의 메모 필드를 편집창에 접근할 때, 현재 시각이 자동으로 메모 앞에 추가됩니다.

```
형식: [YY/MM/DD HH:mm] 기존메모내용
예시: [26/03/15 14:30] 고객 문의 처리 완료
```

---

---

## 4. 메일 발송 관리

### 4-1. 메일 발송 기능 개요

달버스의 이메일 발송은 **Resend** 서비스를 통해 처리됩니다.

**핵심 파일**: `src/lib/email.ts`

#### 동작 방식

```
이벤트 발생 (주문 생성, 배정 완료 등)
       ↓
email.ts 의 sendEmail() 또는 개별 발송 함수 호출
       ↓
Resend API → 수신자에게 이메일 전달
       ↓
발송 결과(성공/실패) 무관하게 mail_history 테이블에 기록
```

#### 환경 변수

| 변수명 | 설명 |
|--------|------|
| `RESEND_API_KEY` | Resend 서비스 API 키 (필수) |

> `RESEND_API_KEY`가 없으면 이메일 발송이 **건너뜁니다** (서버 에러 없이 skip).

#### 발신자(From) 설정

발신자 이메일은 하드코딩이 아닌 **DB에서 동적으로 조회**합니다.

```
site_settings 테이블
  WHERE key = 'admin_sender_email'
  → 조회 성공: "Dalbus <설정된이메일>"
  → 조회 실패 또는 없음: "Dalbus <onboarding@resend.dev>" (기본값)
```

관리자 대시보드(`/admin`) → 사이트 설정에서 발신자 이메일을 변경할 수 있습니다.

#### 메일 발송 이력 자동 기록

모든 메일은 발송 **성공/실패 여부와 무관하게** `mail_history` 테이블에 기록됩니다.

**`mail_history` 테이블 저장 필드**

| 필드 | 설명 |
|------|------|
| `recipient_name` | 수신자 이름 |
| `recipient_email` | 수신자 이메일 |
| `mail_type` | 메일 유형 (한국어 문자열) |
| `subject` | 메일 제목 |
| `content` | 메일 본문 HTML 전체 |
| `status` | `'success'` / `'failed'` |
| `error_message` | 실패 시 에러 메시지 (JSON 문자열) |
| `sent_at` | 발송 시각 |

---

### 4-2. 메일 발송 목록

달버스에서 자동으로 발송되는 이메일은 총 **5종류**입니다.

---

#### ① 주문 접수 안내 (사용자용)

| 항목 | 내용 |
|------|------|
| **mail_type** | `'주문 접수 안내'` |
| **수신자** | 주문 시 입력한 `buyer_email` |
| **제목** | `[Dalbus] 주문 접수 안내 - {구매자명}님` |
| **발송 함수** | `sendUserOrderNotification()` |
| **발송 시기** | 주문 생성 직후 (`POST /api/orders`) |
| **발송 조건** | `buyer_email`이 입력되었고, `site_settings.admin_email`이 설정된 경우 |

**메일 내용**
- 주문이 정상 접수되었음을 안내
- 주문번호, 상품명, 요금제, 결제 금액, 입금자명
- "입금 확인 후 영업일 기준 24시간 이내 계정 세팅 완료" 안내

**발송 포함 로직**
```
/api/orders (POST)
  1. orders 테이블 INSERT
  2. site_settings에서 admin_email 조회
  3. sendAdminOrderNotification() → 관리자 알림
  4. sendUserOrderNotification() → 사용자 안내  ← 여기
```

---

#### ② 신규 주문 알림 (관리자용)

| 항목 | 내용 |
|------|------|
| **mail_type** | `'주문 알림 (관리자)'` |
| **수신자** | `site_settings` 테이블의 `admin_email` 값 |
| **제목** | `[Dalbus] 신규 주문 알림 - {구매자명}님` |
| **발송 함수** | `sendAdminOrderNotification()` |
| **발송 시기** | 주문 생성 직후 (`POST /api/orders`) |
| **발송 조건** | `site_settings.admin_email`이 설정된 경우 |

**메일 내용**
- 신규 주문 접수 알림
- 상품명, 요금제, 결제 금액
- 구매자명, 입금자명, 연락처
- 관리자 주문 페이지 바로가기 링크 (`/admin/orders`)

**발송 포함 로직**
```
/api/orders (POST)
  1. orders 테이블 INSERT
  2. site_settings에서 admin_email 조회
  3. sendAdminOrderNotification() → 관리자 알림  ← 여기
  4. sendUserOrderNotification() → 사용자 안내
```

> **관리자 알림 이메일 설정 위치**: `/admin` → 사이트 설정 → "알림용 이메일"

---

#### ③ 계정 세팅 완료 안내 (사용자용)

| 항목 | 내용 |
|------|------|
| **mail_type** | `'계정 세팅 완료 안내'` |
| **수신자** | 주문의 `buyer_email` |
| **제목** | `[Dalbus] 계정 세팅 완료 안내 - {구매자명}님` |
| **발송 함수** | `sendAssignmentNotification()` |
| **발송 시기** | 관리자가 주문 상태를 **작업완료**(`assignment_status = 'completed'`)로 변경 시 |
| **발송 조건** | `buyer_email`이 있고, `order_accounts`에 배정된 슬롯이 존재하는 경우 |

**메일 내용**
- 계정 세팅이 완료되었음을 안내
- **Tidal ID** (실제 로그인 아이디)
- **Tidal PW** (실제 로그인 비밀번호)
- **만료 예정일** (서비스 종료 날짜)

> ⚠️ **민감 정보 포함**: Tidal 계정 ID와 비밀번호가 이메일 본문에 평문으로 포함됩니다.

**발송 포함 로직**
```
/api/admin/orders/[id]/status (PUT)
  body: { assignment_status: 'completed' }
  1. orders.assignment_status → 'completed' 업데이트
  2. 해당 주문의 order_accounts에서 tidal_id, tidal_password, end_date 조회
  3. sendAssignmentNotification() 호출  ← 여기
  4. 응답에 emailSent: true/false 포함
```

**발송 후 응답 예시**
```json
{
  "success": true,
  "emailSent": true,
  "emailError": null
}
```

---

#### ④ 서비스 만료 안내 (사용자용)

| 항목 | 내용 |
|------|------|
| **mail_type** | `'서비스 만료 안내'` |
| **수신자** | 슬롯의 `buyer_email` |
| **제목** | `[Dalbus] 서비스 만료 안내 - {구매자명}님` |
| **발송 함수** | `sendExpiryNotification()` |
| **발송 시기** | 관리자가 Tidal 계정 관리 화면에서 **수동으로 발송** |
| **발송 조건** | 관리자가 선택한 슬롯 목록에 이메일이 있는 경우 |

**메일 내용**
- 관리자가 직접 작성한 **메시지 템플릿** 사용
- 템플릿 내 치환 변수:
  - `{buyer_name}` → 구매자명
  - `{tidal_id}` → Tidal ID
  - `{end_date}` → 서비스 종료일

**발송 포함 로직**
```
/api/admin/tidal/notify (POST)
  body: {
    recipients: [{ email, buyerName, tidalId, endDate }],
    messageTemplate: "안녕하세요 {buyer_name}님..."
  }
  1. recipients 배열 순회
  2. 각 수신자마다 sendExpiryNotification() 호출
  3. 결과 집계: { successCount, failCount, failures }
```

**배치 발송 결과 응답**
```json
{
  "message": "성공: 5건, 실패: 1건",
  "successCount": 5,
  "failCount": 1,
  "failures": [{ "email": "xxx@xxx.com", "error": "..." }]
}
```

---

#### ⑤ 비밀번호 초기화 인증번호

| 항목 | 내용 |
|------|------|
| **mail_type** | `'비밀번호 초기화 인증번호'` |
| **수신자** | 비밀번호 찾기를 요청한 사용자 이메일 |
| **제목** | `[Dalbus] 비밀번호 초기화 인증번호 안내` |
| **발송 함수** | `sendPasswordResetCode()` |
| **발송 시기** | 로그인 화면 → "비밀번호를 잊으셨나요?" → 인증번호 요청 시 |
| **발송 조건** | 이름 + 이메일 + 전화번호가 `profiles` 테이블과 일치하는 경우 |

**메일 내용**
- 6자리 숫자 인증번호 (크게 강조 표시)
- **유효시간: 10분**

**발송 포함 로직**
```
/api/auth/password-reset/request (POST)
  body: { email, name, phone }
  1. profiles 테이블에서 이름+이메일+전화번호 일치 여부 확인
  2. 6자리 랜덤 인증번호 생성
  3. verification_codes 테이블에 INSERT (expires_at = 현재 + 10분)
  4. sendPasswordResetCode() 호출  ← 여기
```

**인증번호 검증 흐름**
```
/api/auth/password-reset/verify (POST)
  → verification_codes에서 code + email 일치 및 expires_at 유효성 검사

/api/auth/password-reset/confirm (POST)
  → 검증 완료 후 Supabase Auth를 통해 비밀번호 변경
```

---

### 4-3. 발송 유형 비교 요약

| # | 유형 | mail_type | 수신자 | 발송 시기 | 자동/수동 |
|---|------|-----------|--------|-----------|-----------|
| ① | 주문 접수 안내 | `주문 접수 안내` | 사용자 | 주문 생성 시 | 자동 |
| ② | 신규 주문 알림 | `주문 알림 (관리자)` | 관리자 | 주문 생성 시 | 자동 |
| ③ | 계정 세팅 완료 | `계정 세팅 완료 안내` | 사용자 | 작업완료 상태 변경 시 | 자동 |
| ④ | 서비스 만료 안내 | `서비스 만료 안내` | 사용자 | 관리자 수동 발송 | 수동 |
| ⑤ | 비밀번호 초기화 | `비밀번호 초기화 인증번호` | 사용자 | 비밀번호 찾기 요청 시 | 자동 |

---

### 4-4. 메일 발송 이력 조회 (관리자 화면)

**경로**: `/admin/mail-history`

**기능**
- 전체 발송 이력 조회 (서버사이드 페이지네이션, 기본 50건)
- **필터**: 수신자명/이메일 검색, 메일 유형(`mail_type`) 필터, 상태(성공/실패) 필터
- **정렬**: 발송 시각, 메일 유형, 수신자 이메일, 상태, 제목 기준 정렬
- **메일 내용 보기**: 발송된 HTML 본문 전체 확인 가능 (모달)
- **재발송**: 실패한 메일을 동일 내용으로 재발송
  - API: `POST /api/admin/mail-history` with `{ id: 원본메일ID }`
  - 재발송 시에도 `mail_history`에 새 레코드로 기록

**메일 상태 표시**
| 상태 | 아이콘 | 의미 |
|------|--------|------|
| `success` | ✅ 초록색 | 발송 성공 |
| `failed` | ❌ 빨간색 | 발송 실패 (재발송 버튼 활성화) |

---

*이 문서는 달버스 v1.6.1 기준으로 작성되었습니다.*
