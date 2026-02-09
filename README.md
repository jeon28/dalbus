# Dalbus (달버스) - 프리미엄 구독 공유 플랫폼 (v2.2)

Dalbus는 Tidal과 같은 프리미엄 OTT 및 스트리밍 서비스의 구독료를 절감하기 위해 사용자들을 매칭해주는 플랫폼입니다. 현대적인 Glassmorphism 디자인과 모바일 퍼스트 전략을 사용하여 프리미엄한 사용자 경험을 제공합니다.

---

## 🚀 주요 기능 (Features)

### 👤 사용자 (User)
- **상품 탐색**: Glassmorphism UI 기반의 세련된 상품 목록 및 상세 페이지
- **주문 및 결제**: 단계별 주문 프로세스 및 무통장 입금/카드 결제 지원
- **주문 결과**: 전용 주문 성공 페이지(`/public/checkout/success`)를 통한 상세 정보 확인
- **마이페이지**: 구독 중인 서비스의 계정 정보(ID/PW) 확인 및 주문 내역 관리
- **고객지원**: 공지사항, FAQ, Q&A 게시판(비회원/비밀글 지원) 및 채널톡 연동

### 🛡️ 관리자 (Admin)
- **대시보드**: 실시간 주문 현황, 매출 요약 및 배정 대기 건 관리
- **회원 관리**: 가입 회원 목록 조회 및 관리
- **서비스/상품 관리**: 공유 서비스 항목 및 기간별 요금제(1/3개월 등) 동적 관리
- **공지/FAQ 관리**: **동적 카테고리 시스템**이 적용된 공지사항 및 FAQ 관리
- **운영 설정**: 무통장 입금 계좌(은행, 계좌번호, 예금주) 실시간 설정 및 반영

---

## 🛠 정보 및 설치법 (Documentation & Setup)

상세한 기획 및 설계 내용은 `docs/` 디렉토리를 참고하세요.
- [요구사항 정의서 (PRD)](docs/prd.md)
- [화면 흐름도 (Screen Flow)](docs/screen_flow.md)
- [화면 명세서 (Screen Spec)](docs/screen_spec.md)

### 1) 설치법
이 프로젝트는 **Next.js 15**를 기반으로 작성되었습니다.
```bash
git clone <repository-url>
cd dalbus
npm install
```

### 2) 환경 변수 설정 (.env.local)
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## 📂 디렉토리 구조 (Directory Structure)

```text
dalbus/
├── docs/               # PRD, 설계 문서 (v2.2 기준 현행화 완료)
├── src/
│   ├── app/
│   │   ├── (protected)/# 인증이 필요한 페이지 (RBAC 적용)
│   │   │   ├── admin/  # 관리자 대시보드, 회원/주문/상품/게시판 관리
│   │   │   ├── mypage/ # 사용자 프로필 및 구독 현황
│   │   ├── api/        # Next.js Route Handlers (Supabase 연동)
│   │   ├── public/     # 비로그인 접근 가능 페이지 (공지/FAQ/Q&A/상품)
│   │   ├── service/    # 상품 상세 및 구매 flow
│   ├── components/     # UI 공통 컴포넌트 (Shadcn/UI 기반)
│   ├── lib/            # 전역 Context, Supabase Client, 유틸리티
├── supabase/           # DB Schema 및 Migration SQL 파일
└── public/             # 정적 자산 (이미지, 로고)
```

---

## 💻 기술 스택 (Tech Stack)

- **Core**: Next.js 15 (App Router), React 19, TypeScript
- **Database**: Supabase (PostgreSQL, Auth, RLS)
- **Styling**: Tailwind CSS, Shadcn/UI, Vanilla CSS (Glassmorphism)
- **Icons**: Lucide React
- **Deployment**: Vercel

---

## 📄 업데이트 이력 (Changelog)
- **v2.2 (2026-02-09)**: 주문 성공 결과 페이지 도입, 공지/FAQ 동적 카테고리 시스템, 관리자 운영 설정(계좌 관리) 추가, 모바일 헤더 최적화
- **v2.1 (2025-02-08)**: 회원 관리 및 Q&A 게시판(비회원 지원) 고도화
- **v2.0 (2025-02-07)**: PRD 기반 핵심 기능 및 UI 전면 개편 (Tidal 연동)
