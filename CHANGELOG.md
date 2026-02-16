# Changelog

## v0.97 - 2026-02-16

### 🔧 타입 안전성 및 빌드 안정화

#### 개선 사항 (Improvements)
1. **Admin 페이지 타입 안전성 강화**:
    - 12개 Admin 페이지 및 7개 API 라우트에서 `any` 타입을 `unknown`으로 교체
    - ESLint `no-explicit-any`, `no-unused-vars` 에러 전량 수정
    - catch 블록의 에러 처리를 `instanceof Error` 패턴으로 통일

2. **Vercel 빌드 안정화**:
    - ESLint 에러로 인한 빌드 실패 문제 해결
    - 미사용 import 및 변수 정리

## v2.9 - 2026-02-15

### 🚀 Grid View 도입 및 데이터 구조/UX 개선

#### 새로운 기능 (New Features)
1. **Grid View (격자 보기) 모드 추가**:
    - **목적**: 계정별 그룹화된 기존 List View 외에, 모든 할당 내역을 평면적인 테이블로 관리 기능 필요
    - **기능**:
        - List View / Grid View 전환 토글 버튼 추가 (상단 버튼 그룹 좌측 배치)
        - 전체 할당 내역을 단일 테이블로 조회 (ID, Tidal ID, PW, 구매자 정보, 주문번호, 시작/종료일, 마스터 정보 등)
        - 각 행에서 직접 수정(Edit), 이동(Move), 삭제(Delete) 가능
    - **UI/UX**:
        - 계정(Account) 단위로 행 병합(Row Span)하여 시각적 구조화
        - 마스터 계정 정보(Master ID)를 모든 연관 슬롯에 표시하여 식별 용이성 확보

2. **주문 번호 포맷 변경**:
    - **기존**: `ORD-YYYYMMDD-XXXX` 형식
    - **변경**: **8자리 숫자 난수** (예: `12345678`) 포맷으로 변경 (보안 및 간소화)
    - **기술적 구현**: DB Trigger/Function (`generate_order_number`) 교체 (Migration 021)

#### 개선 사항 (Improvements)
1. **Tidal ID 중복 검사 강화**:
    - **문제**: 중복된 Tidal ID 입력 시 DB 에러가 발생하여 사용자에게 불친절한 메시지 노출
    - **해결**: 백엔드 API에서 `23505` (Unique Constraint Violation) 에러를 캐치하여 "이미 사용 중인 Tidal ID입니다"라는 명확한 한글 에러 메시지 반환 처리

2. **마스터 슬롯 중복 방지**:
    - **기능**: 한 계정에 'Master' 슬롯이 이미 존재하는 경우, 추가로 Master 슬롯을 생성하려 할 때 경고 알림(Alert) 표시 및 생성 차단
    - **효과**: 데이터 무결성 보장

#### 버그 수정 및 리팩토링 (Fixes & Refactoring)
1. **TypeScript 타입 안정성 강화**:
    - API Routes (`assign`, `assignments`) 및 프론트엔드 페이지에서 `any` 타입 명시적 제거 및 올바른 타입 정의 적용
    - 빌드 시 발생하던 린트 에러 해결

#### 데이터베이스 변경 (Database Changes)
- **Migration 021**: `generate_order_number` 함수 수정 (8자리 난수 생성 로직 적용)

---

## v2.8 - 2026-02-14

### 🎯 Tidal 계정 관리 UI/UX 개선 및 슬롯 편집 기능 수정

#### 주요 개선사항

**슬롯 편집 저장 기능 수정**:
- **문제**: 슬롯 편집 시 구매자 정보(이름, 전화번호, 이메일)가 저장되지 않던 문제 해결
- **원인**: `order_accounts` 테이블에 buyer 정보 필드가 없어 `orders` 테이블 데이터만 참조
- **해결**:
  - `order_accounts` 테이블에 `buyer_name`, `buyer_phone`, `buyer_email` 컬럼 추가
  - API 엔드포인트 수정하여 슬롯별로 독립적인 구매자 정보 저장 가능
  - 데이터 표시 시 `order_accounts` 우선, `orders` 폴백 전략 적용

**마스터 정보 컬럼 추가**:
- Tidal 계정 관리 메인 테이블에 "마스터정보" 컬럼 신설
- 표시 정보: `tidal_id/종료일/이용기간` (예: chchun@hifitidal.com/2027-1-22/15개월)
- 마스터 슬롯이 없는 경우 "master 계정없음" 표시
- 가입일로부터 현재까지 경과 개월 수 자동 계산 (date-fns 활용)

**그리드 레이아웃 최적화**:
- "그룹 ID"와 "결제 ID" 컬럼을 "결제계좌" 하나로 통합
- 표시 형식: `GRP1-chchun@naver.com` (그룹ID-결제ID)
- 마스터정보 컬럼 너비 확대 (col-span-2 → col-span-3)
- 날짜가 잘려서 보이던 문제 해결

#### 데이터베이스 변경
- **Migration**: `order_accounts` 테이블에 buyer 필드 추가
  ```sql
  ALTER TABLE order_accounts
  ADD COLUMN buyer_name TEXT,
  ADD COLUMN buyer_phone TEXT,
  ADD COLUMN buyer_email TEXT;
  ```

#### API 수정
- `GET /api/admin/accounts`: `order_accounts`에서 buyer 필드 fetch 추가
- `POST /api/admin/accounts/[id]/assign`: 슬롯 배정 시 buyer 정보 저장
- `PUT /api/admin/assignments/[id]`: 슬롯 편집 시 buyer 정보 `order_accounts`에 저장
  - 기존: buyer 정보를 `orders` 테이블에만 저장
  - 변경: buyer 정보를 `order_accounts`에 저장 (슬롯별 독립 관리)

#### TypeScript 타입 업데이트
- `src/types/database.ts`: `order_accounts` 타입에 buyer 필드 추가
- `src/app/(protected)/admin/tidal/page.tsx`:
  - `Assignment` 인터페이스에 buyer 필드 추가
  - `getMasterInfo()` 헬퍼 함수 추가

#### Tailwind CSS 설정
- `tailwind.config.js`: `grid-cols-13` 지원 추가

#### 영향
- ✅ 슬롯별로 구매자 정보를 독립적으로 편집 가능
- ✅ 마스터 계정 정보를 메인 화면에서 한눈에 확인 가능
- ✅ UI 공간 효율성 개선으로 더 많은 정보 표시
- ✅ 데이터 정규화 개선 (슬롯 정보 = order_accounts, 주문 정보 = orders)

---

## v2.7 - 2026-02-11

### 🔧 Excel Import 로직 개선 및 안정화

#### 문제 해결
- **오류 수정**: `there is no unique or exclusion constraint matching the ON CONFLICT specification` 해결
- **오류 수정**: `null value in column "order_id" violates not-null constraint` 해결
- **오류 수정**: 중복 `tidal_id` 데이터로 인한 constraint 생성 실패 해결

#### 핵심 개선사항
- **조건부 Upsert 전략 도입**:
  - `tidal_id`가 있을 때: `tidal_id`로 upsert
  - `tidal_id`가 없을 때: `(account_id, slot_number)`로 기존 레코드 확인 후 UPDATE/INSERT
  - 빈 슬롯 처리 개선: `tidal_id`와 `slot_password` 모두 없을 때만 건너뛰기

- **에러 메시지 한글화**:
  - `unique constraint` → "중복된 Tidal ID 또는 슬롯 번호입니다."
  - `ON CONFLICT` → "DB 제약조건이 설정되지 않았습니다. Migration 020을 실행해주세요."
  - 사용자 친화적인 오류 메시지로 문제 해결 용이

- **데이터 검증 강화**:
  - 마스터 계정: `login_id`, `payment_email` 필수 체크
  - 슬롯 번호: 0~5 범위 검증
  - 빈 값 자동 trim 처리

- **used_slots 자동 동기화**:
  - 슬롯 임포트 완료 후 실제 배정 개수로 자동 업데이트
  - 데이터 정합성 향상

- **상세 로깅 추가**:
  - 마스터별 처리 상태 추적
  - 최종 요약 (성공/실패 개수)
  - Vercel Function Logs에서 디버깅 용이

- **주문번호 필드 지원**:
  - 엑셀 "주문번호" 컬럼 파싱
  - 기존 주문과 자동 연결

#### 데이터베이스 마이그레이션
- **Migration 018**: `accounts.login_pw` nullable 처리
  - Excel 임포트 시 초기 비밀번호 없이도 마스터 계정 생성 가능

- **Migration 019**: `order_accounts.order_id` nullable 처리
  - 레거시 슬롯 데이터 임포트 지원
  - 주문 없이 슬롯만 먼저 생성 가능

- **Migration 020**: UNIQUE constraints 추가
  - `tidal_id` UNIQUE: 1 Tidal ID = 1 Slot (중복 배정 방지)
  - `(account_id, slot_number)` UNIQUE: 1 슬롯 = 1 배정 (중복 방지)

#### 문서화
- **TROUBLESHOOT_EXCEL_IMPORT.md**: SQL 실행 가이드 및 오류 해결 방법
- **IMPORT_LOGIC_IMPROVEMENT.md**: 개선 상세 설명 및 구현 전략
- **CHANGELOG_IMPORT_FIX.md**: 변경 이력 및 테스트 시나리오
- **FIX_DUPLICATE_TIDAL_ID.sql**: 중복 데이터 정리 스크립트
- **COMPLETE_MIGRATION_SCRIPT.sql**: 통합 마이그레이션 스크립트
- **supabase/migrations/020_add_unique_tidal_id.sql**: Production용 마이그레이션 파일

#### 영향
- ✅ Migration 미실행 환경에서도 부분적으로 임포트 가능
- ✅ 중복 데이터 사전 감지 및 명확한 오류 메시지
- ✅ 부분 실패 시에도 성공 항목은 정상 저장
- ✅ 운영 중 데이터 정합성 향상

---

## v0.91 - 2026-02-09

## 📧 주문 알림 시스템 구현
- **관리자 이메일 알림**:
    - 주문 접수 시 관리자에게 이메일 자동 발송 기능 구현
    - Resend API를 활용한 `sendAdminOrderNotification` 유틸리티 생성
    - 주문 정보 (고객명, 연락처, 서비스, 금액, 요금제) 포함
- **보안 강화**:
    - 클라이언트에서 직접 DB 접근 제거
    - `/api/orders` 서버 API 라우트 생성하여 주문 생성 및 알림 로직 분리

## 🔍 관리자 주문 관리 고도화
- **Multi-Select 필터**:
    - **Status 필터**: 여러 주문 상태(주문신청, 입금확인, 배정완료, 작업완료)를 동시 선택하여 필터링
    - `DataTableFacetedFilter` 재사용 가능 컴포넌트 생성
    - shadcn/ui 컴포넌트(`popover`, `command`, `checkbox`, `separator`, `badge`) 추가
- **전화번호 검색**:
    - 전화번호 입력 필드를 통한 실시간 검색 기능
    - Status 필터와 전화번호 검색을 동시 적용 가능
- **UI 개선**:
    - 필터를 오른쪽 정렬로 배치하여 가독성 향상
    - 전화번호 검색 → Status 필터 순서로 배치

## 📊 Excel 내보내기 기능 추가
- **주문 내역 Export**:
    - 회원 주문과 비회원 주문을 별도 시트로 분리하여 `.xlsx` 형식 다운로드
    - 각 시트에 날짜, 주문번호, 고객명, 이메일, 연락처, 서비스, 이용기간, 금액, 상태 포함
- **Tidal 계정 Export**:
    - 마스터 계정 정보 (마스터 ID, 결제 계정, 결제일, 메모) 표시
    - 각 마스터 계정마다 6개 고정 Slot 정보를 하위 행으로 표시 (빈 슬롯은 공란)
    - Slot 정보: 고객명, 주문번호, 소속 ID, 소속 PW, 시작일, 종료일
- **xlsx 라이브러리 설치**: `npm install xlsx`

## 📱 모바일 UI/UX 최적화 (기존)
- **헤더 리팩토링**:
    - 모바일 화면에서 브랜드 로고 상시 노출
    - 모바일에서 숨겨져 있던 주 메뉴(서비스, 공지사항, FAQ, Q&A)를 가로 스크롤 형태로 상시 노출 처리
    - 메뉴명 간소화: '서비스 목록' → **'서비스'**
- **반응형 디자인**:
    - 모바일 기기에서의 버튼 크기, 텍스트 가독성 및 터치 편의성 조정

## 🛒 주문 및 결제 프로세스 개선 (기존)
- **주문 완료 전용 페이지 신설**:
    - 기존 브라우저 `alert()` 알림을 전용 결과 페이지(`/public/checkout/success`)로 대체
    - 주문 내역 요약(서비스명, 이용 기간, 결제 금액, 입금자명, 입금 계좌) 시각화
- **결제 UI 디테일**:
    - '전체동의' 시 '구독하기' 버튼 색상을 **검정색 배경/흰색 글자**로 명확하게 변경
    - 이용 기간(개월 수) 정보가 누락되지 않도록 체크아웃 및 결과 페이지 로직 보완

## 📊 주문 내역 관리 강화 (기존)
- **이용 기간 표시 추가**:
    - **관리자**: 주문 내역 목록에서 각 주문의 구독 기간(개월)을 바로 확인할 수 있도록 수정
    - **사용자**: 마이페이지 '내 구독 정보' 카드에 이용 기간 정보 추가
- **마이페이지 최적화**:
    - DB v2.0 스키마 변경 사항에 맞춰 마이페이지 데이터 로드 로직 전면 수정 및 최적화

## 📢 공지사항 및 FAQ 관리 시스템 고도화 (기존)
- **공지사항 관리 기능**:
    - 관리자 전용 공지사항 CRUD(생성, 조회, 수정, 삭제) 기능 구현
    - 공지사항 상단 고정(Pin) 및 게시 상태 설정 기능 추가
    - 동적 카테고리 시스템 도입 (`notice_categories` 테이블 생성 및 연동)
- **FAQ 개선**:
    - 사용자 페이지에서 '1:1 문의하기' 섹션 제거 요청 반영
    - 관리자 FAQ 카테고리 관리 기능 안정화

## 🛠️ 기술적 수정 사항
- **API 안정화**: 주문 생성 API(`/api/orders`) 구현 및 예외 처리
- **이메일 라이브러리**: Resend 통합 (`npm install resend`)
- **Excel 라이브러리**: xlsx 통합 (`npm install xlsx`)
- **린트 오류 해결**: 사용하지 않는 타입 제거 및 타입 정의 보완
- **환경변수**: `RESEND_API_KEY` 추가 (.env.local)
