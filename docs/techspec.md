# [달버스(Dalbus)] 기술 구현 가이드 v2.4

> **문서 목적**: 화면 설계서(Screen Flow)와 요구사항 정의서(PRD)를 기반으로, Next.js + Supabase + Vercel 스택에서 실제 구현 가능한 수준의 기술 명세를 제공한다.
> **작성일**: 2025-02-07 | **대상 독자**: 프론트엔드/풀스택 개발자, 프로젝트 매니저

---

## 목차

1. [아키텍처 개요](#1-아키텍처-개요)
2. [기술 스택 상세](#2-기술-스택-상세)
3. [프로젝트 초기 설정](#3-프로젝트-초기-설정)
4. [디렉토리 구조](#4-디렉토리-구조)
5. [Supabase 데이터베이스 설계](#5-supabase-데이터베이스-설계)
6. [인증(Authentication) 구현](#6-인증authentication-구현)
7. [주요 페이지별 구현 상세](#7-주요-페이지별-구현-상세)
8. [결제 연동 (PortOne V2)](#8-결제-연동-portone-v2)
9. [알림 시스템 (SMS/알림톡)](#9-알림-시스템-sms알림톡)
10. [관리자(Admin) 시스템](#10-관리자admin-시스템)
11. [모바일 최적화 전략](#11-모바일-최적화-전략)
12. [SEO 및 검색엔진 최적화](#12-seo-및-검색엔진-최적화)
13. [보안 체크리스트](#13-보안-체크리스트)
14. [Vercel 배포 및 도메인 설정](#14-vercel-배포-및-도메인-설정)
15. [CI/CD 파이프라인](#15-cicd-파이프라인)
16. [모니터링 및 에러 추적](#16-모니터링-및-에러-추적)
17. [운영비 시뮬레이션](#17-운영비-시뮬레이션)

---

## 1. 아키텍처 개요

### 1.1 시스템 구성도

```
┌─────────────────────────────────────────────────────────┐
│                     사용자 (모바일/PC)                      │
│                  Chrome / Safari / Samsung               │
└─────────────────┬───────────────────────┬───────────────┘
                  │ HTTPS                 │ HTTPS
                  ▼                       ▼
┌─────────────────────────┐  ┌────────────────────────────┐
│    Vercel Edge Network   │  │    PortOne PG Gateway       │
│  ┌───────────────────┐  │  │  ┌──────────────────────┐  │
│  │  Next.js App       │  │  │  │  KG이니시스/토스      │  │
│  │  (App Router)      │  │  │  │  카카오페이/토스페이   │  │
│  │  - SSR/SSG/ISR     │  │  │  └──────────────────────┘  │
│  │  - API Routes      │  │  └────────────────────────────┘
│  │  - Middleware       │  │
│  └────────┬──────────┘  │       ┌────────────────────┐
└───────────┼─────────────┘       │  솔라피 (Solapi)    │
            │ TCP/HTTP             │  알림톡 / SMS        │
            ▼                      └────────────────────┘
┌─────────────────────────────┐         ▲
│      Supabase Cloud          │         │ REST API
│  ┌────────────────────────┐ │         │
│  │  PostgreSQL Database    │ │ ────────┘
│  │  + RLS (Row Level Sec)  │ │
│  ├────────────────────────┤ │
│  │  Supabase Auth          │ │
│  │  (JWT + OAuth)          │ │
│  ├────────────────────────┤ │
│  │  Supabase Storage       │ │
│  │  (이미지 등)             │ │
│  ├────────────────────────┤ │
│  │  Edge Functions         │ │
│  │  (Cron Jobs)            │ │
│  └────────────────────────┘ │
└─────────────────────────────┘

┌─────────────────────────────┐
│   외부 서비스 연동             │
│  • ChannelTalk (고객 상담)    │
│  • Google Analytics 4        │
│  • Google Search Console     │
│  • Sentry (에러 추적)         │
└─────────────────────────────┘
```

### 1.2 데이터 흐름 (Happy Path)

```
[사용자]                    [Vercel/Next.js]              [Supabase]              [외부]
   │                            │                           │                      │
   │── 랜딩 접속 ──────────────▶│                           │                      │
   │                            │── SSG 캐시 반환 ─────────▶│                      │
   │◀── HTML + Hydration ──────│                           │                      │
   │                            │                           │                      │
   │── 상품 선택 + 결제 ────────▶│                           │                      │
   │                            │── auth.getUser() ────────▶│                      │
   │                            │◀── JWT 검증 완료 ─────────│                      │
   │                            │── PortOne SDK 호출 ──────▶│                ──────▶│ PG사
   │◀── 결제창 팝업 ─────────────│                           │                      │
   │── 결제 승인 ───────────────▶│                           │                      │
   │                            │── Webhook 수신 ──────────▶│                      │
   │                            │── INSERT orders ─────────▶│                      │
   │◀── 결제완료 화면 ──────────│                           │                      │
   │                            │                           │                      │
   │      [관리자]               │                           │                      │
   │── 배정 완료 ───────────────▶│                           │                      │
   │                            │── UPDATE orders ─────────▶│                      │
   │                            │── 솔라피 API ─────────────▶│                ──────▶│ SMS 발송
   │                            │                           │                      │
```

### 1.3 핵심 설계 원칙

| 원칙 | 설명 | 적용 |
|------|------|------|
| **Mobile-First** | 모바일 사용자 80% 이상 가정 | 전 화면 모바일 우선 설계, 터치 최적화 |
| **Server-First** | 서버 컴포넌트 우선 사용 | 클라이언트 번들 최소화, SEO 최적화 |
| **Zero Backend** | 별도 백엔드 서버 없음 | Supabase + Next.js API Routes로 전부 처리 |
| **Free-First** | 무료 티어 최대 활용 | 유료 전환 시점을 명확히 정의 |
| **SEO-Ready** | 검색엔진 노출 최적화 | SSG/ISR, 구조화 데이터, 사이트맵 자동 생성 |

---

## 2. 기술 스택 상세

### 2.1 코어 스택

| 구분 | 기술 | 버전 | 선정 이유 |
|------|------|------|----------|
| **Framework** | Next.js (App Router) | 15.x | SSR/SSG/ISR 지원, Vercel 최적화 |
| **Language** | TypeScript | 5.x | 타입 안전성, 코드 자동완성 |
| **Styling** | Tailwind CSS | 3.x | 모바일-퍼스트 유틸리티, 빠른 개발 |
| **UI Library** | shadcn/ui | latest | Radix 기반, 접근성 보장, 커스터마이징 용이 |
| **Database** | Supabase (PostgreSQL) | - | Auth + DB + Storage 올인원 |
| **Hosting** | Vercel | Hobby(무료) | Next.js 최적 배포, Edge Network |
| **Payment** | PortOne V2 SDK | - | 국내 PG 25개사 통합, 월 5천만원 미만 무료 |

### 2.2 보조 라이브러리

| 라이브러리 | 용도 | 비고 |
|-----------|------|------|
| `@supabase/ssr` | Supabase 서버사이드 클라이언트 | App Router 필수 |
| `@portone/browser-sdk` | 결제창 호출 | V2 SDK |
| `zustand` | 클라이언트 상태 관리 | 가볍고 심플 |
| `react-hook-form` + `zod` | 폼 관리 + 유효성 검증 | 서버-클라이언트 통합 검증 |
| `date-fns` | 날짜 계산 (D-Day 등) | 트리셰이킹 지원 |
| `lucide-react` | 아이콘 | shadcn/ui 기본 아이콘 |
| `next-sitemap` | 사이트맵 자동 생성 | SEO 필수 |
| `@vercel/analytics` | 방문 분석 | Vercel 무료 제공 |
| `@sentry/nextjs` | 에러 추적 | 무료 5K 이벤트/월 |

### 2.3 개발 도구

```bash
# 코드 품질
eslint + prettier + typescript-eslint
husky + lint-staged       # Git hook 기반 자동 검사

# 테스트 (MVP 이후)
vitest                    # 단위 테스트
playwright                # E2E 테스트
```

---

## 3. 프로젝트 초기 설정

### 3.1 프로젝트 생성

```bash
# Next.js 프로젝트 생성
npx create-next-app@latest dalbus-web \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"

cd dalbus-web

# 핵심 의존성 설치
npm install @supabase/supabase-js @supabase/ssr
npm install zustand date-fns lucide-react
npm install react-hook-form @hookform/resolvers zod
npm install next-sitemap

# shadcn/ui 초기화
npx shadcn-ui@latest init
# → Style: Default
# → Base color: Slate
# → CSS variables: Yes

# shadcn/ui 컴포넌트 설치
npx shadcn-ui@latest add button card input label \
  dialog sheet toast badge separator tabs \
  select dropdown-menu avatar skeleton \
  accordion form table
```

### 3.2 환경 변수 설정

```env
# .env.local (로컬 개발용 - Git에 절대 포함하지 않음)

# ── Supabase ──
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...          # 서버 전용, 절대 클라이언트 노출 금지

# ── PortOne ──
NEXT_PUBLIC_PORTONE_STORE_ID=store-xxxxx
NEXT_PUBLIC_PORTONE_CHANNEL_KEY=channel-xxxxx
PORTONE_API_SECRET=xxxxxxxx                       # 서버 전용

# ── 솔라피 (SMS/알림톡) ──
SOLAPI_API_KEY=xxxxx
SOLAPI_API_SECRET=xxxxx
SOLAPI_SENDER_PHONE=01012345678

# ── 사이트 ──
NEXT_PUBLIC_SITE_URL=https://dalbus.kr            # 도메인 매핑 후 변경
NEXT_PUBLIC_SITE_NAME=달버스

# ── 외부 서비스 ──
NEXT_PUBLIC_CHANNEL_TALK_KEY=xxxxx
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXX
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
```

### 3.3 Supabase 프로젝트 생성

```
1. https://supabase.com 접속 → 회원가입 (GitHub 연동 추천)
2. "New Project" 클릭
   - Organization: Personal (또는 새로 생성)
   - Project name: dalbus-prod
   - Database Password: [강력한 비밀번호 생성 → 별도 저장]
   - Region: Northeast Asia (ap-northeast-1) ← 한국 사용자 대상 필수
   - Pricing Plan: Free ($0/month)
3. 프로젝트 생성 후 Settings > API에서 URL, anon key, service role key 복사
```

---

## 4. 디렉토리 구조

```
dalbus-web/
├── src/
│   ├── app/                          # ← Next.js App Router
│   │   ├── (public)/                 # 비로그인 접근 가능 그룹
│   │   │   ├── page.tsx              # SCR_LAND_001: 랜딩
│   │   │   ├── products/
│   │   │   │   ├── page.tsx          # SCR_SHOP_001: 상품 목록
│   │   │   │   └── [slug]/
│   │   │   │       └── page.tsx      # SCR_SHOP_002: 상품 상세
│   │   │   ├── notices/
│   │   │   │   ├── page.tsx          # SCR_NOTICE_001: 공지 목록
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx      # SCR_NOTICE_002: 공지 상세
│   │   │   └── faq/
│   │   │       └── page.tsx          # SCR_FAQ_001: FAQ
│   │   │
│   │   ├── (auth)/                   # 인증 관련 그룹
│   │   │   ├── login/
│   │   │   │   └── page.tsx          # SCR_AUTH_001: 로그인
│   │   │   ├── signup/
│   │   │   │   └── page.tsx          # SCR_AUTH_002: 회원가입
│   │   │   ├── reset-password/
│   │   │   │   └── page.tsx          # SCR_AUTH_003: 비밀번호 리셋 요청
│   │   │   └── update-password/
│   │   │       └── page.tsx          # SCR_AUTH_004: 비밀번호 변경
│   │   │
│   │   ├── (protected)/              # 로그인 필수 그룹
│   │   │   ├── layout.tsx            # 인증 체크 미들웨어
│   │   │   ├── mypage/
│   │   │   │   ├── page.tsx          # SCR_MY_001: 마이페이지 (구독현황)
│   │   │   │   ├── orders/
│   │   │   │   │   └── page.tsx      # SCR_MY_002: 주문내역
│   │   │   │   └── profile/
│   │   │   │       └── page.tsx      # SCR_MY_003: 프로필 수정
│   │   │   └── payment/
│   │   │       ├── page.tsx          # SCR_PAY_001: 결제 처리
│   │   │       ├── success/
│   │   │       │   └── page.tsx      # SCR_PAY_002: 결제 성공
│   │   │       └── fail/
│   │   │           └── page.tsx      # SCR_PAY_003: 결제 실패
│   │   │
│   │   ├── admin/                    # 관리자 전용
│   │   │   ├── layout.tsx            # 관리자 권한 체크
│   │   │   ├── page.tsx              # SCR_ADM_001: 주문 대시보드
│   │   │   ├── assign/
│   │   │   │   └── [orderId]/
│   │   │   │       └── page.tsx      # SCR_ADM_002: 계정 배정
│   │   │   ├── products/
│   │   │   │   └── page.tsx          # SCR_ADM_003: 상품 관리
│   │   │   ├── accounts/
│   │   │   │   └── page.tsx          # SCR_ADM_004: 계정풀 관리
│   │   │   ├── content/
│   │   │   │   └── page.tsx          # SCR_ADM_005: 공지/FAQ 관리
│   │   │   └── stats/
│   │   │       └── page.tsx          # SCR_ADM_006: 매출 통계
│   │   │
│   │   ├── api/                      # API Routes (서버 전용)
│   │   │   ├── payment/
│   │   │   │   ├── verify/
│   │   │   │   │   └── route.ts      # 결제 검증 API
│   │   │   │   └── webhook/
│   │   │   │       └── route.ts      # PortOne 웹훅 수신
│   │   │   ├── notifications/
│   │   │   │   └── send/
│   │   │   │       └── route.ts      # SMS/알림톡 발송
│   │   │   └── cron/
│   │   │       └── expiry-check/
│   │   │           └── route.ts      # 만료 D-7, D-1 체크
│   │   │
│   │   ├── layout.tsx                # 루트 레이아웃
│   │   ├── not-found.tsx             # 404 페이지
│   │   ├── error.tsx                 # 에러 바운더리
│   │   ├── loading.tsx               # 글로벌 로딩
│   │   ├── robots.ts                 # SEO: robots.txt 동적 생성
│   │   ├── sitemap.ts                # SEO: sitemap.xml 동적 생성
│   │   └── manifest.ts              # PWA: manifest.json
│   │
│   ├── components/
│   │   ├── ui/                       # shadcn/ui 컴포넌트 (자동 생성)
│   │   ├── layout/
│   │   │   ├── Header.tsx            # 반응형 헤더 + 모바일 햄버거
│   │   │   ├── Footer.tsx            # 사이트 푸터
│   │   │   ├── MobileNav.tsx         # 모바일 바텀 네비게이션
│   │   │   └── ChannelTalk.tsx       # 채널톡 위젯
│   │   ├── landing/
│   │   │   ├── HeroSection.tsx       # 히어로 배너
│   │   │   ├── PriceComparison.tsx   # 가격 비교 테이블
│   │   │   ├── StepGuide.tsx         # 3단계 이용 가이드
│   │   │   └── ReviewCarousel.tsx    # 후기 캐러셀
│   │   ├── product/
│   │   │   ├── ProductCard.tsx       # 서비스 카드
│   │   │   ├── ProductDetail.tsx     # 상세 정보
│   │   │   └── PeriodSelector.tsx    # 기간/가격 선택
│   │   ├── mypage/
│   │   │   ├── SubscriptionCard.tsx  # 구독 현황 카드 (ID/PW 표시)
│   │   │   ├── CopyButton.tsx        # 복사 버튼 (📋)
│   │   │   └── DDayBadge.tsx         # D-Day 카운트다운
│   │   └── admin/
│   │       ├── OrderTable.tsx        # 주문 목록 테이블
│   │       ├── AssignForm.tsx        # 계정 배정 폼
│   │       ├── StatsChart.tsx        # 매출 차트
│   │       └── AccountPoolList.tsx   # 계정풀 목록
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts             # 브라우저용 Supabase 클라이언트
│   │   │   ├── server.ts             # 서버 컴포넌트용 클라이언트
│   │   │   ├── admin.ts              # Service Role 클라이언트 (API Route 전용)
│   │   │   └── middleware.ts         # 미들웨어용 클라이언트
│   │   ├── portone.ts                # PortOne 결제 유틸
│   │   ├── solapi.ts                 # 솔라피 SMS 유틸
│   │   └── utils.ts                  # 공통 유틸리티
│   │
│   ├── hooks/
│   │   ├── useAuth.ts                # 인증 상태 훅
│   │   ├── useCopyToClipboard.ts     # 클립보드 복사
│   │   └── useCountdown.ts           # D-Day 카운트다운
│   │
│   ├── stores/
│   │   └── cartStore.ts              # 결제 전 임시 상태 (zustand)
│   │
│   └── types/
│       ├── database.ts               # Supabase 자동 생성 타입
│       └── index.ts                  # 커스텀 타입 정의
│
├── public/
│   ├── og-image.png                  # 소셜 공유 이미지 (1200x630)
│   ├── favicon.ico
│   ├── icons/                        # PWA 아이콘
│   └── images/
│       └── services/                 # 서비스 로고 (tidal.png 등)
│
├── supabase/
│   └── migrations/                   # DB 마이그레이션 SQL
│       ├── 001_create_tables.sql
│       ├── 002_rls_policies.sql
│       ├── 003_functions.sql
│       └── 004_seed_data.sql
│
├── middleware.ts                      # Next.js 미들웨어 (인증 리프레시)
├── next.config.ts
├── tailwind.config.ts
├── next-sitemap.config.js            # 사이트맵 설정
├── .env.local                        # 환경변수 (Git 제외)
├── .env.example                      # 환경변수 템플릿
└── package.json
```

---

## 5. Supabase 데이터베이스 설계

### 5.1 ERD (Entity Relationship Diagram)

```
┌──────────────────┐       ┌──────────────────────────┐
│     profiles      │       │       products            │
├──────────────────┤       ├──────────────────────────┤
│ id (PK, FK→auth) │       │ id (PK, uuid)             │
│ email             │       │ slug (unique)             │
│ name              │       │ name                      │
│ phone             │       │ description               │
│ role (enum)       │──┐   │ original_price (integer)  │
│ created_at        │  │   │ benefits (text[])          │
│ updated_at        │  │   │ cautions (text[])          │
└──────────────────┘  │   │ image_url                  │
                       │   │ tags (text[])              │
                       │   │ is_active (boolean)        │
                       │   │ sort_order (integer)       │
                       │   │ created_at                 │
                       │   └──────────┬───────────────┘
                       │              │
                       │   ┌──────────┴───────────────┐
                       │   │   product_plans            │
                       │   ├──────────────────────────┤
                       │   │ id (PK, uuid)             │
                       │   │ product_id (FK→products)  │
                       │   │ duration_months (integer)  │
                       │   │ price (integer)            │
                       │   │ discount_rate (numeric)    │
                       │   │ is_active (boolean)        │
                       │   └──────────┬───────────────┘
                       │              │
                       │   ┌──────────┴───────────────┐
                       ├──▶│        orders              │
                       │   ├──────────────────────────┤
                       │   │ id (PK, uuid)             │
                       │   │ order_number (unique)     │
                       │   │ user_id (FK→profiles)     │
                       │   │ product_id (FK→products)  │
                       │   │ plan_id (FK→product_plans)│
                       │   │ amount (integer)           │
                       │   │ payment_status (enum)      │
                       │   │ assignment_status (enum)   │
                       │   │ portone_payment_id         │
                       │   │ paid_at (timestamptz)      │
                       │   │ assigned_at (timestamptz)  │
                       │   │ start_date (date)          │
                       │   │ end_date (date)            │
                       │   │ created_at                 │
                       │   └──────────┬───────────────┘
                       │              │
                       │   ┌──────────┴───────────────┐
                       │   │   order_accounts           │
                       │   ├──────────────────────────┤
                       │   │ id (PK, uuid)             │
                       │   │ order_id (FK→orders)      │
                       │   │ account_id (FK→accounts)  │
                       │   │ assigned_at               │
                       │   └──────────────────────────┘
                       │
                       │   ┌──────────────────────────┐
                       │   │      accounts              │
                       │   ├──────────────────────────┤
                       │   │ id (PK, uuid)             │
                       │   │ product_id (FK→products)  │
                       │   │ login_id (text, 암호화)    │
                       │   │ login_pw (text, 암호화)    │
                       │   │ status (enum)              │
                       │   │ max_slots (integer)        │
                       │   │ used_slots (integer)       │
                       │   │ memo (text)                │
                       │   │ created_at                 │
                       │   └──────────────────────────┘
                       │
                       │   ┌──────────────────────────┐
                       │   │       notices              │
                       │   ├──────────────────────────┤
                       │   │ id (PK, uuid)             │
                       │   │ title                     │
                       │   │ content (text)             │
                       │   │ category (enum)            │
                       │   │ is_published (boolean)     │
                       │   │ is_pinned (boolean)        │
                       │   │ created_at                 │
                       │   └──────────────────────────┘
                       │
                       │   ┌──────────────────────────┐
                       │   │         faqs               │
                       │   ├──────────────────────────┤
                       │   │ id (PK, uuid)             │
                       │   │ question                  │
                       │   │ answer (text)              │
                       │   │ category (enum)            │
                       │   │ sort_order (integer)       │
                       │   │ is_published (boolean)     │
                       │   │ created_at                 │
                       │   └──────────────────────────┘
                       │
                       │   ┌──────────────────────────┐
                       └──▶│   notification_logs        │
                           ├──────────────────────────┤
                           │ id (PK, uuid)             │
                           │ user_id (FK→profiles)     │
                           │ order_id (FK→orders)      │
                           │ type (enum)                │
                           │ channel (enum)             │
                           │ status (enum)              │
                           │ message (text)             │
                           │ sent_at                    │
                           └──────────────────────────┘
```

### 5.2 테이블 생성 SQL (마이그레이션)

```sql
-- supabase/migrations/001_create_tables.sql

-- ============================================
-- ENUM 타입 정의
-- ============================================
CREATE TYPE user_role AS ENUM ('user', 'admin');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'cancelled', 'refunded');
CREATE TYPE assignment_status AS ENUM ('waiting', 'assigned', 'expired', 'replaced');
CREATE TYPE account_status AS ENUM ('available', 'assigned', 'disabled');
CREATE TYPE notice_category AS ENUM ('service', 'update', 'event', 'maintenance');
CREATE TYPE faq_category AS ENUM ('general', 'payment', 'account', 'refund');
CREATE TYPE notification_type AS ENUM ('assignment', 'expiry_d7', 'expiry_d1', 'replacement', 'delay');
CREATE TYPE notification_channel AS ENUM ('sms', 'alimtalk');
CREATE TYPE notification_status AS ENUM ('pending', 'sent', 'failed');

-- ============================================
-- 1. profiles (사용자 프로필)
-- ============================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    role user_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- auth.users 생성 시 자동으로 profiles 생성하는 트리거
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- updated_at 자동 갱신 함수
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 2. products (구독 상품)
-- ============================================
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,               -- URL 경로용 (예: "tidal-hifi")
    name TEXT NOT NULL,                       -- 표시 이름 (예: "Tidal HiFi Plus")
    description TEXT,                         -- 상세 설명
    original_price INTEGER NOT NULL,          -- 원래 월 구독료 (원)
    benefits TEXT[] DEFAULT '{}',             -- 혜택 목록
    cautions TEXT[] DEFAULT '{}',             -- 유의사항 목록
    image_url TEXT,                           -- 서비스 로고/이미지
    tags TEXT[] DEFAULT '{}',                 -- 태그 (예: ["인기", "NEW"])
    is_active BOOLEAN NOT NULL DEFAULT true,  -- 활성/비활성
    sort_order INTEGER NOT NULL DEFAULT 0,    -- 정렬 순서
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 3. product_plans (상품별 요금제)
-- ============================================
CREATE TABLE product_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    duration_months INTEGER NOT NULL,         -- 이용 기간 (개월)
    price INTEGER NOT NULL,                   -- 판매가 (원)
    discount_rate NUMERIC(5,2) DEFAULT 0,     -- 할인율 (%)
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(product_id, duration_months)
);

-- ============================================
-- 4. accounts (공유 계정 풀)
-- ============================================
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id),
    login_id TEXT NOT NULL,                   -- 암호화 저장 (pgcrypto)
    login_pw TEXT NOT NULL,                   -- 암호화 저장
    status account_status NOT NULL DEFAULT 'available',
    max_slots INTEGER NOT NULL DEFAULT 5,     -- 최대 공유 가능 인원
    used_slots INTEGER NOT NULL DEFAULT 0,    -- 현재 배정된 인원
    memo TEXT,                                -- 관리자 메모
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT slots_check CHECK (used_slots <= max_slots)
);

-- ============================================
-- 5. orders (주문)
-- ============================================
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT NOT NULL UNIQUE,         -- 주문번호 (ORD-YYYYMMDD-XXXX)
    user_id UUID NOT NULL REFERENCES profiles(id),
    product_id UUID NOT NULL REFERENCES products(id),
    plan_id UUID NOT NULL REFERENCES product_plans(id),
    amount INTEGER NOT NULL,                   -- 결제 금액 (원)
    payment_status payment_status NOT NULL DEFAULT 'pending',
    assignment_status assignment_status NOT NULL DEFAULT 'waiting',
    portone_payment_id TEXT,                   -- PortOne 결제 고유 ID
    paid_at TIMESTAMPTZ,                       -- 결제 완료 시각
    assigned_at TIMESTAMPTZ,                   -- 배정 완료 시각
    start_date DATE,                           -- 이용 시작일
    end_date DATE,                             -- 이용 종료일
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 주문번호 자동 생성 함수
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
    seq_num INTEGER;
BEGIN
    SELECT COUNT(*) + 1 INTO seq_num
    FROM orders
    WHERE DATE(created_at) = CURRENT_DATE;

    NEW.order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(seq_num::TEXT, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_number_trigger
    BEFORE INSERT ON orders
    FOR EACH ROW
    WHEN (NEW.order_number IS NULL)
    EXECUTE FUNCTION generate_order_number();

-- ============================================
-- 6. order_accounts (주문-계정 매핑)
-- ============================================
CREATE TABLE order_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 7. notices (공지사항)
-- ============================================
CREATE TABLE notices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category notice_category NOT NULL DEFAULT 'service',
    is_published BOOLEAN NOT NULL DEFAULT false,
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 8. faqs (자주 묻는 질문)
-- ============================================
CREATE TABLE faqs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category faq_category NOT NULL DEFAULT 'general',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_published BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 9. notification_logs (알림 발송 로그)
-- ============================================
CREATE TABLE notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id),
    order_id UUID REFERENCES orders(id),
    type notification_type NOT NULL,
    channel notification_channel NOT NULL DEFAULT 'sms',
    status notification_status NOT NULL DEFAULT 'pending',
    message TEXT,
    sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 인덱스 생성
-- ============================================
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_assignment_status ON orders(assignment_status);
CREATE INDEX idx_orders_end_date ON orders(end_date);
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_is_active ON products(is_active);
CREATE INDEX idx_accounts_status ON accounts(status);
CREATE INDEX idx_accounts_product_id ON accounts(product_id);
CREATE INDEX idx_notices_is_published ON notices(is_published);
CREATE INDEX idx_faqs_is_published ON faqs(is_published);
```

### 5.3 RLS (Row Level Security) 정책

```sql
-- supabase/migrations/002_rls_policies.sql

-- 모든 테이블에 RLS 활성화
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- ── 헬퍼 함수 ──
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
$$ LANGUAGE sql SECURITY DEFINER;

-- ════════════════════════════════════════
-- profiles 정책
-- ════════════════════════════════════════
-- 본인 프로필만 조회
CREATE POLICY "profiles_select_own" ON profiles
    FOR SELECT USING (auth.uid() = id);

-- 본인 프로필만 수정
CREATE POLICY "profiles_update_own" ON profiles
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 관리자는 모든 프로필 조회
CREATE POLICY "profiles_select_admin" ON profiles
    FOR SELECT USING (is_admin());

-- ════════════════════════════════════════
-- products 정책 (공개 조회, 관리자만 수정)
-- ════════════════════════════════════════
CREATE POLICY "products_select_all" ON products
    FOR SELECT USING (true);  -- 누구나 조회 가능

CREATE POLICY "products_insert_admin" ON products
    FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "products_update_admin" ON products
    FOR UPDATE USING (is_admin());

-- ════════════════════════════════════════
-- product_plans 정책
-- ════════════════════════════════════════
CREATE POLICY "plans_select_all" ON product_plans
    FOR SELECT USING (true);

CREATE POLICY "plans_modify_admin" ON product_plans
    FOR ALL USING (is_admin());

-- ════════════════════════════════════════
-- orders 정책
-- ════════════════════════════════════════
-- 사용자: 본인 주문만 조회
CREATE POLICY "orders_select_own" ON orders
    FOR SELECT USING (auth.uid() = user_id);

-- 사용자: 본인 주문만 생성
CREATE POLICY "orders_insert_own" ON orders
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 관리자: 모든 주문 조회/수정
CREATE POLICY "orders_all_admin" ON orders
    FOR ALL USING (is_admin());

-- ════════════════════════════════════════
-- accounts 정책 (관리자 전용 직접 접근)
-- ════════════════════════════════════════
CREATE POLICY "accounts_admin_only" ON accounts
    FOR ALL USING (is_admin());

-- ════════════════════════════════════════
-- order_accounts 정책
-- ════════════════════════════════════════
-- 사용자: 본인 주문의 계정 정보만 조회
CREATE POLICY "order_accounts_select_own" ON order_accounts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = order_accounts.order_id
            AND orders.user_id = auth.uid()
        )
    );

-- 관리자: 모든 접근
CREATE POLICY "order_accounts_admin" ON order_accounts
    FOR ALL USING (is_admin());

-- ════════════════════════════════════════
-- notices / faqs 정책 (공개 조회)
-- ════════════════════════════════════════
CREATE POLICY "notices_select_published" ON notices
    FOR SELECT USING (is_published = true);

CREATE POLICY "notices_modify_admin" ON notices
    FOR ALL USING (is_admin());

CREATE POLICY "faqs_select_published" ON faqs
    FOR SELECT USING (is_published = true);

CREATE POLICY "faqs_modify_admin" ON faqs
    FOR ALL USING (is_admin());

-- ════════════════════════════════════════
-- notification_logs 정책
-- ════════════════════════════════════════
CREATE POLICY "notif_select_own" ON notification_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notif_all_admin" ON notification_logs
    FOR ALL USING (is_admin());
```

### 5.4 사용자 계정정보 조회 함수 (보안 함수)

```sql
-- supabase/migrations/003_functions.sql

-- 사용자가 자신의 배정된 계정 정보를 안전하게 조회하는 함수
-- (accounts 테이블에 직접 접근 차단, 이 함수를 통해서만 ID/PW 조회 가능)
CREATE OR REPLACE FUNCTION get_my_account_info(p_order_id UUID)
RETURNS TABLE (
    login_id TEXT,
    login_pw TEXT,
    start_date DATE,
    end_date DATE,
    product_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.login_id,
        a.login_pw,
        o.start_date,
        o.end_date,
        p.name AS product_name
    FROM order_accounts oa
    JOIN accounts a ON a.id = oa.account_id
    JOIN orders o ON o.id = oa.order_id
    JOIN products p ON p.id = o.product_id
    WHERE oa.order_id = p_order_id
    AND o.user_id = auth.uid()               -- 본인 주문만 조회 가능
    AND o.assignment_status = 'assigned';     -- 배정 완료된 건만
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 관리자: 배정 처리 함수 (트랜잭션으로 원자성 보장)
CREATE OR REPLACE FUNCTION assign_account(
    p_order_id UUID,
    p_account_id UUID
) RETURNS VOID AS $$
DECLARE
    v_plan_duration INTEGER;
BEGIN
    -- 관리자 권한 체크
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- 주문의 기간 정보 가져오기
    SELECT pp.duration_months INTO v_plan_duration
    FROM orders o
    JOIN product_plans pp ON pp.id = o.plan_id
    WHERE o.id = p_order_id;

    -- 주문 상태 업데이트
    UPDATE orders SET
        assignment_status = 'assigned',
        assigned_at = NOW(),
        start_date = CURRENT_DATE,
        end_date = CURRENT_DATE + (v_plan_duration || ' months')::INTERVAL
    WHERE id = p_order_id
    AND payment_status = 'paid'
    AND assignment_status = 'waiting';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not eligible for assignment';
    END IF;

    -- 계정 매핑 생성
    INSERT INTO order_accounts (order_id, account_id)
    VALUES (p_order_id, p_account_id);

    -- 계정 슬롯 업데이트
    UPDATE accounts SET
        used_slots = used_slots + 1,
        status = CASE
            WHEN used_slots + 1 >= max_slots THEN 'assigned'::account_status
            ELSE status
        END
    WHERE id = p_account_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 만료 예정 주문 조회 (Cron Job용)
CREATE OR REPLACE FUNCTION get_expiring_orders(days_before INTEGER)
RETURNS TABLE (
    order_id UUID,
    user_id UUID,
    user_phone TEXT,
    product_name TEXT,
    end_date DATE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        o.id AS order_id,
        o.user_id,
        p2.phone AS user_phone,
        p.name AS product_name,
        o.end_date
    FROM orders o
    JOIN products p ON p.id = o.product_id
    JOIN profiles p2 ON p2.id = o.user_id
    WHERE o.end_date = CURRENT_DATE + days_before
    AND o.assignment_status = 'assigned';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 5.5 초기 시드 데이터

```sql
-- supabase/migrations/004_seed_data.sql

-- 상품 데이터
INSERT INTO products (slug, name, description, original_price, benefits, cautions, tags, sort_order)
VALUES
    ('tidal-hifi-plus', 'Tidal HiFi Plus',
     '최고 음질의 로스리스(Lossless) 음악 스트리밍 서비스',
     14900,
     ARRAY['HiFi Plus 최고 음질', '오프라인 다운로드', '가사 보기', 'Dolby Atmos'],
     ARRAY['동시 접속 1대 제한', '비밀번호 변경 금지', '프로필 변경 금지'],
     ARRAY['인기', 'HiFi'],
     1),
    ('netflix-standard', 'Netflix Standard',
     '광고 없는 Full HD 스트리밍',
     17000,
     ARRAY['Full HD 화질', '광고 없음', '2대 동시 시청', '모바일 다운로드'],
     ARRAY['프로필 지정 사용', '비밀번호 변경 금지'],
     ARRAY['NEW'],
     2);

-- 요금제 데이터
INSERT INTO product_plans (product_id, duration_months, price, discount_rate)
SELECT id, 1, 5900, 60.40 FROM products WHERE slug = 'tidal-hifi-plus'
UNION ALL
SELECT id, 3, 15900, 64.43 FROM products WHERE slug = 'tidal-hifi-plus'
UNION ALL
SELECT id, 1, 7900, 53.53 FROM products WHERE slug = 'netflix-standard'
UNION ALL
SELECT id, 3, 21900, 57.06 FROM products WHERE slug = 'netflix-standard';

-- 관리자 계정 (직접 Supabase Auth에서 생성 후 role 업데이트)
-- UPDATE profiles SET role = 'admin' WHERE email = 'admin@dalbus.kr';
```

---

## 6. 인증(Authentication) 구현

### 6.1 Supabase 클라이언트 설정

```typescript
// src/lib/supabase/client.ts
// 브라우저(클라이언트 컴포넌트)에서 사용
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

export function createClient() {
    return createBrowserClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
}
```

```typescript
// src/lib/supabase/server.ts
// 서버 컴포넌트, Server Action에서 사용
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';

export async function createClient() {
    const cookieStore = await cookies();

    return createServerClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    } catch {
                        // Server Component에서 호출 시 무시
                    }
                },
            },
        }
    );
}
```

```typescript
// src/lib/supabase/admin.ts
// API Route에서 Service Role로 사용 (RLS 바이패스)
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export const supabaseAdmin = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

### 6.2 미들웨어 (세션 갱신)

```typescript
// middleware.ts (프로젝트 루트)
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    supabaseResponse = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // 세션 갱신 (중요: 이 코드 제거 시 사용자 세션이 만료됨)
    const { data: { user } } = await supabase.auth.getUser();

    // 보호된 경로 접근 시 로그인 필요
    const protectedPaths = ['/mypage', '/payment'];
    const isProtected = protectedPaths.some(path =>
        request.nextUrl.pathname.startsWith(path)
    );

    if (isProtected && !user) {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        url.searchParams.set('redirect', request.nextUrl.pathname);
        return NextResponse.redirect(url);
    }

    // 관리자 경로 보호
    if (request.nextUrl.pathname.startsWith('/admin')) {
        if (!user) {
            return NextResponse.redirect(new URL('/login', request.url));
        }

        // 관리자 권한 체크는 layout에서 수행 (미들웨어에서 DB 조회 최소화)
    }

    return supabaseResponse;
}

export const config = {
    matcher: [
        // 정적 파일과 API 제외
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
```

### 6.3 로그인 페이지 구현

```typescript
// src/app/(auth)/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

const loginSchema = z.object({
    email: z.string().email('올바른 이메일 형식을 입력하세요'),
    password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirect = searchParams.get('redirect') || '/mypage';
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
        resolver: zodResolver(loginSchema),
    });

    async function onSubmit(data: LoginForm) {
        setLoading(true);
        setError('');

        const supabase = createClient();
        const { error } = await supabase.auth.signInWithPassword({
            email: data.email,
            password: data.password,
        });

        if (error) {
            setError('이메일 또는 비밀번호가 올바르지 않습니다');
            setLoading(false);
            return;
        }

        router.push(redirect);
        router.refresh();
    }

    async function handleGoogleLogin() {
        const supabase = createClient();
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/api/auth/callback?redirect=${redirect}`,
            },
        });
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            <div className="w-full max-w-sm space-y-6">
                <div className="text-center">
                    <h1 className="text-2xl font-bold">달버스 로그인</h1>
                    <p className="text-muted-foreground mt-2">
                        프리미엄 구독을 더 합리적으로
                    </p>
                </div>

                {/* Google OAuth */}
                <Button
                    variant="outline"
                    className="w-full h-12"
                    onClick={handleGoogleLogin}
                >
                    <img src="/images/google-icon.svg" alt="" className="w-5 h-5 mr-2" />
                    Google로 계속하기
                </Button>

                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">또는</span>
                    </div>
                </div>

                {/* 이메일 로그인 폼 */}
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="email">이메일</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="hello@example.com"
                            className="h-12"
                            {...register('email')}
                        />
                        {errors.email && (
                            <p className="text-sm text-destructive">{errors.email.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <Label htmlFor="password">비밀번호</Label>
                            <Link href="/reset-password" className="text-sm text-primary">
                                비밀번호를 잊으셨나요?
                            </Link>
                        </div>
                        <Input
                            id="password"
                            type="password"
                            placeholder="8자 이상"
                            className="h-12"
                            {...register('password')}
                        />
                        {errors.password && (
                            <p className="text-sm text-destructive">{errors.password.message}</p>
                        )}
                    </div>

                    {error && (
                        <p className="text-sm text-destructive text-center">{error}</p>
                    )}

                    <Button type="submit" className="w-full h-12" disabled={loading}>
                        {loading ? '로그인 중...' : '로그인'}
                    </Button>
                </form>

                <p className="text-center text-sm text-muted-foreground">
                    아직 계정이 없으신가요?{' '}
                    <Link href="/signup" className="text-primary font-medium">
                        회원가입
                    </Link>
                </p>
            </div>
        </div>
    );
}
```

---

## 7. 주요 페이지별 구현 상세

### 7.1 랜딩 페이지 (SSG - 검색엔진 최적화)

```typescript
// src/app/(public)/page.tsx
import { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import HeroSection from '@/components/landing/HeroSection';
import PriceComparison from '@/components/landing/PriceComparison';
import StepGuide from '@/components/landing/StepGuide';
import ReviewCarousel from '@/components/landing/ReviewCarousel';

// ✅ SEO 메타데이터 (검색 노출 핵심)
export const metadata: Metadata = {
    title: '달버스 | 프리미엄 구독 서비스를 최대 60% 할인',
    description: 'Tidal, Netflix 등 프리미엄 구독을 최대 60% 할인된 가격으로 이용하세요. 3단계 간편 신청, 2시간 내 계정 배정.',
    keywords: ['구독 공유', 'Tidal 할인', 'Netflix 할인', '프리미엄 구독', '달버스'],
    openGraph: {
        title: '달버스 | 프리미엄 구독 최대 60% 할인',
        description: 'Tidal, Netflix 등 프리미엄 구독을 합리적으로 이용하세요.',
        url: 'https://dalbus.kr',
        siteName: '달버스',
        images: [{ url: '/og-image.png', width: 1200, height: 630 }],
        locale: 'ko_KR',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: '달버스 | 프리미엄 구독 최대 60% 할인',
        description: 'Tidal, Netflix 등을 합리적으로 이용하세요.',
        images: ['/og-image.png'],
    },
    alternates: {
        canonical: 'https://dalbus.kr',
    },
};

// ✅ JSON-LD 구조화 데이터 (Google 검색 결과 강화)
function JsonLd() {
    const structuredData = {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: '달버스',
        url: 'https://dalbus.kr',
        description: '프리미엄 구독 서비스를 최대 60% 할인된 가격으로 이용하세요',
        potentialAction: {
            '@type': 'SearchAction',
            target: 'https://dalbus.kr/products?q={search_term_string}',
            'query-input': 'required name=search_term_string',
        },
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
    );
}

export default async function LandingPage() {
    const supabase = await createClient();

    // 활성 상품 목록 조회 (서버에서 미리 가져옴)
    const { data: products } = await supabase
        .from('products')
        .select('*, product_plans(*)')
        .eq('is_active', true)
        .order('sort_order');

    // 최신 공지 3건
    const { data: notices } = await supabase
        .from('notices')
        .select('id, title, created_at')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(3);

    return (
        <>
            <JsonLd />
            <main>
                <HeroSection />
                <PriceComparison products={products || []} />
                <StepGuide />
                <ReviewCarousel />

                {/* 공지사항 프리뷰 */}
                <section className="py-12 px-4">
                    <h2 className="text-xl font-bold mb-4">공지사항</h2>
                    {notices?.map(notice => (
                        <a key={notice.id} href={`/notices/${notice.id}`}
                           className="block py-3 border-b">
                            <span className="text-sm">{notice.title}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                                {new Date(notice.created_at).toLocaleDateString('ko-KR')}
                            </span>
                        </a>
                    ))}
                </section>
            </main>
        </>
    );
}

// ✅ ISR: 60초마다 페이지 재생성 (상품/공지 업데이트 반영)
export const revalidate = 60;
```

### 7.2 상품 상세 페이지 (동적 SEO)

```typescript
// src/app/(public)/products/[slug]/page.tsx
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ProductDetail from '@/components/product/ProductDetail';
import PeriodSelector from '@/components/product/PeriodSelector';

interface Props {
    params: Promise<{ slug: string }>;
}

// ✅ 동적 SEO 메타데이터
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const supabase = await createClient();
    const { data: product } = await supabase
        .from('products')
        .select('name, description, original_price')
        .eq('slug', slug)
        .single();

    if (!product) return {};

    return {
        title: `${product.name} | 달버스 - 최대 60% 할인`,
        description: `${product.name}을 월 ${product.original_price.toLocaleString()}원 대신 훨씬 저렴하게! ${product.description}`,
        openGraph: {
            title: `${product.name} 할인 구독 | 달버스`,
            description: product.description || '',
        },
    };
}

// ✅ 빌드 시 정적 생성할 경로
export async function generateStaticParams() {
    const supabase = await createClient();
    const { data: products } = await supabase
        .from('products')
        .select('slug')
        .eq('is_active', true);

    return (products || []).map(p => ({ slug: p.slug }));
}

export default async function ProductPage({ params }: Props) {
    const { slug } = await params;
    const supabase = await createClient();

    const { data: product } = await supabase
        .from('products')
        .select('*, product_plans(*)')
        .eq('slug', slug)
        .eq('is_active', true)
        .single();

    if (!product) notFound();

    // 구조화 데이터 (Product)
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        description: product.description,
        offers: product.product_plans?.map((plan: any) => ({
            '@type': 'Offer',
            price: plan.price,
            priceCurrency: 'KRW',
            availability: 'https://schema.org/InStock',
        })),
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <main className="max-w-lg mx-auto px-4 py-6">
                <ProductDetail product={product} />
                <PeriodSelector
                    plans={product.product_plans || []}
                    productId={product.id}
                />
            </main>
        </>
    );
}

export const revalidate = 60;
```

### 7.3 마이페이지 - 구독 현황 (계정 정보 표시)

```typescript
// src/app/(protected)/mypage/page.tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import SubscriptionCard from '@/components/mypage/SubscriptionCard';
import { Badge } from '@/components/ui/badge';

export const metadata = {
    title: '마이페이지 | 달버스',
    robots: { index: false }, // 마이페이지는 검색 제외
};

export default async function MyPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    // 현재 이용 중인 주문 (배정 완료)
    const { data: activeOrders } = await supabase
        .from('orders')
        .select(`
            *,
            products (name, image_url),
            product_plans (duration_months)
        `)
        .eq('user_id', user.id)
        .eq('assignment_status', 'assigned')
        .order('created_at', { ascending: false });

    // 배정 대기 중인 주문
    const { data: waitingOrders } = await supabase
        .from('orders')
        .select(`
            *,
            products (name, image_url)
        `)
        .eq('user_id', user.id)
        .eq('payment_status', 'paid')
        .eq('assignment_status', 'waiting');

    // 만료된 주문
    const { data: expiredOrders } = await supabase
        .from('orders')
        .select(`
            *,
            products (name, slug, image_url)
        `)
        .eq('user_id', user.id)
        .eq('assignment_status', 'expired')
        .order('end_date', { ascending: false })
        .limit(5);

    return (
        <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
            <h1 className="text-xl font-bold">마이페이지</h1>

            {/* 이용 중인 서비스 */}
            <section>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    이용 중인 서비스
                    <Badge variant="default">{activeOrders?.length || 0}</Badge>
                </h2>
                {activeOrders?.map(order => (
                    <SubscriptionCard key={order.id} order={order} status="active" />
                ))}
                {(!activeOrders || activeOrders.length === 0) && (
                    <p className="text-muted-foreground text-sm py-8 text-center">
                        이용 중인 서비스가 없습니다
                    </p>
                )}
            </section>

            {/* 배정 대기 */}
            {waitingOrders && waitingOrders.length > 0 && (
                <section>
                    <h2 className="text-lg font-semibold mb-3">배정 대기 중</h2>
                    {waitingOrders.map(order => (
                        <SubscriptionCard key={order.id} order={order} status="waiting" />
                    ))}
                </section>
            )}

            {/* 만료 서비스 (재구매 유도) */}
            {expiredOrders && expiredOrders.length > 0 && (
                <section>
                    <h2 className="text-lg font-semibold mb-3">만료된 서비스</h2>
                    {expiredOrders.map(order => (
                        <SubscriptionCard key={order.id} order={order} status="expired" />
                    ))}
                </section>
            )}
        </main>
    );
}
```

---

## 8. 결제 연동 (PortOne V2)

### 8.1 결제 플로우

```
[사용자]                     [Next.js]                    [PortOne]              [Supabase]
   │                           │                            │                      │
   │── 기간 선택 + 결제 클릭 ──▶│                            │                      │
   │                           │── 주문 임시 생성 ──────────▶│                ──────▶│ orders INSERT
   │                           │                            │                      │ (pending)
   │                           │◀── order_id 반환 ──────────│                      │
   │                           │                            │                      │
   │◀── PortOne SDK 결제창 ────│── requestPayment() ───────▶│                      │
   │── 카드 정보 입력 ─────────▶│                            │                      │
   │                           │                            │── PG사 승인 요청 ────▶│
   │                           │                            │◀── 승인 완료 ────────│
   │                           │                            │                      │
   │                           │◀── paymentId 반환 ─────────│                      │
   │                           │── /api/payment/verify ─────▶│                      │
   │                           │                            │── 결제 검증 API ─────▶│
   │                           │                            │◀── 검증 결과 ────────│
   │                           │── UPDATE orders ──────────▶│                ──────▶│ (paid)
   │◀── 결제 완료 페이지 ──────│                            │                      │
```

### 8.2 클라이언트 결제 요청

```typescript
// src/lib/portone.ts
import * as PortOne from '@portone/browser-sdk/v2';

interface PaymentRequest {
    orderId: string;
    orderName: string;
    amount: number;
    customerEmail: string;
    customerName: string;
    customerPhone?: string;
}

export async function requestPayment(params: PaymentRequest) {
    const response = await PortOne.requestPayment({
        storeId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID!,
        channelKey: process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY!,
        paymentId: `payment-${params.orderId}-${Date.now()}`,
        orderName: params.orderName,
        totalAmount: params.amount,
        currency: 'CURRENCY_KRW',
        payMethod: 'CARD',
        customer: {
            email: params.customerEmail,
            fullName: params.customerName,
            phoneNumber: params.customerPhone,
        },
        redirectUrl: `${window.location.origin}/payment/success`,
    });

    return response;
}
```

### 8.3 결제 검증 API

```typescript
// src/app/api/payment/verify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
    try {
        const { paymentId, orderId } = await request.json();

        // 1. PortOne 서버에서 결제 정보 조회
        const portoneResponse = await fetch(
            `https://api.portone.io/payments/${encodeURIComponent(paymentId)}`,
            {
                headers: {
                    Authorization: `PortOne ${process.env.PORTONE_API_SECRET}`,
                },
            }
        );

        if (!portoneResponse.ok) {
            return NextResponse.json(
                { error: '결제 정보를 확인할 수 없습니다' },
                { status: 400 }
            );
        }

        const payment = await portoneResponse.json();

        // 2. DB의 주문 정보와 대조
        const { data: order } = await supabaseAdmin
            .from('orders')
            .select('amount')
            .eq('id', orderId)
            .single();

        if (!order) {
            return NextResponse.json({ error: '주문을 찾을 수 없습니다' }, { status: 404 });
        }

        // 3. 금액 일치 여부 검증
        if (payment.amount.total !== order.amount) {
            // 금액 위변조 감지 → 결제 취소
            await fetch(
                `https://api.portone.io/payments/${encodeURIComponent(paymentId)}/cancel`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `PortOne ${process.env.PORTONE_API_SECRET}`,
                    },
                    body: JSON.stringify({ reason: '결제 금액 불일치' }),
                }
            );
            return NextResponse.json({ error: '결제 금액이 일치하지 않습니다' }, { status: 400 });
        }

        // 4. 결제 상태 확인
        if (payment.status === 'PAID') {
            await supabaseAdmin
                .from('orders')
                .update({
                    payment_status: 'paid',
                    portone_payment_id: paymentId,
                    paid_at: new Date().toISOString(),
                })
                .eq('id', orderId);

            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: '결제가 완료되지 않았습니다' }, { status: 400 });
    } catch (error) {
        console.error('Payment verification error:', error);
        return NextResponse.json({ error: '서버 오류' }, { status: 500 });
    }
}
```

---

## 9. 알림 시스템 (SMS/알림톡)

### 9.1 솔라피 API 유틸

```typescript
// src/lib/solapi.ts
import crypto from 'crypto';

const API_KEY = process.env.SOLAPI_API_KEY!;
const API_SECRET = process.env.SOLAPI_API_SECRET!;
const SENDER = process.env.SOLAPI_SENDER_PHONE!;

function getAuthHeaders() {
    const date = new Date().toISOString();
    const salt = crypto.randomBytes(32).toString('hex');
    const signature = crypto
        .createHmac('sha256', API_SECRET)
        .update(date + salt)
        .digest('hex');

    return {
        'Content-Type': 'application/json',
        Authorization: `HMAC-SHA256 apiKey=${API_KEY}, date=${date}, salt=${salt}, signature=${signature}`,
    };
}

interface SendMessageParams {
    to: string;
    text: string;
    subject?: string;  // LMS인 경우
}

export async function sendSMS({ to, text, subject }: SendMessageParams) {
    const isLMS = text.length > 90;

    const response = await fetch('https://api.solapi.com/messages/v4/send-many', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
            messages: [{
                to,
                from: SENDER,
                text,
                ...(isLMS && { subject }),
                type: isLMS ? 'LMS' : 'SMS',
            }],
        }),
    });

    return response.json();
}

// 미리 정의된 알림 메시지 템플릿
export const NOTIFICATION_TEMPLATES = {
    assignment: (productName: string) =>
        `[달버스] ${productName} 계정 배정이 완료되었습니다! 마이페이지에서 확인하세요.\nhttps://dalbus.kr/mypage`,

    expiry_d7: (productName: string) =>
        `[달버스] ${productName} 구독 만료 7일 전입니다! 재구매 시 끊김 없이 이용하세요.\nhttps://dalbus.kr/mypage`,

    expiry_d1: (productName: string) =>
        `[달버스] 내일 ${productName} 구독이 만료됩니다. 지금 재구매하세요!\nhttps://dalbus.kr/mypage`,

    replacement: (productName: string) =>
        `[달버스] ${productName} 계정이 교체되었습니다. 마이페이지에서 새 계정을 확인하세요.\nhttps://dalbus.kr/mypage`,

    delay: () =>
        `[달버스] 계정 배정이 지연되고 있습니다. 빠르게 처리 중이니 잠시만 기다려주세요. 문의: 달버스 채널톡`,
};
```

### 9.2 만료 알림 Cron API (Vercel Cron)

```typescript
// src/app/api/cron/expiry-check/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendSMS, NOTIFICATION_TEMPLATES } from '@/lib/solapi';

// Vercel Cron: 매일 오전 9시 KST 실행
// vercel.json에 설정 필요
export async function GET(request: NextRequest) {
    // Cron 시크릿 검증
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results = { d7: 0, d1: 0, expired: 0 };

    // D-7 알림
    const { data: d7Orders } = await supabaseAdmin.rpc('get_expiring_orders', {
        days_before: 7
    });
    for (const order of d7Orders || []) {
        if (order.user_phone) {
            await sendSMS({
                to: order.user_phone,
                text: NOTIFICATION_TEMPLATES.expiry_d7(order.product_name),
            });
            results.d7++;
        }
    }

    // D-1 알림
    const { data: d1Orders } = await supabaseAdmin.rpc('get_expiring_orders', {
        days_before: 1
    });
    for (const order of d1Orders || []) {
        if (order.user_phone) {
            await sendSMS({
                to: order.user_phone,
                text: NOTIFICATION_TEMPLATES.expiry_d1(order.product_name),
            });
            results.d1++;
        }
    }

    // D-Day 만료 처리
    const { data: expiredOrders } = await supabaseAdmin
        .from('orders')
        .update({ assignment_status: 'expired' })
        .eq('assignment_status', 'assigned')
        .lte('end_date', new Date().toISOString().split('T')[0])
        .select('id');

    results.expired = expiredOrders?.length || 0;

    return NextResponse.json({ success: true, results });
}
```

```json
// vercel.json
{
    "crons": [
        {
            "path": "/api/cron/expiry-check",
            "schedule": "0 0 * * *"
        }
    ]
}
```

> **참고**: Vercel Hobby(무료) 플랜에서는 Cron Job이 1일 1회로 제한됩니다. 이것으로 D-7, D-1 알림 + 만료 처리를 한 번에 실행합니다.

---

## 10. 관리자(Admin) 시스템

### 10.1 관리자 레이아웃 (권한 검증)

```typescript
// src/app/admin/layout.tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect('/login');

    // 관리자 권한 확인
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profile?.role !== 'admin') {
        redirect('/'); // 일반 사용자는 메인으로 리다이렉트
    }

    return (
        <div className="flex min-h-screen">
            {/* 사이드바 (데스크탑) */}
            <aside className="hidden md:flex w-64 flex-col border-r bg-gray-50 p-4">
                <h2 className="text-lg font-bold mb-6">달버스 관리자</h2>
                <nav className="space-y-2">
                    <a href="/admin" className="block px-3 py-2 rounded hover:bg-gray-200">주문 관리</a>
                    <a href="/admin/products" className="block px-3 py-2 rounded hover:bg-gray-200">상품 관리</a>
                    <a href="/admin/accounts" className="block px-3 py-2 rounded hover:bg-gray-200">계정풀 관리</a>
                    <a href="/admin/content" className="block px-3 py-2 rounded hover:bg-gray-200">공지/FAQ</a>
                    <a href="/admin/stats" className="block px-3 py-2 rounded hover:bg-gray-200">매출 통계</a>
                </nav>
            </aside>

            {/* 메인 콘텐츠 */}
            <main className="flex-1 p-4 md:p-8 overflow-auto">
                {children}
            </main>
        </div>
    );
}
```

### 10.2 계정 배정 Server Action

```typescript
// src/app/admin/assign/[orderId]/actions.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendSMS, NOTIFICATION_TEMPLATES } from '@/lib/solapi';
import { revalidatePath } from 'next/cache';

export async function assignAccount(orderId: string, accountId: string) {
    // 관리자 권한 재확인
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profile?.role !== 'admin') throw new Error('Forbidden');

    // DB 함수 호출 (트랜잭션 처리)
    const { error } = await supabaseAdmin.rpc('assign_account', {
        p_order_id: orderId,
        p_account_id: accountId,
    });

    if (error) throw new Error(error.message);

    // 사용자에게 SMS 발송
    const { data: order } = await supabaseAdmin
        .from('orders')
        .select('user_id, products(name)')
        .eq('id', orderId)
        .single();

    if (order) {
        const { data: userProfile } = await supabaseAdmin
            .from('profiles')
            .select('phone')
            .eq('id', order.user_id)
            .single();

        if (userProfile?.phone) {
            const productName = (order.products as any)?.name || '서비스';
            await sendSMS({
                to: userProfile.phone,
                text: NOTIFICATION_TEMPLATES.assignment(productName),
            });
        }
    }

    revalidatePath('/admin');
    return { success: true };
}
```

---

## 11. 모바일 최적화 전략

### 11.1 반응형 레이아웃 원칙

```
모바일 (< 640px)     태블릿 (640-1024px)    데스크탑 (> 1024px)
┌─────────────┐      ┌──────────────────┐   ┌────────────────────────┐
│ [≡] 달버스   │      │ [≡] 달버스  [메뉴]│   │ 달버스  상품  FAQ  로그인│
├─────────────┤      ├──────────────────┤   ├────────────────────────┤
│             │      │                  │   │        │               │
│  1-column   │      │   2-column grid  │   │ sidebar│   3-column   │
│  full-width │      │                  │   │        │     grid     │
│             │      │                  │   │        │               │
├─────────────┤      ├──────────────────┤   ├────────────────────────┤
│ [홈][상품]   │      │      Footer      │   │        Footer          │
│ [MY][메뉴]   │      └──────────────────┘   └────────────────────────┘
└─────────────┘
 ↑ 바텀 네비
```

### 11.2 Tailwind 모바일 퍼스트 설정

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
    content: ['./src/**/*.{ts,tsx}'],
    theme: {
        extend: {
            // 모바일 퍼스트 breakpoints (Tailwind 기본값 사용)
            // sm: 640px, md: 768px, lg: 1024px, xl: 1280px

            // 최대 너비 (모바일 최적화)
            maxWidth: {
                'mobile': '430px',   // iPhone 15 Pro Max 기준
                'content': '640px',  // 컨텐츠 최대 너비
            },

            // 터치 타겟 최소 크기
            minHeight: {
                'touch': '44px',     // Apple HIG 기준 44pt
            },

            // Glassmorphism 디자인
            backdropBlur: {
                'glass': '16px',
            },

            // 안전 영역 (노치/홈바)
            padding: {
                'safe-top': 'env(safe-area-inset-top)',
                'safe-bottom': 'env(safe-area-inset-bottom)',
            },
        },
    },
    plugins: [require('tailwindcss-animate')],
};

export default config;
```

### 11.3 모바일 바텀 네비게이션

```typescript
// src/components/layout/MobileNav.tsx
'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, ShoppingBag, User, Menu } from 'lucide-react';

const navItems = [
    { href: '/', label: '홈', icon: Home },
    { href: '/products', label: '상품', icon: ShoppingBag },
    { href: '/mypage', label: 'MY', icon: User },
    { href: '/faq', label: '더보기', icon: Menu },
];

export default function MobileNav() {
    const pathname = usePathname();

    // 관리자 페이지에서는 숨김
    if (pathname.startsWith('/admin')) return null;

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden
                        bg-white/80 backdrop-blur-glass border-t
                        pb-safe-bottom">
            <div className="flex justify-around items-center h-16">
                {navItems.map(({ href, label, icon: Icon }) => {
                    const isActive = pathname === href ||
                        (href !== '/' && pathname.startsWith(href));

                    return (
                        <Link
                            key={href}
                            href={href}
                            className={`flex flex-col items-center justify-center
                                        min-w-[64px] min-h-touch
                                        transition-colors
                                        ${isActive
                                            ? 'text-primary'
                                            : 'text-muted-foreground'
                                        }`}
                        >
                            <Icon className="w-5 h-5" />
                            <span className="text-xs mt-1">{label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
```

### 11.4 모바일 성능 최적화 체크리스트

| 항목 | 목표 | 구현 방법 |
|------|------|----------|
| **LCP** | < 2.0초 | ISR/SSG, 이미지 최적화 (next/image), 폰트 프리로드 |
| **FID** | < 100ms | 클라이언트 JS 최소화, React Server Components |
| **CLS** | < 0.1 | 이미지 width/height 명시, 스켈레톤 UI |
| **번들 크기** | < 100KB (First Load) | 동적 import, 트리셰이킹 |
| **터치 타겟** | ≥ 44x44px | 모든 버튼/링크에 min-h-touch 적용 |
| **폰트** | Pretendard Variable | next/font/local로 최적 로딩 |
| **이미지** | WebP/AVIF | next/image 자동 최적화 |

```typescript
// src/app/layout.tsx - 폰트 최적화
import localFont from 'next/font/local';

const pretendard = localFont({
    src: [
        { path: '../fonts/PretendardVariable.woff2', style: 'normal' },
    ],
    variable: '--font-pretendard',
    display: 'swap',        // FOUT 방지
    preload: true,
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="ko" className={pretendard.variable}>
            <head>
                {/* 모바일 최적화 메타 태그 */}
                <meta name="viewport"
                      content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
                <meta name="theme-color" content="#ffffff" />
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-status-bar-style" content="default" />
            </head>
            <body className="font-sans antialiased pb-16 md:pb-0">
                {children}
                <MobileNav />
                <ChannelTalk />
            </body>
        </html>
    );
}
```

---

## 12. SEO 및 검색엔진 최적화

### 12.1 SEO 전략 요약

| 전략 | 구현 | 효과 |
|------|------|------|
| **SSG/ISR** | 랜딩, 상품 목록/상세, 공지, FAQ | Google 크롤러가 완전한 HTML 수집 |
| **동적 메타태그** | 각 페이지별 title, description, OG | 검색 결과 + 소셜 공유 최적화 |
| **구조화 데이터** | JSON-LD (WebSite, Product, FAQ) | 리치 스니펫 노출 가능성 ↑ |
| **사이트맵** | 자동 생성 (next-sitemap or App Router) | 검색엔진에 전체 URL 제출 |
| **robots.txt** | 크롤링 허용/차단 설정 | admin, mypage 등 비공개 영역 차단 |
| **canonical URL** | 중복 URL 방지 | SEO 점수 분산 방지 |
| **시맨틱 HTML** | header, main, nav, section, article | 접근성 + SEO 동시 충족 |

### 12.2 사이트맵 자동 생성

```typescript
// src/app/sitemap.ts
import { MetadataRoute } from 'next';
import { createClient } from '@/lib/supabase/server';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const supabase = await createClient();
    const baseUrl = 'https://dalbus.kr';

    // 정적 페이지
    const staticPages: MetadataRoute.Sitemap = [
        { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
        { url: `${baseUrl}/products`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
        { url: `${baseUrl}/faq`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
        { url: `${baseUrl}/notices`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.5 },
    ];

    // 동적 페이지: 상품 상세
    const { data: products } = await supabase
        .from('products')
        .select('slug, created_at')
        .eq('is_active', true);

    const productPages: MetadataRoute.Sitemap = (products || []).map(p => ({
        url: `${baseUrl}/products/${p.slug}`,
        lastModified: new Date(p.created_at),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
    }));

    // 동적 페이지: 공지사항
    const { data: notices } = await supabase
        .from('notices')
        .select('id, created_at')
        .eq('is_published', true);

    const noticePages: MetadataRoute.Sitemap = (notices || []).map(n => ({
        url: `${baseUrl}/notices/${n.id}`,
        lastModified: new Date(n.created_at),
        changeFrequency: 'monthly' as const,
        priority: 0.4,
    }));

    return [...staticPages, ...productPages, ...noticePages];
}
```

### 12.3 robots.txt

```typescript
// src/app/robots.ts
import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: ['/admin/', '/mypage/', '/payment/', '/api/'],
            },
        ],
        sitemap: 'https://dalbus.kr/sitemap.xml',
    };
}
```

### 12.4 FAQ 구조화 데이터 (리치 스니펫)

```typescript
// src/app/(public)/faq/page.tsx
export default async function FAQPage() {
    const supabase = await createClient();
    const { data: faqs } = await supabase
        .from('faqs')
        .select('*')
        .eq('is_published', true)
        .order('sort_order');

    // FAQ 구조화 데이터 → Google 검색에서 FAQ 리치 스니펫 노출
    const faqJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs?.map(faq => ({
            '@type': 'Question',
            name: faq.question,
            acceptedAnswer: {
                '@type': 'Answer',
                text: faq.answer,
            },
        })),
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
            />
            {/* FAQ 아코디언 UI */}
        </>
    );
}
```

### 12.5 Google Search Console 등록 절차

```
1. https://search.google.com/search-console 접속
2. "도메인" 방식으로 dalbus.kr 등록
3. DNS TXT 레코드 인증 (도메인 등록 업체에서 설정)
4. 사이트맵 제출: https://dalbus.kr/sitemap.xml
5. 색인 생성 요청: URL 검사 → "색인 생성 요청"

추가 권장:
- Naver Search Advisor: https://searchadvisor.naver.com
  → 네이버 검색 노출용 (한국 사용자 필수)
- Daum 검색등록: https://register.search.daum.net
```

---

## 13. 보안 체크리스트

| 카테고리 | 항목 | 구현 상태 | 비고 |
|---------|------|----------|------|
| **인증** | Supabase Auth JWT + HttpOnly Cookie | ✅ | @supabase/ssr 자동 처리 |
| **인증** | 비밀번호 해시 (bcrypt) | ✅ | Supabase Auth 기본 제공 |
| **인증** | 로그인 시도 횟수 제한 | ✅ | Supabase Auth rate limiting |
| **인가** | RLS 정책 전 테이블 적용 | ✅ | Section 5.3 참조 |
| **인가** | Admin 경로 서버사이드 권한 체크 | ✅ | middleware.ts + layout.tsx |
| **데이터** | 계정 ID/PW 함수 통해서만 조회 | ✅ | get_my_account_info() |
| **데이터** | Service Role Key 서버 전용 | ✅ | SUPABASE_SERVICE_ROLE_KEY |
| **결제** | 서버사이드 금액 검증 | ✅ | /api/payment/verify |
| **결제** | PortOne API Secret 서버 전용 | ✅ | PORTONE_API_SECRET |
| **통신** | HTTPS 강제 (Vercel 기본) | ✅ | 자동 SSL 인증서 |
| **환경** | 환경변수 .env.local (Git 제외) | ✅ | .gitignore 설정 |
| **XSS** | React 자동 이스케이프 | ✅ | dangerouslySetInnerHTML 최소화 |
| **CSRF** | SameSite Cookie 정책 | ✅ | Supabase 기본 설정 |
| **봇방지** | Cron API Bearer Token 검증 | ✅ | CRON_SECRET 환경변수 |

---

## 14. Vercel 배포 및 도메인 설정

### 14.1 배포 프로세스

```
1. GitHub 저장소 생성 및 코드 push
   $ git init
   $ git remote add origin https://github.com/username/dalbus-web.git
   $ git push -u origin main

2. Vercel 프로젝트 연결
   - https://vercel.com → "Import Project" → GitHub 저장소 선택
   - Framework: Next.js (자동 감지)
   - Root Directory: ./ (기본값)
   - Build Command: next build (기본값)
   - Environment Variables: .env.local 내용 전부 입력

3. 자동 배포 설정
   - main 브랜치 push → Production 자동 배포
   - PR 생성 → Preview 배포 (URL 자동 생성)
```

### 14.2 커스텀 도메인 연결

```
[Phase 1] 초기: Vercel 기본 도메인 사용
→ dalbus-web.vercel.app (무료, 즉시 사용 가능)

[Phase 2] 도메인 구매 후 매핑

1. 도메인 구매 (추천: 가비아, Namecheap)
   - dalbus.kr (₩15,000~25,000/년)
   - dalbus.co.kr (대안)

2. Vercel에 도메인 추가
   - Project Settings → Domains → "dalbus.kr" 입력
   - Vercel이 제공하는 DNS 레코드 확인:
     A    @      76.76.21.21
     CNAME www    cname.vercel-dns.com

3. 도메인 DNS 설정 (가비아 예시)
   - 가비아 관리자 → DNS 관리 → 레코드 추가
   - A 레코드: @ → 76.76.21.21
   - CNAME 레코드: www → cname.vercel-dns.com

4. SSL 자동 발급 (Vercel)
   - 도메인 연결 후 수분 내 Let's Encrypt SSL 자동 발급
   - https://dalbus.kr ← HTTPS 자동 적용

5. 환경변수 업데이트
   - NEXT_PUBLIC_SITE_URL=https://dalbus.kr
   - Supabase Auth → 리다이렉트 URL에 https://dalbus.kr 추가
```

### 14.3 Vercel 설정 파일

```typescript
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    // 이미지 최적화
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '*.supabase.co',
                pathname: '/storage/v1/object/public/**',
            },
        ],
        formats: ['image/avif', 'image/webp'],
    },

    // 보안 헤더
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    { key: 'X-Frame-Options', value: 'DENY' },
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
                ],
            },
        ];
    },

    // 리다이렉트
    async redirects() {
        return [
            {
                source: '/home',
                destination: '/',
                permanent: true,
            },
        ];
    },
};

export default nextConfig;
```

---

## 15. CI/CD 파이프라인

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  개발자   │────▶│ GitHub  │────▶│  Vercel  │────▶│ 배포 완료 │
│ git push │     │  Push   │     │  Build   │     │  Live!  │
└─────────┘     └────┬────┘     └────┬────┘     └─────────┘
                     │               │
                     │  PR 생성 시    │  자동 실행
                     │               │
                     ▼               ▼
              ┌─────────────┐  ┌─────────────┐
              │ GitHub       │  │ Preview      │
              │ Actions      │  │ Deployment   │
              │ - lint       │  │ (고유 URL)    │
              │ - type check │  │              │
              │ - build test │  │              │
              └─────────────┘  └─────────────┘
```

```yaml
# .github/workflows/ci.yml
name: CI
on:
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run build
```

---

## 16. 모니터링 및 에러 추적

### 16.1 무료 모니터링 스택

| 서비스 | 용도 | 무료 티어 |
|--------|------|----------|
| **Vercel Analytics** | 방문자 분석, Web Vitals | 무료 (기본 포함) |
| **Google Analytics 4** | 상세 사용자 행동 분석 | 무료 (무제한) |
| **Sentry** | 에러 추적, 성능 모니터링 | 5K 이벤트/월 무료 |
| **Supabase Dashboard** | DB 사용량, 쿼리 성능 | 무료 (기본 포함) |
| **Google Search Console** | 검색 노출 현황 | 무료 |
| **Naver Search Advisor** | 네이버 검색 현황 | 무료 |

### 16.2 핵심 모니터링 지표

```
비즈니스 지표:
├── 일일 주문 건수 → Supabase 대시보드 쿼리
├── 결제 전환율 → GA4 퍼널 분석
├── 배정 평균 소요 시간 → paid_at → assigned_at 차이
└── SMS 발송 성공률 → notification_logs 테이블

기술 지표:
├── LCP (Largest Contentful Paint) → Vercel Analytics
├── API 응답 시간 → Sentry Performance
├── 에러율 → Sentry Issues
└── DB 연결 수 → Supabase Dashboard
```

---

## 17. 운영비 시뮬레이션

### 17.1 서비스별 무료 티어 한도

| 서비스 | 무료 티어 한도 | 초과 시 요금 | 예상 초과 시점 |
|--------|--------------|------------|--------------|
| **Vercel Hobby** | 100GB 대역폭, 150K 함수 호출, 6K 빌드분/월 | Pro $20/월 | 월 방문자 ~10만 이상 |
| **Supabase Free** | 500MB DB, 50K MAU, 1GB 스토리지, 5GB 대역폭 | Pro $25/월 | DB 500MB 초과 또는 MAU 50K |
| **PortOne** | 월 순 거래액 5천만원 미만 무료 | Growth 플랜 (별도 문의) | 월 매출 5천만원 이상 |
| **솔라피 SMS** | 건당 과금 (기본료 무료) | SMS 8.4원/건, 알림톡 10~13원/건 | 첫 발송부터 과금 |
| **도메인 (.kr)** | - | 연 15,000~25,000원 | 도메인 구매 시점 |
| **Sentry** | 5K 이벤트/월 | $26/월 (50K) | 에러 5K 이상 |
| **Google Analytics** | 무제한 | - | 없음 |
| **ChannelTalk** | 기본 무료 (제한적) | 유료 ₩36,000/월~ | 운영자 2명 이상 |

### 17.2 단계별 비용 시뮬레이션

#### **Phase 1: MVP 론칭 (월 사용자 0~100명)**

| 항목 | 월 비용 | 비고 |
|------|---------|------|
| Vercel Hobby | ₩0 | 무료 티어 충분 |
| Supabase Free | ₩0 | DB < 50MB, MAU < 100 |
| PortOne | ₩0 | 월 거래액 ≪ 5천만원 |
| 솔라피 SMS | ₩3,000~5,000 | ~50건/월 × ~80원(알림톡+SMS) |
| 도메인 | ₩0 | 초기에는 vercel.app 사용 |
| **월 합계** | **₩3,000~5,000** | **SMS 비용만 발생** |

#### **Phase 2: 초기 성장 (월 사용자 100~500명)**

| 항목 | 월 비용 | 비고 |
|------|---------|------|
| Vercel Hobby | ₩0 | 아직 무료 한도 내 |
| Supabase Free | ₩0 | DB ~100MB, MAU ~500 |
| PortOne | ₩0 | 월 거래 ~300만원 (무료 범위) |
| 솔라피 SMS | ₩15,000~25,000 | ~300건/월 |
| 도메인 (.kr) | ₩2,000 | ₩24,000/년 ÷ 12 |
| ChannelTalk | ₩0 | 무료 플랜 |
| **월 합계** | **₩17,000~27,000** | **아직 대부분 무료** |

#### **Phase 3: 본격 성장 (월 사용자 500~3,000명)**

| 항목 | 월 비용 | 비고 |
|------|---------|------|
| Vercel Hobby → **Pro** | **$20 (~₩27,000)** | 대역폭/함수 한도 초과 가능 |
| Supabase Free → **Pro** | **$25 (~₩34,000)** | DB 500MB 초과 or MAU 50K 접근 |
| PortOne | ₩0 | 아직 5천만원 미만 |
| 솔라피 | ₩60,000~100,000 | ~1,000건/월 |
| 도메인 | ₩2,000 | |
| ChannelTalk | ₩36,000 | 유료 전환 고려 |
| Sentry | ₩0 | 아직 무료 한도 |
| **월 합계** | **₩159,000~199,000** | **유료 전환 시점** |

#### **Phase 4: 안정 운영 (월 사용자 3,000~10,000명)**

| 항목 | 월 비용 | 비고 |
|------|---------|------|
| Vercel Pro | ₩27,000 + 초과분 | $20 + 대역폭 초과 시 추가 |
| Supabase Pro | ₩34,000 + 초과분 | $25 + 컴퓨트/스토리지 추가 |
| PortOne | ₩0~유료 | 거래액 5천만원 접근 시 문의 |
| 솔라피 | ₩200,000~400,000 | ~5,000건/월 |
| 도메인 | ₩2,000 | |
| ChannelTalk | ₩36,000 | |
| Sentry | ₩0~₩35,000 | 에러 증가 시 유료 |
| **월 합계** | **₩299,000~534,000** | |

### 17.3 비용 최적화 전략

```
[무료 유지 극대화 전략]

1. Vercel: 정적 페이지 최대화
   - 랜딩, 상품, FAQ, 공지 → SSG/ISR로 CDN 캐시
   - API Route 호출 최소화 (서버 컴포넌트에서 직접 Supabase 호출)

2. Supabase: DB 용량 절약
   - notification_logs → 90일 이상 된 레코드 자동 삭제 (Cron)
   - 이미지는 Supabase Storage 대신 CDN 직접 호스팅 고려
   - 불필요한 인덱스 최소화

3. SMS 비용 절감
   - 카카오 알림톡 우선 사용 (10~13원) > SMS (8.4원+LMS 25원)
   - 꼭 필요한 알림만 발송 (배정완료, D-7, D-1)
   - D-7 알림은 이메일로 대체 검토 (Supabase Auth 이메일 무료)

4. 유료 전환 시점 판단 기준
   ┌─────────────────────────────────────────────────┐
   │ Supabase: DB 400MB 도달 시 → Pro 전환 ($25)     │
   │ Vercel: 월 대역폭 80GB 도달 시 → Pro 전환 ($20) │
   │ 두 서비스 합산 월 ₩61,000이 첫 유료 전환 비용   │
   └─────────────────────────────────────────────────┘
```

### 17.4 손익분기 시뮬레이션

```
[가정]
- Tidal 1개월 요금: ₩5,900
- 평균 주문 단가: ₩8,000 (1개월/3개월 혼합)
- PG 수수료: ~3.5% (₩280)
- 건당 SMS 비용: ~₩80 (3회 발송 평균)

[건당 수익]
  매출:         ₩8,000
  - PG 수수료:  -₩280
  - SMS 비용:   -₩80
  - 계정 원가:  -₩3,000 (추정)
  ─────────────────────
  건당 순이익:  ₩4,640

[손익분기 (월간)]
  Phase 2 운영비: ₩27,000/월
  → 필요 주문 수: 27,000 ÷ 4,640 ≈ 6건/월

  Phase 3 운영비: ₩199,000/월
  → 필요 주문 수: 199,000 ÷ 4,640 ≈ 43건/월

  Phase 4 운영비: ₩534,000/월
  → 필요 주문 수: 534,000 ÷ 4,640 ≈ 115건/월
```

---

## 부록: 개발 일정 (4주 스프린트)

| 주차 | 작업 내용 | 산출물 |
|------|----------|--------|
| **Week 1** | 프로젝트 셋업, Supabase DB 생성, 인증 구현 | 로그인/회원가입 동작 |
| **Week 2** | 랜딩 + 상품 목록/상세 + SEO 기반 | 검색엔진 크롤링 가능 상태 |
| **Week 3** | 결제 연동 + 마이페이지 + 관리자 대시보드 | 전체 결제~배정 플로우 동작 |
| **Week 4** | SMS 알림 + 모바일 최적화 + 배포 + QA | MVP 라이브 배포 |

---

> **문서 끝** | 이 가이드는 PRD v2.0, 화면설계서(Screen Flow), 기술제안서를 기반으로 작성되었으며, 실제 코드 구현 시 참조용입니다.
