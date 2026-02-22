# Changelog - 2026.02.22

## [v1.3.0] 알림 시스템 복구 및 주문 번호 체계 고도화 (2026.02.22)

### 🔔 알림 시스템 고도화 및 버그 수정
- **관리자 알림 복구**: `site_settings` 테이블의 Key-Value 스키마 매칭 오류로 인한 알림 누락 문제 해결.
- **알림 메일 커스터마이징**: 
    - 주문 번호를 UUID에서 `order_number`로 변경하여 가독성 향상.
    - 관리자 대시보드 링크를 프로덕션 도메인(`dalbus.vercel.app`)으로 최적화.

### 🔢 주문 체계 및 데이터 구조 개선
- **날짜 기반 주문 번호 도입**: 8자리 난수 방식에서 `YYMMDDNN`(연도-2020/월일/순번) 체계로 변경 (Migration 027).
- **스키마 문서 반영**: `docs/db_schema.md`에 변경된 주문 번호 정의 및 스키마 구조 최신화.

### 📚 문서화 강화
- **Hands-on 블로그 가이드**: Antigravity 협업을 통한 서비스 구축 전 과정을 담은 `docs/blog_guide.md` 신규 작성.

---


## [v2.5] 공용 페이지 로딩 안정화 및 인증 UX 개선 (2026.02.18)

### 🚀 공용 페이지 데이터 로딩 안정화 (Public Page Stability)
- **API 프록시 구현**: Supabase RLS 보안 정책으로 인해 비로그인 사용자의 데이터 접근이 제한되던 문제를 해결하기 위해 서버 사이드 API 프록시(`supabaseAdmin` 활용) 전면 도입.
    - 대상 페이지: 공지사항(`/public/notices`), FAQ(`/public/faq`), Q&A(`/public/qna`), 서비스 상세(`/service/[id]`)
- **무한 로딩 및 에러 핸들링 개선**: 
    - 네트워크 중단(`AbortError`) 발생 시에도 로딩 상태가 해제되도록 `finally` 블록 로직 강화.
    - `AbortError` 및 Next.js 내부 리다이렉트 발생 시 콘솔 에러가 발생하지 않도록 조용히 무시 처리.

### 🛒 상품 및 요금제 노출 정책 강화 (Product & Plan Management)
- **비정상/비활성 요금제 필터링**: 공용 상품 조회 API에서 `is_active: false`인 요금제를 원천적으로 필터링하여 사용자에게 혼선을 주지 않도록 개선.
- **ServiceContext 최적화**: direct DB 쿼리에서 API 기반 조회 방식으로 전환하여 프론트엔드와 백엔드 간 결합도 해제.

### 🔐 인증 UX 및 로그아웃 견고화 (Auth UX & Logout Robustness)
- **로그아웃 즉각 반응 구현**: Supabase `signOut` 호출 결과와 관계없이 로컬 상태(LocalStorage, State)를 선제적으로 초기화.
- **로그아웃 타임아웃 방지**: `Promise.race`를 도입하여 인증 서버 지연 시에도 2초 내에 강제로 로그인 페이지로 리다이렉트되도록 구현.

### 🛠️ 빌드 및 코드 품질 (Build & Code Quality)
- **TS 타입 안정성 확보**: `ServiceContext.tsx` 내 `any` 타입을 `ProductResponse` 인터페이스로 대체하여 `npm run build` 실패 문제 해결.
- **Next.js 15 호환성**: 최신 버전에서의 `next lint` 기능 확인 및 빌드 최적화 완료.

---

## [v2.4] 관리 기능 고도화 및 시스템 안정화 (2026.02.16)

### 📝 관리자 전용 메모 기능 (Admin Member Memo)
- **회원 메모 필드 추가**: 가입 회원별로 관리자만 작성/열람할 수 있는 `memo` 필드 신설.
- **관리 UI 통합**: `어드민 > 회원 관리` 페이지에서 각 회원의 메모를 실시간으로 확인하고 수정할 수 있는 기능 구현.
- **스크립트 지원**: `026_add_memo_to_profiles.sql` 마이그레이션을 통한 DB 스키마 반영.

### 📊 Tidal 계정 관리 그리드 뷰 고도화 (Tidal Management Grid Refinement)
- **인라인 편집 강화**: 마스터 계정의 ID, PW, 결제 정보 등을 목록에서 즉시 수정 가능하도록 개선.
- **통합 관리 액션**: 관리(Action) 열을 통해 배정 수정, 이동, 비활성화, 삭제 작업을 원클릭으로 수행 가능.
- **레이아웃 및 정렬 최적화**: 
    - 종료일(End Date)과 개월(Months) 컬럼 위치 정렬 및 데이터 매핑 오류 수정.
    - 헤더 버튼 재배치 (Title 옆 View Toggle, 검색 및 엑셀 버튼 그룹화).

### 🛠️ 시스템 빌드 및 타입 안정성 (Build & Stability)
- **ESLint/TypeScript 오류 전면 해소**: 
    - 프로덕션 빌드(`npm run build`)를 저해하던 `any` 타입 및 미사용 변수 제거.
    - 변수 섀도잉(Shadowing) 및 중복 선언 방지를 위한 코드 리팩토링.
- **데이터 안전성 강화**: 
    - 엑셀 내보내기 및 필터링 로직에서 `null`/`undefined` 값에 대한 방어 코드 적용.
    - 타입 가드(Type Guard) 및 전용 인터페이스(`FlatAssignment`) 도입으로 런타임 에러 방지.

---

## [v2.3] 만료 계정 관리 시스템 (2026.02.16)

### 🕒 만료 계정 관리 (Expired Account Management)
- **만료 상태 시각화**:
    - `TidalAccounts` 목록에서 종료일(`end_date`)이 지난 배정에 대해 빨간색 "만료" 배지 표시.
- **배정 비활성화 (Deactivation)**:
    - 만료된 배정을 즉시 "종료(비활성화)" 처리하여 슬롯을 회수할 수 있는 기능 추가.
    - 비활성화 시 `order_accounts`의 `is_active` 상태가 `false`로 변경되며 목록에서 즉시 숨김 처리.
- **지난 내역 조회 (Inactive History)**:
    - 비활성화된 배정 이력을 별도로 조회할 수 있는 `/admin/tidal/inactive` 페이지 신설.
    - 영구 삭제(Hard Delete) 기능 지원.
- **만료 필터 (Expired Filter)**:
    - 관리자 목록에서 만료된 배정이 포함된 계정만 빠르게 필터링하여 볼 수 있는 토글 기능 추가.

### 💾 데이터베이스 변경 (Database Changes)
- **Schema Update**: `order_accounts` 테이블에 `is_active` (boolean, default true) 컬럼 추가.
- **Index Optimization**: `tidal_id` 유니크 제약 조건을 `CHECK (is_active = true)` 조건부 인덱스로 변경하여, 비활성화된 계정의 ID 재사용 지원.

---

## [v2.2] 주문 자동화 및 운영 도구 고도화 (2026.02.16)

### 🚀 주문 매칭 및 자동화 (Order Assignment & Automation)
- **신규/연장 주문 매칭 통합**: 신규 및 연장 주문의 배정 프로세스를 하나의 모달 UI로 통합하여 운영 효율 개선.
- **Tidal ID/PW 자동 생성**: 
    - 고객 이메일을 기반으로 고유한 Tidal ID 자동 생성 (중복 체크 포함).
    - 고객 연락처를 시드(Seed)로 사용하는 보안 비밀번호 자동 생성.
- **배정 즉시 관리 연동**: 배정 완료 후 해당 마스터 계정의 Tidal 관리 페이지가 새 탭에서 열리도록 개선.
- **주무 조회 API 수정**: 비회원 주문 조회가 비정상적으로 작동하던 API(`/api/orders/lookup`) 오류 수정 및 보안 강화.

### 🧹 데이터베이스 고도화 (Database Optimization)
- **스키마 정규화**: `orders` 테이블에 중복 저장되던 `start_date`, `end_date` 컬럼을 제거하고 `order_accounts`로 일원화.
- **데이터 클렌징**: 잘못 기입된 날짜 데이터 및 비정규화된 필드 동기화 수행.

### 🛠 운영 도구 및 유틸리티 (Internal Tools)
- **로거(Logger) 유틸리티 도입**: `debug`, `info`, `warn`, `error` 레벨을 지원하는 Java 스타일의 커스텀 로거(`src/lib/logger.ts`) 구현.
- **환경 변수 제어**: `NEXT_PUBLIC_LOG_LEVEL`을 통한 실시간 로그 레벨 제어 기능 추가.

---

## [v2.1] 관리자 기능 보강 (2026.02.09)

### 🔐 인증 시스템 (Auth & Validation)
- **회원가입 UX 최적화**: 
    - 아이디(이메일) 형식 실시간 검증 및 에러 메시지 시각화 개선 (빨간색 텍스트).
    - 입력 오류 시 포커스가 다른 필드로 넘어가지 않고 해당 필드에 유지되도록 수정.
    - 비밀번호 강도(6자 이상) 및 비밀번호 확인 일치 불일치 체크 로직 강화.
- **버튼 디자인 보정**: '가입하기' 버튼의 텍스트 색상을 검은색(#000000)으로 고정하여 시인성 확보.

### 📢 지원 페이지 (Support Pages)
- **공지사항(Notices) 구현**: Supabase `notices` 테이블 연동, 중요 공지 고정(Pinned) 및 카테고리별 배지 시스템 적용.
- **FAQ 페이지 구현**: `faqs` 테이블 연동 및 카테고리 필터링이 가능한 아코디언 컴포넌트 구현.
- **데이터 로딩 개선**: 데이터 로딩 중 스피너 표시 및 상세 에러 로깅(`JSON.stringify`) 적용으로 디버깅 편의성 증대.

### 📁 프로젝트 구조 및 관리 (Operations)
- **README 이동**: 접근성 향상을 위해 `docs/README.md`를 루트 디렉토리로 이동.
- **데이터 시딩 강화**: 개발 및 관리자 대시보드 테스트를 위한 대규모 샘플 데이터(`004_sample_test_data.sql`) 추가.
- **이미지 최적화**: 서비스 목록의 이미지가 깨지는 현상을 해결하기 위해 SVG 포맷 및 경로 최적화.

---

## [Supabase 백엔드 통합]
- **인증 시스템**: Supabase Auth를 연동하여 실제 회원가입 및 로그인 기능 구현.
- **실시간 데이터**: `ServiceContext`를 통해 Supabase DB의 서비스 및 가격 정보를 실시간으로 연동.
- **주문 및 매칭**: 서비스 상세 페이지에서 실제 주문 생성 로직 구현 및 마이페이지에서 배정된 계정 정보 확인 가능.
- **어드민 대시보드**: DB 기반 실시간 매출 통계 및 주문 내역 조회 기능 구현.

---
*2026-02-07 - Antigravity AI Assistant*
