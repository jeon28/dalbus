# Dalbus - Supabase 기능 사용 전체 정리

## 목차
1. [클라이언트 구성](#1-클라이언트-구성)
2. [인증(Auth) 기능](#2-인증auth-기능)
3. [DB 조회 - 클라이언트 사이드](#3-db-조회---클라이언트-사이드)
4. [DB 조회 - 서버 사이드 (Admin)](#4-db-조회---서버-사이드-admin)
5. [미사용 기능](#5-미사용-기능)
6. [테이블별 사용 현황 요약](#6-테이블별-사용-현황-요약)
7. [파일별 사용 현황 요약](#7-파일별-사용-현황-요약)

---

## 1. 클라이언트 구성

프로젝트에서 Supabase 클라이언트를 **2개** 생성하여 사용한다.

### 1-1. 일반 클라이언트 (Anon Key)

**파일:** `src/lib/supabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

| 항목 | 설명 |
|---|---|
| 사용 위치 | 클라이언트 컴포넌트 (`"use client"`) |
| 인증키 | `NEXT_PUBLIC_SUPABASE_ANON_KEY` (공개키) |
| 세션 관리 | `autoRefreshToken: true`, `persistSession: true` (기본값) |
| RLS 적용 | **적용됨** - 로그인한 사용자 본인 데이터만 접근 가능 |
| 주 용도 | Auth 함수, 공개 데이터 조회, 사용자 본인 데이터 조회 |

### 1-2. 관리자 클라이언트 (Service Role Key)

**파일:** `src/lib/supabaseAdmin.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});
```

| 항목 | 설명 |
|---|---|
| 사용 위치 | API Route 서버 사이드만 (`route.ts`) |
| 인증키 | `SUPABASE_SERVICE_ROLE_KEY` (비밀키, 서버 전용) |
| 세션 관리 | 비활성화 (서버에서 쓰므로 불필요) |
| RLS 적용 | **우회** - 모든 데이터 접근 가능 |
| 주 용도 | Admin CRUD, 주문 처리, 회원 관리 등 |

---

## 2. 인증(Auth) 기능

총 **6개** Auth 함수 사용

### 2-1. `supabase.auth.signInWithPassword`

| 항목 | 내용 |
|---|---|
| 파일 | `src/app/(auth)/login/page.tsx` (line 45) |
| 용도 | 이메일/비밀번호 로그인 |

```typescript
const { data, error } = await supabase.auth.signInWithPassword({
    email: id,
    password: password,
});
```

### 2-2. `supabase.auth.signUp`

| 항목 | 내용 |
|---|---|
| 파일 | `src/app/(auth)/signup/page.tsx` (line 174) |
| 용도 | 회원가입 (이메일 인증 포함) |

```typescript
const { data, error } = await supabase.auth.signUp({
    email: formData.id,
    password: formData.password,
    options: {
        emailRedirectTo: `${window.location.origin}/login`,
        data: {
            name: formData.name,
            phone: formData.phone,
            login_id: formData.id
        }
    }
});
```

### 2-3. `supabase.auth.getSession`

| 항목 | 내용 |
|---|---|
| 파일 | `src/lib/ServiceContext.tsx` (line 95) |
| 용도 | 앱 시작 시 기존 세션 확인 |

```typescript
const { data: { session } } = await supabase.auth.getSession();
```

### 2-4. `supabase.auth.onAuthStateChange`

| 항목 | 내용 |
|---|---|
| 파일 | `src/lib/ServiceContext.tsx` (line 148) |
| 용도 | 인증 상태 실시간 감지 (로그인/로그아웃/토큰 갱신) |

```typescript
const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
        // SIGNED_OUT, SIGNED_IN, TOKEN_REFRESHED 등 처리
    }
);
// 언마운트 시: subscription.unsubscribe()
```

### 2-5. `supabase.auth.signOut`

| 항목 | 내용 |
|---|---|
| 파일 | `src/lib/ServiceContext.tsx` (line 221) |
| 용도 | 로그아웃 처리 |

```typescript
await supabase.auth.signOut();
```

### 2-6. `supabaseAdmin.auth.admin.deleteUser`

| 항목 | 내용 |
|---|---|
| 파일 | `src/app/api/admin/members/route.ts` (line 58) |
| 용도 | 관리자가 회원 삭제 시 auth.users에서도 제거 |

```typescript
await supabaseAdmin.auth.admin.deleteUser(userId);
```

---

## 3. DB 조회 - 클라이언트 사이드

`supabase` (Anon Key) 클라이언트를 사용하는 DB 쿼리들. RLS가 적용됨.

### 3-1. ServiceContext.tsx

| 쿼리 | 테이블 | 작업 | 라인 |
|---|---|---|---|
| 상품 목록 조회 | `products` + `product_plans` | SELECT | 48-52 |
| 프로필 조회 (세션 초기화) | `profiles` | SELECT | 99-103 |
| 프로필 조회 (상태 변화) | `profiles` | SELECT | 157-161 |
| 상품 가격 수정 | `products` | UPDATE | 197-200 |

```typescript
// 상품 + 플랜 전체 조회
supabase.from('products').select('*, product_plans(*)').eq('is_active', true).order('sort_order', { ascending: true })

// 프로필 조회
supabase.from('profiles').select('name, email, phone, role').eq('id', session.user.id).single()

// 가격 업데이트
supabase.from('products').update({ original_price: numericPrice }).eq('id', id)
```

### 3-2. login/page.tsx

| 쿼리 | 테이블 | 작업 | 라인 |
|---|---|---|---|
| 역할(role) 확인 | `profiles` | SELECT | 63-67 |

```typescript
supabase.from('profiles').select('role').eq('id', data.user.id).single()
```

### 3-3. signup/page.tsx

| 쿼리 | 테이블 | 작업 | 라인 |
|---|---|---|---|
| 프로필 생성/업데이트 | `profiles` | UPSERT | 204-216 |

```typescript
supabase.from('profiles').upsert([{
    id: data.user.id,
    name: formData.name,
    email: formData.id,
    phone: formData.phone,
    updated_at: new Date().toISOString()
}], { onConflict: 'id' })
```

### 3-4. mypage/page.tsx

| 쿼리 | 테이블 | 작업 | 라인 |
|---|---|---|---|
| 내 주문 목록 | `orders` + `products` + `product_plans` | SELECT | 31-40 |

```typescript
supabase.from('orders').select(`
    assignment_status, products(name), product_plans(duration_months), order_number
`).eq('user_id', user?.id).order('created_at', { ascending: false })
```

### 3-5. service/[id]/page.tsx

| 쿼리 | 테이블 | 작업 | 라인 |
|---|---|---|---|
| 상품 상세 조회 | `products` | SELECT | 30-34 |
| 플랜 목록 조회 | `product_plans` | SELECT | 50-55 |

```typescript
supabase.from('products').select('*').eq('id', serviceId).single()
supabase.from('product_plans').select('*').eq('product_id', serviceId).eq('is_active', true).order('duration_months', { ascending: true })
```

### 3-6. public/notices/page.tsx

| 쿼리 | 테이블 | 작업 | 라인 |
|---|---|---|---|
| 공지사항 목록 | `notices` | SELECT | 26-31 |

```typescript
supabase.from('notices').select('*').eq('is_published', true).order('is_pinned', { ascending: false }).order('created_at', { ascending: false })
```

### 3-7. public/faq/page.tsx

| 쿼리 | 테이블 | 작업 | 라인 |
|---|---|---|---|
| FAQ 목록 | `faqs` | SELECT | 34-38 |
| FAQ 카테고리 | `faq_categories` | SELECT | 41-44 |

```typescript
supabase.from('faqs').select('*').eq('is_published', true).order('sort_order', { ascending: true })
supabase.from('faq_categories').select('*').order('sort_order', { ascending: true })
```

### 3-8. public/qna/page.tsx

| 쿼리 | 테이블 | 작업 | 라인 |
|---|---|---|---|
| Q&A 목록 | `qna` | SELECT | 37-43 |

```typescript
supabase.from('qna').select('*').order('created_at', { ascending: false })
// 비밀글 필터: .eq('is_secret', false) 또는 .eq('user_id', userId)
```

### 3-9. check-email API (서버이지만 일반 클라이언트 사용)

| 쿼리 | 테이블 | 작업 | 라인 |
|---|---|---|---|
| 이메일 중복 확인 | `profiles` | SELECT | 25-29 |

```typescript
// src/app/api/auth/check-email/route.ts
supabase.from('profiles').select('email').eq('email', email).single()
```

---

## 4. DB 조회 - 서버 사이드 (Admin)

`supabaseAdmin` (Service Role Key) 클라이언트를 사용하는 DB 쿼리들. RLS 우회.

### 4-1. 계정(Account) 관리

**파일:** `src/app/api/admin/accounts/route.ts`

| 작업 | 설명 |
|---|---|
| SELECT | 전체 계정 조회 (products, order_accounts, orders, profiles 조인) |
| INSERT | 새 공유 계정 생성 |

**파일:** `src/app/api/admin/accounts/[id]/route.ts`

| 작업 | 설명 |
|---|---|
| UPDATE | 계정 정보 수정 |
| SELECT (count) | 계정에 연결된 slot 수 확인 |
| DELETE | 계정 삭제 |

**파일:** `src/app/api/admin/accounts/[id]/assign/route.ts`

| 작업 | 테이블 | 설명 |
|---|---|---|
| SELECT | `accounts` | 계정의 product_id 조회 |
| SELECT | `product_plans` | 플랜 조회 |
| INSERT | `orders` | 수동 주문 생성 |
| SELECT | `orders` | 주문 상세 조회 |
| UPDATE | `orders` | start_date, end_date 설정 |
| SELECT | `order_accounts` | 기존 할당 확인 |
| INSERT | `order_accounts` | 슬롯 할당 |
| SELECT (count) | `order_accounts` | 실제 사용 슬롯 수 |
| UPDATE | `accounts` | used_slots 갱신 |
| UPDATE | `orders` | assignment_status → 'assigned' |

**파일:** `src/app/api/admin/accounts/import/route.ts`

| 작업 | 테이블 | 설명 |
|---|---|---|
| SELECT | `products` | 'tidal-hifi' 상품 조회 |
| SELECT | `accounts` | 기존 계정 존재 여부 확인 |
| UPDATE | `accounts` | 기존 계정 정보 업데이트 |
| INSERT | `accounts` | 새 계정 생성 |
| SELECT | `orders` | 주문번호로 주문 조회 |
| UPSERT | `order_accounts` | 슬롯 데이터 upsert |
| SELECT | `order_accounts` | 기존 슬롯 확인 |
| UPDATE | `order_accounts` | 기존 슬롯 업데이트 |
| INSERT | `order_accounts` | 새 슬롯 생성 |
| SELECT (count) | `order_accounts` | 실제 사용 슬롯 수 |
| UPDATE | `accounts` | used_slots 갱신 |

**파일:** `src/app/api/admin/accounts/move/route.ts`

| 작업 | 테이블 | 설명 |
|---|---|---|
| SELECT | `order_accounts` | 현재 할당 조회 |
| SELECT | `accounts` | 대상 계정 슬롯 현황 |
| SELECT | `order_accounts` | 대상 슬롯 점유 확인 |
| UPDATE | `order_accounts` | 할당 이동 |
| UPDATE | `accounts` | 출발/도착 계정 used_slots 갱신 |

### 4-2. 할당(Assignment) 관리

**파일:** `src/app/api/admin/assignments/[id]/route.ts`

| 작업 | 테이블 | 설명 |
|---|---|---|
| UPDATE | `order_accounts` | 할당 정보 수정 |
| SELECT | `order_accounts` | 주문ID 조회 |
| SELECT | `orders` + `product_plans` | 주문/플랜 정보 |
| UPDATE | `orders` | 주문 정보 수정 (날짜 등) |
| DELETE | `order_accounts` | 할당 해제 |
| SELECT (count) | `order_accounts` | 실제 슬롯 수 재계산 |
| UPDATE | `accounts` | used_slots 갱신 |
| UPDATE | `orders` | assignment_status → 'waiting' |

### 4-3. 주문(Order) 관리

**파일:** `src/app/api/admin/orders/route.ts`

| 작업 | 설명 |
|---|---|
| SELECT | 전체 주문 조회 (profiles, products, product_plans, order_accounts 조인) |

**파일:** `src/app/api/admin/orders/[id]/status/route.ts`

| 작업 | 설명 |
|---|---|
| UPDATE | 결제/할당 상태 변경 |

**파일:** `src/app/api/orders/route.ts` (공개 API)

| 작업 | 테이블 | 설명 |
|---|---|---|
| INSERT | `orders` | 새 주문 생성 |
| SELECT | `site_settings` | 관리자 이메일 조회 (알림용) |

### 4-4. 상품(Product) 관리

**파일:** `src/app/api/admin/products/route.ts`

| 작업 | 설명 |
|---|---|
| SELECT | 전체 상품 + 플랜 조회 |
| INSERT | 새 상품 생성 |

**파일:** `src/app/api/admin/products/[id]/route.ts`

| 작업 | 설명 |
|---|---|
| SELECT | 단일 상품 + 플랜 조회 |
| UPDATE | 상품 정보 수정 |
| DELETE | 상품 삭제 |

### 4-5. 플랜(Plan) 관리

**파일:** `src/app/api/admin/plans/route.ts`

| 작업 | 설명 |
|---|---|
| INSERT | 새 플랜 생성 |

**파일:** `src/app/api/admin/plans/[id]/route.ts`

| 작업 | 설명 |
|---|---|
| UPDATE | 플랜 수정 |
| DELETE | 플랜 삭제 |

### 4-6. 회원(Member) 관리

**파일:** `src/app/api/admin/members/route.ts`

| 작업 | 테이블 | 설명 |
|---|---|---|
| SELECT | `profiles` | 일반 회원 목록 조회 (role='user') |
| SELECT | `orders` | 삭제 전 주문 존재 확인 |
| DELETE | `profiles` | 프로필 삭제 |
| auth.admin.deleteUser | `auth.users` | 인증 사용자 삭제 |

### 4-7. 공지사항(Notice) 관리

**파일:** `src/app/api/admin/notices/route.ts`

| 작업 | 설명 |
|---|---|
| SELECT | 전체 공지 조회 (고정 우선, 최신순) |
| INSERT | 공지 생성 |

**파일:** `src/app/api/admin/notices/[id]/route.ts`

| 작업 | 설명 |
|---|---|
| UPDATE | 공지 수정 |
| DELETE | 공지 삭제 |

**파일:** `src/app/api/admin/notice-categories/route.ts`

| 작업 | 설명 |
|---|---|
| SELECT | 카테고리 목록 |
| INSERT | 카테고리 생성 |

**파일:** `src/app/api/admin/notice-categories/[id]/route.ts`

| 작업 | 설명 |
|---|---|
| DELETE | 카테고리 삭제 |

### 4-8. FAQ 관리

**파일:** `src/app/api/admin/faqs/route.ts`

| 작업 | 설명 |
|---|---|
| SELECT | 전체 FAQ 조회 |
| INSERT | FAQ 생성 |

**파일:** `src/app/api/admin/faqs/[id]/route.ts`

| 작업 | 설명 |
|---|---|
| UPDATE | FAQ 수정 |
| DELETE | FAQ 삭제 |

**파일:** `src/app/api/admin/faq-categories/route.ts`

| 작업 | 설명 |
|---|---|
| SELECT | 카테고리 목록 |
| INSERT | 카테고리 생성 |

**파일:** `src/app/api/admin/faq-categories/[id]/route.ts`

| 작업 | 설명 |
|---|---|
| DELETE | 카테고리 삭제 |

### 4-9. Q&A 관리

**파일:** `src/app/api/qna/route.ts`

| 작업 | 설명 |
|---|---|
| SELECT | Q&A 목록 조회 (비밀글/작성자 필터) |
| INSERT | Q&A 작성 |

**파일:** `src/app/api/qna/[id]/route.ts`

| 작업 | 설명 |
|---|---|
| SELECT | 단일 Q&A 조회 |
| UPDATE | Q&A 수정 |
| DELETE | Q&A 삭제 |

**파일:** `src/app/api/qna/[id]/verify/route.ts`

| 작업 | 설명 |
|---|---|
| SELECT | 비밀번호 확인 (비회원 글) |

**파일:** `src/app/api/admin/qna/[id]/answer/route.ts`

| 작업 | 설명 |
|---|---|
| UPDATE | 관리자 답변 등록 |

### 4-10. 은행 계좌 관리

**파일:** `src/app/api/admin/bank-accounts/route.ts`

| 작업 | 설명 |
|---|---|
| SELECT | 계좌 목록 조회 |
| INSERT | 계좌 등록 |

**파일:** `src/app/api/admin/bank-accounts/[id]/route.ts`

| 작업 | 설명 |
|---|---|
| DELETE | 계좌 삭제 |
| UPDATE | 계좌 수정 |

### 4-11. 사이트 설정

**파일:** `src/app/api/admin/settings/route.ts`

| 작업 | 설명 |
|---|---|
| SELECT | 관리자 설정 조회 (id='main') |
| UPDATE | 관리자 설정 수정 |

### 4-12. 인증 확인 API

**파일:** `src/app/api/auth/check-user/route.ts`

| 작업 | 설명 |
|---|---|
| SELECT | 이메일 존재 여부 확인 (로그인 시) |

---

## 5. 미사용 기능

현재 프로젝트에서 **사용하지 않는** Supabase 기능:

| 기능 | 상태 | 비고 |
|---|---|---|
| `supabase.storage` | ❌ 미사용 | 파일/이미지 업로드 없음 |
| `supabase.channel` / `realtime` | ❌ 미사용 | 실시간 구독 없음 |
| `supabase.functions` | ❌ 미사용 | Edge Functions 없음 |
| `supabase.auth.resetPasswordForEmail` | ❌ 미사용 | 비밀번호 재설정 미구현 |
| `supabase.auth.getUser` | ❌ 미사용 | getSession으로 대체 |
| `supabase.rpc` | ❌ 미사용 | 서버 함수 호출 없음 |

---

## 6. 테이블별 사용 현황 요약

| 테이블 | SELECT | INSERT | UPDATE | DELETE | UPSERT | 사용 파일 수 |
|---|---|---|---|---|---|---|
| `products` | ✅ | ✅ | ✅ | ✅ | - | 5 |
| `product_plans` | ✅ | ✅ | ✅ | ✅ | - | 5 |
| `profiles` | ✅ | - | - | ✅ | ✅ | 6 |
| `orders` | ✅ | ✅ | ✅ | - | - | 6 |
| `order_accounts` | ✅ | ✅ | ✅ | ✅ | ✅ | 4 |
| `accounts` | ✅ | ✅ | ✅ | ✅ | - | 4 |
| `notices` | ✅ | ✅ | ✅ | ✅ | - | 3 |
| `notice_categories` | ✅ | ✅ | - | ✅ | - | 2 |
| `faqs` | ✅ | ✅ | ✅ | ✅ | - | 3 |
| `faq_categories` | ✅ | ✅ | - | ✅ | - | 2 |
| `qna` | ✅ | ✅ | ✅ | ✅ | - | 4 |
| `bank_accounts` | ✅ | ✅ | ✅ | ✅ | - | 2 |
| `site_settings` | ✅ | - | ✅ | - | - | 2 |

---

## 7. 파일별 사용 현황 요약

### 클라이언트 사이드 (supabase - Anon Key)

| 파일 | Auth | DB 쿼리 수 | 주요 테이블 |
|---|---|---|---|
| `lib/ServiceContext.tsx` | getSession, onAuthStateChange, signOut | 4 | products, profiles |
| `(auth)/login/page.tsx` | signInWithPassword | 1 | profiles |
| `(auth)/signup/page.tsx` | signUp | 1 | profiles |
| `(protected)/mypage/page.tsx` | - | 1 | orders |
| `service/[id]/page.tsx` | - | 2 | products, product_plans |
| `public/notices/page.tsx` | - | 1 | notices |
| `public/faq/page.tsx` | - | 2 | faqs, faq_categories |
| `public/qna/page.tsx` | - | 1 | qna |

### 서버 사이드 (supabaseAdmin - Service Role Key)

| 파일 | Auth | DB 쿼리 수 | 주요 테이블 |
|---|---|---|---|
| `api/admin/accounts/route.ts` | - | 2 | accounts |
| `api/admin/accounts/[id]/route.ts` | - | 3 | accounts, order_accounts |
| `api/admin/accounts/[id]/assign/route.ts` | - | 10 | accounts, orders, order_accounts, product_plans |
| `api/admin/accounts/import/route.ts` | - | 11 | products, accounts, orders, order_accounts |
| `api/admin/accounts/move/route.ts` | - | 7 | order_accounts, accounts |
| `api/admin/assignments/[id]/route.ts` | - | 8 | order_accounts, orders, accounts |
| `api/admin/orders/route.ts` | - | 1 | orders |
| `api/admin/orders/[id]/status/route.ts` | - | 1 | orders |
| `api/admin/products/route.ts` | - | 2 | products |
| `api/admin/products/[id]/route.ts` | - | 3 | products |
| `api/admin/plans/route.ts` | - | 1 | product_plans |
| `api/admin/plans/[id]/route.ts` | - | 2 | product_plans |
| `api/admin/members/route.ts` | deleteUser | 3 | profiles, orders |
| `api/admin/notices/route.ts` | - | 2 | notices |
| `api/admin/notices/[id]/route.ts` | - | 2 | notices |
| `api/admin/notice-categories/route.ts` | - | 2 | notice_categories |
| `api/admin/notice-categories/[id]/route.ts` | - | 1 | notice_categories |
| `api/admin/faqs/route.ts` | - | 2 | faqs |
| `api/admin/faqs/[id]/route.ts` | - | 2 | faqs |
| `api/admin/faq-categories/route.ts` | - | 2 | faq_categories |
| `api/admin/faq-categories/[id]/route.ts` | - | 1 | faq_categories |
| `api/admin/bank-accounts/route.ts` | - | 2 | bank_accounts |
| `api/admin/bank-accounts/[id]/route.ts` | - | 2 | bank_accounts |
| `api/admin/settings/route.ts` | - | 2 | site_settings |
| `api/admin/qna/[id]/answer/route.ts` | - | 1 | qna |
| `api/orders/route.ts` | - | 2 | orders, site_settings |
| `api/qna/route.ts` | - | 2 | qna |
| `api/qna/[id]/route.ts` | - | 3 | qna |
| `api/qna/[id]/verify/route.ts` | - | 1 | qna |
| `api/auth/check-user/route.ts` | - | 1 | profiles |
| `api/auth/check-email/route.ts` | - | 1 | profiles |

### 통계

| 항목 | 수 |
|---|---|
| 총 Supabase 사용 파일 수 | **39개** |
| 클라이언트 사이드 쿼리 수 | **13개** |
| 서버 사이드 쿼리 수 | **80+개** |
| Auth 함수 사용 수 | **6개** |
| 사용된 테이블 수 | **13개** |
