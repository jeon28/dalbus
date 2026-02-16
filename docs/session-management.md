# Dalbus 세션 관리 상세 가이드

**Date:** 2026-02-15
**Status:** ✅ Verified (Default Supabase Configuration)

이 문서는 달버스의 데이터베이스 구조와 관계를 정리한 문서입니다. Supabase (PostgreSQL) 환경을 기준으로 합니다.

## 목차
1. [전체 아키텍처 개요](#1-전체-아키텍처-개요)
2. [로그인 프로세스 상세](#2-로그인-프로세스-상세)
3. [세션 초기화 (앱 시작 시)](#3-세션-초기화-앱-시작-시)
4. [세션 상태 변화 감지](#4-세션-상태-변화-감지)
5. [로그아웃 프로세스](#5-로그아웃-프로세스)
6. [관리자 인증 (별도 레이어)](#6-관리자-인증-별도-레이어)
7. [페이지 보호 방식](#7-페이지-보호-방식)
8. [세션 저장소 구조](#8-세션-저장소-구조)
9. [세션 타임아웃 조정 방법](#9-세션-타임아웃-조정-방법)

---

## 1. 전체 아키텍처 개요

```
┌─────────────────────────────────────────────────────┐
│                    브라우저                            │
│                                                     │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────┐ │
│  │  Supabase    │   │ localStorage │   │  React   │ │
│  │  Auth SDK    │   │              │   │ Context  │ │
│  │              │   │ dalbus-user  │   │          │ │
│  │ - JWT 토큰    │   │ dalbus-      │   │ user     │ │
│  │ - Refresh    │   │   isAdmin    │   │ isAdmin  │ │
│  │   Token      │   │              │   │ isHydra- │ │
│  │ - 자동 갱신   │   │              │   │   ted    │ │
│  └──────┬───────┘   └──────┬───────┘   └────┬─────┘ │
│         │                  │                │       │
│         └──────────────────┴────────────────┘       │
│                        ↕ 동기화                      │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │   Supabase Server   │
              │   (PostgreSQL)      │
              │                     │
              │  auth.users 테이블   │
              │  profiles 테이블     │
              └─────────────────────┘
```

**3개 저장소가 동기화되어 동작:**
- **Supabase Auth SDK**: JWT + Refresh Token 관리 (실제 인증의 핵심)
- **localStorage**: 빠른 UI 복원을 위한 캐시
- **React Context**: 컴포넌트에서 사용하는 실시간 상태

---

## 2. 로그인 프로세스 상세

**파일:** `src/app/(auth)/login/page.tsx`

```
사용자가 이메일/비밀번호 입력 후 "로그인" 클릭
│
▼
[Step 1] 입력값 검증
│  - id(이메일)와 password가 비어있는지 확인
│  - 비어있으면 alert 표시 후 중단
│
▼
[Step 2] 이메일 존재 여부 확인
│  - POST /api/auth/check-user { email }
│  - 서버에서 supabaseAdmin (Service Role Key) 사용
│  - RLS를 우회해서 auth.users 테이블 조회
│  - 존재하지 않으면: "가입되지 않은 이메일입니다" alert → 중단
│  - 존재하면: 다음 단계로
│  - API 호출 실패해도: 로그인 시도는 계속 진행
│
▼
[Step 3] Supabase 로그인
│  - supabase.auth.signInWithPassword({ email, password })
│  - Supabase SDK가 내부적으로:
│    1. 서버에 인증 요청
│    2. JWT Access Token + Refresh Token 발급
│    3. 브라우저 localStorage에 토큰 자동 저장
│       (키: sb-{project-ref}-auth-token)
│
├─ 실패 시:
│  - "Invalid login credentials" → "비밀번호가 일치하지 않습니다"
│  - 기타 에러 → 에러 메시지 표시
│
▼
[Step 4] 프로필 조회 & 역할 확인
│  - profiles 테이블에서 role 컬럼 조회
│  - role === 'admin' 여부 확인
│
▼
[Step 5] 리다이렉트
│  - admin → router.push('/admin')
│  - 일반 사용자 → router.push('/')
│
▼
[Step 6] ServiceContext 자동 동기화 (자동 발생)
   - onAuthStateChange 리스너가 SIGNED_IN 이벤트 감지
   - profiles 테이블에서 사용자 정보 재조회
   - React state (user, isAdmin) 업데이트
   - localStorage에 dalbus-user, dalbus-isAdmin 저장
```

---

## 3. 세션 초기화 (앱 시작 시)

**파일:** `src/lib/ServiceContext.tsx`

사용자가 페이지를 새로고침하거나 재방문할 때 실행되는 프로세스:

```
ServiceProvider 마운트 (useEffect)
│
▼
[Step 1] supabase.auth.getSession() 호출
│  - Supabase SDK가 localStorage에서 저장된 토큰 확인
│  - Access Token이 만료되었으면 Refresh Token으로 자동 갱신
│  - 유효한 세션이 있으면 session 객체 반환
│
├─ 세션 있음 (session?.user 존재):
│  │
│  ▼
│  [Step 2a] profiles 테이블 조회
│  │  - SELECT name, email, phone, role
│  │  - WHERE id = session.user.id
│  │
│  ▼
│  [Step 3a] User 객체 구성
│  │  - name: profile.name > user_metadata.name > email앞부분 > 'User'
│  │  - email: profile.email > session.user.email
│  │  - phone: profile.phone
│  │
│  ▼
│  [Step 4a] 상태 저장
│     - setUser(userObj)
│     - localStorage.setItem('dalbus-user', JSON.stringify(userObj))
│     - role === 'admin' → setIsAdmin(true) + localStorage 저장
│     - role !== 'admin' → setIsAdmin(false) + localStorage 제거
│
├─ 세션 없음:
│  │
│  ▼
│  [Step 2b] 상태 초기화
│     - setUser(null), setIsAdmin(false)
│     - localStorage에서 dalbus-user, dalbus-isAdmin 제거
│
├─ 에러 발생:
│  │
│  ▼
│  [Step 2c] AbortError가 아니면 콘솔 에러 출력
│     - 상태를 null/false로 초기화
│     - localStorage 정리
│
▼
[Step 5] isHydrated = true
   - finally 블록에서 항상 실행
   - 이 값이 true가 되어야 UI 컴포넌트들이 렌더링 시작
   - SSR/CSR 불일치(hydration mismatch) 방지
```

---

## 4. 세션 상태 변화 감지

**파일:** `src/lib/ServiceContext.tsx`

```
supabase.auth.onAuthStateChange(callback) 등록
│
│  감지하는 이벤트:
│  - SIGNED_IN: 로그인 완료
│  - SIGNED_OUT: 로그아웃
│  - TOKEN_REFRESHED: 토큰 자동 갱신
│  - USER_UPDATED: 사용자 정보 변경
│
├─ event === 'SIGNED_OUT':
│  │
│  ▼
│  - setUser(null)
│  - setIsAdmin(false)
│  - localStorage에서 dalbus-user, dalbus-isAdmin 제거
│
├─ session?.user 존재:
│  │  (SIGNED_IN, TOKEN_REFRESHED 등)
│  │
│  ▼
│  [1] profiles 테이블 조회
│  [2] User 객체 구성
│  [3] setUser + localStorage 저장
│  [4] role 확인 → isAdmin 상태 업데이트
│
├─ session 없음:
│  │
│  ▼
│  - 상태 초기화 (user=null, isAdmin=false)
│  - localStorage 정리
│
▼
컴포넌트 언마운트 시:
   - subscription.unsubscribe()로 리스너 해제
   - 메모리 누수 방지
```

---

## 5. 로그아웃 프로세스

**파일:** `src/lib/ServiceContext.tsx`

```
사용자가 "로그아웃" 버튼 클릭
│
▼
[Step 1] supabase.auth.signOut() 호출
│  - Supabase SDK가 내부적으로:
│    1. 서버에 로그아웃 요청 (Refresh Token 무효화)
│    2. localStorage에서 sb-xxx-auth-token 삭제
│    3. onAuthStateChange에 SIGNED_OUT 이벤트 발생
│
├─ 성공/실패 관계없이 finally 블록 실행:
│
▼
[Step 2] React 상태 초기화
│  - setUser(null)
│  - setIsAdmin(false)
│  - localStorage.removeItem('dalbus-user')
│  - localStorage.removeItem('dalbus-isAdmin')
│
▼
[Step 3] 페이지 리다이렉트
   - window.location.href = '/login'
   - router.push 대신 hard navigation 사용
   - 모든 React 상태가 완전히 초기화됨
```

**Header에서의 로그아웃 (`src/components/layout/Header.tsx`):**
- 일반 사용자: `onClick={logout}`
- 관리자: `onClick={() => { logout(); logoutAdmin(); }}`
  - `logoutAdmin()`은 isAdmin 상태와 localStorage만 추가로 정리

---

## 6. 관리자 인증 (별도 레이어)

**파일:** `src/app/(protected)/admin/page.tsx`

```
일반 사용자 인증(Supabase Auth) 위에 별도 관리자 인증 레이어가 존재

[사용자 로그인 완료 상태에서]
│
▼
/admin 페이지 접근
│
├─ isAdmin === false:
│  │
│  ▼
│  관리자 로그인 폼 표시
│  │
│  ▼
│  [Step 1] 관리자 ID/PW 입력 후 제출
│  │
│  ▼
│  [Step 2] /api/admin/settings에서 저장된 자격증명 조회
│  │  - DB의 admin_settings 테이블에서 가져옴
│  │
│  ▼
│  [Step 3] 입력값과 DB 값 비교
│  │  - loginId === adminCreds.admin_login_id
│  │  - loginPw === adminCreds.admin_login_pw
│  │
│  ├─ 일치: loginAdmin() → setIsAdmin(true)
│  └─ 불일치: alert 표시
│
├─ isAdmin === true:
│  │
│  ▼
│  관리자 대시보드 표시
```

**특이사항:**
- Supabase Auth와 독립적인 인증 (DB에 저장된 하드코딩 자격증명)
- 관리자 세션은 `isAdmin` React state + localStorage로만 관리
- 브라우저 새로고침 시: Supabase 세션 복원 → profiles.role 확인 → isAdmin 자동 복원
- 별도 admin 로그인 폼의 인증은 새로고침 시 유지되지 않음 (profiles.role이 'admin'이 아닌 경우)

---

## 7. 페이지 보호 방식

**현재 구현: 클라이언트 사이드 가드 (서버 미들웨어 없음)**

```
[보호된 페이지 렌더링 흐름]

컴포넌트 마운트
│
▼
isHydrated 확인
│
├─ false → "Loading..." 표시
│
▼
user 확인
│
├─ null → "로그인이 필요합니다" + 로그인 페이지 링크
│
▼
정상 컨텐츠 렌더링
```

**MyPage 예시** (`src/app/(protected)/mypage/page.tsx`):
- `!isHydrated || loading` → Loading 표시
- `!user` → 로그인 유도 UI 표시
- `isHydrated && user` → 데이터 fetch 시작

**한계점:**
- Next.js 미들웨어를 사용하지 않아 서버 사이드에서 리다이렉트하지 않음
- 보호된 페이지의 HTML이 클라이언트에 먼저 전달된 후 JS로 체크
- API Route는 별도 인증 체크가 필요 (현재 일부만 구현)

---

## 8. 세션 저장소 구조

### Supabase Auth 토큰 (SDK 자동 관리)

| 키 | 위치 | 내용 |
|---|---|---|
| `sb-{ref}-auth-token` | localStorage | JSON: access_token, refresh_token, expires_at 등 |

### Dalbus 커스텀 데이터

| 키 | 위치 | 내용 | 예시 |
|---|---|---|---|
| `dalbus-user` | localStorage | 사용자 프로필 JSON | `{"id":"uuid","name":"홍길동","email":"user@example.com"}` |
| `dalbus-isAdmin` | localStorage | 관리자 여부 | `"true"` 또는 키 없음 |

### Supabase 클라이언트 설정

**일반 클라이언트** (`src/lib/supabase.ts`):
```typescript
// 기본 설정으로 생성 (세션 자동 관리 활성화)
createClient(supabaseUrl, supabaseAnonKey)
// 내부적으로 autoRefreshToken: true, persistSession: true
```

**관리자 클라이언트** (`src/lib/supabaseAdmin.ts`):
```typescript
// 서버 전용 - 세션 관리 비활성화
createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
        autoRefreshToken: false,   // 토큰 자동 갱신 안함
        persistSession: false      // 세션 저장 안함
    }
})
```

---

## 9. 세션 타임아웃 조정 방법

### 현재 기본값 (Supabase 기본 설정)

| 항목 | 기본값 | 설명 |
|---|---|---|
| Access Token 유효기간 | **3600초 (1시간)** | JWT 만료 시간 |
| Refresh Token 유효기간 | **infinite (무제한)** | 갱신 토큰 수명 |
| 자동 갱신 | **활성화** | 만료 전 자동으로 새 토큰 발급 |

> **확인됨(2026-02-15):** Codebase 상 `supabase.ts`에서 별도의 커스텀 auth 옵션을 사용하지 않고 있으므로, 위 기본 설정을 따릅니다.

### 방법 1: Supabase 대시보드에서 설정 (권장)

```
Supabase Dashboard → Authentication → Configuration → Sessions
```

| 설정 항목 | 위치 | 조정 가능 범위 |
|---|---|---|
| JWT Expiry Limit | Auth Settings | 300초 ~ 604800초 (5분 ~ 7일) |
| Refresh Token Rotation | Auth Settings | 활성화/비활성화 |
| Refresh Token Reuse Interval | Auth Settings | 0초 ~ |
| Inactivity Timeout | Auth Settings (Pro 이상) | 비활동 시 자동 만료 |

**JWT Expiry 변경 예시:**
1. Supabase Dashboard 접속
2. Authentication → Settings → General
3. "JWT Expiry Limit" 값 변경
4. 짧게 설정하면 → 더 자주 토큰 갱신 (보안 강화)
5. 길게 설정하면 → 덜 갱신 (서버 부하 감소)

### 방법 2: 클라이언트 코드에서 세션 관리 강화

**`src/lib/supabase.ts`를 수정하여 세션 옵션 커스터마이즈:**

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        // 자동 토큰 갱신 (기본: true)
        autoRefreshToken: true,

        // 세션을 localStorage에 저장 (기본: true)
        // false로 하면 탭 닫으면 로그아웃됨
        persistSession: true,

        // 세션 감지 방식
        detectSessionInUrl: true,

        // 커스텀 스토리지 (sessionStorage로 변경하면 탭 닫을 때 만료)
        // storage: window.sessionStorage,

        // 토큰 자동 갱신 주기 커스터마이즈
        // flowType: 'pkce',
    }
});
```

### 방법 3: 비활동 기반 자동 로그아웃 구현

현재 프로젝트에는 비활동 타임아웃이 없음. 직접 구현 가능:

```typescript
// ServiceContext.tsx에 추가 가능한 비활동 감지 로직 예시

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30분

useEffect(() => {
    let timer: NodeJS.Timeout;

    const resetTimer = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            // 비활동 시간 초과 → 자동 로그아웃
            logout();
            alert('장시간 미사용으로 자동 로그아웃되었습니다.');
        }, INACTIVITY_TIMEOUT);
    };

    // 사용자 활동 이벤트 감지
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, resetTimer));

    resetTimer(); // 초기 타이머 시작

    return () => {
        clearTimeout(timer);
        events.forEach(event => window.removeEventListener(event, resetTimer));
    };
}, []);
```

### 방법 4: 탭 닫으면 세션 만료 (sessionStorage 사용)

```typescript
// src/lib/supabase.ts 수정
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
    }
});
```

- `localStorage` → 브라우저 닫아도 유지
- `sessionStorage` → 탭/창 닫으면 세션 삭제

### 방법 5: Refresh Token 수명 제한 (Supabase Dashboard)

```
Supabase Dashboard → Authentication → Configuration

설정:
  - Refresh Token Rotation: Enabled
  - Refresh Token Reuse Interval: 10 (초)
```

Rotation을 활성화하면:
- 매번 토큰 갱신 시 새 Refresh Token 발급
- 이전 Refresh Token은 Reuse Interval 후 무효화
- 탈취된 토큰의 재사용 방지

### 조합 추천

| 시나리오 | JWT Expiry | Refresh Token | 클라이언트 설정 | 비활동 로그아웃 |
|---|---|---|---|---|
| 현재 (기본) | 1시간 | 무제한 | localStorage | 없음 |
| 보안 강화 | 15분 | Rotation 활성화 | localStorage | 30분 |
| 최대 보안 | 5분 | Rotation + 짧은 수명 | sessionStorage | 15분 |
| 편의성 우선 | 24시간 | 무제한 | localStorage | 없음 |

---

## 부록: 관련 파일 목록

| 파일 | 역할 |
|---|---|
| `src/lib/supabase.ts` | Supabase 클라이언트 (공개키, 세션 자동 관리) |
| `src/lib/supabaseAdmin.ts` | Supabase 관리자 클라이언트 (Service Role, 서버 전용) |
| `src/lib/ServiceContext.tsx` | 전역 인증 상태 관리 (React Context) |
| `src/app/(auth)/login/page.tsx` | 로그인 페이지 |
| `src/app/(auth)/signup/page.tsx` | 회원가입 페이지 |
| `src/app/(protected)/admin/page.tsx` | 관리자 인증 + 대시보드 |
| `src/app/(protected)/mypage/page.tsx` | 사용자 마이페이지 (보호 페이지) |
| `src/components/layout/Header.tsx` | 네비게이션 (로그인/로그아웃 버튼) |
| `src/app/api/auth/check-user/route.ts` | 이메일 존재 여부 확인 API |
