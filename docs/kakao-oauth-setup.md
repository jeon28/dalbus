# 카카오 로그인 연동 가이드

## 개요

Supabase OAuth를 통해 카카오 소셜 로그인을 연동하는 설정 가이드입니다.

---

## 1. 카카오 개발자 콘솔 설정

### 1-1. 앱 등록

1. [카카오 개발자 콘솔](https://developers.kakao.com) 접속 → 로그인
2. **내 애플리케이션** → **애플리케이션 추가하기**
3. 앱 이름 `Dalbus`, 사업자명 입력 후 저장

### 1-2. REST API 키 확인

- **앱 설정 → 요약 정보** → `REST API 키` 복사
- 이 값이 Supabase의 **Client ID**로 사용됨

### 1-3. 카카오 로그인 활성화

**제품 설정 → 카카오 로그인**
- 활성화 설정 → **ON**

### 1-4. Redirect URI 등록

**제품 설정 → 카카오 로그인 → REST API 키 수정 → 카카오 로그인 리다이렉트 URI**

| 환경 | URI |
|---|---|
| 운영 | `https://etfoluotiejftyqbourd.supabase.co/auth/v1/callback` |
| 로컬 | `http://localhost:3000/auth/callback` |

### 1-5. 클라이언트 시크릿 확인

**제품 설정 → 카카오 로그인 → REST API 키 수정 → 클라이언트 시크릿**

- 코드 값 복사 (키 발급 시 기본 활성화 상태)
- 이 값이 Supabase의 **Client Secret**으로 사용됨

### 1-6. 동의 항목 설정 (선택)

**제품 설정 → 카카오 로그인 → 동의항목**
- 닉네임: 필수 동의
- 카카오계정(이메일): 선택 동의 또는 필수 동의
  - 이메일 수집은 **비즈앱 전환** 후 필수 동의로 설정 가능

---

## 2. Supabase 설정

### 2-1. Kakao Provider 활성화

Supabase Dashboard → Auth → Providers
```
https://supabase.com/dashboard/project/etfoluotiejftyqbourd/auth/providers
```

| 항목 | 값 |
|---|---|
| Enable Kakao | ON |
| Client ID | 카카오 REST API 키 |
| Client Secret | 카카오 클라이언트 시크릿 코드 |

저장(Save) 클릭

---

## 3. DB 마이그레이션

카카오 신규 가입자의 `signup_method`가 정상 저장되도록 트리거 수정이 필요합니다.

**파일:** `supabase/migrations/20260512_fix_handle_new_user_signup_method.sql`

Supabase SQL Editor에서 실행:
```
https://supabase.com/dashboard/project/etfoluotiejftyqbourd/sql
```

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    provider TEXT;
BEGIN
    provider := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');

    INSERT INTO public.profiles (id, email, name, role, signup_method)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(COALESCE(NEW.email, ''), '@', 1)),
        'user',
        provider
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 4. 코드 구현 현황

### 로그인 버튼

`src/app/(auth)/login/page.tsx`에 이미 구현되어 있습니다.

```typescript
const handleSocialLogin = async (provider: 'google' | 'kakao') => {
    setIsLoading(true);
    try {
        const { error } = await supabase.auth.signInWithOAuth({
            provider,
            options: {
                redirectTo: `${window.location.origin}/signup/complete`,
            }
        });
        if (error) throw error;
    } catch (error) {
        alert(`Kakao 로그인 중 오류가 발생했습니다.`);
        setIsLoading(false);
    }
};
```

### OAuth 콜백 처리

`src/app/(auth)/signup/complete/page.tsx`에서 `onAuthStateChange`로 처리합니다.
- Supabase 클라이언트의 `detectSessionInUrl: true` 설정으로 PKCE 코드 자동 교환
- 신규 소셜 유저 → 프로필 완성 폼 표시
- 기존 유저 (프로필 완성) → 홈(`/`)으로 리다이렉트

---

## 5. 로그인 흐름

```
사용자 "Kakao로 계속하기" 클릭
    ↓
카카오 인증 페이지로 이동
    ↓
카카오 로그인 완료
    ↓
Supabase 콜백 처리 (etfoluotiejftyqbourd.supabase.co/auth/v1/callback)
    ↓
/signup/complete?code=XXX 로 리다이렉트
    ↓
[신규 유저] 이름·생년월일·전화번호 입력 폼
[기존 유저] 홈(/) 으로 자동 이동
```

---

## 6. profiles 테이블 signup_method 값

| 가입 경로 | signup_method |
|---|---|
| 이메일 | `email` |
| 카카오 | `kakao` |
| 구글 | `google` |

---

## 7. 주의사항

- **이메일 수집**: 카카오는 기본적으로 이메일 제공이 선택사항입니다. 이메일을 필수로 받으려면 카카오 비즈앱 전환이 필요합니다.
- **Supabase Dashboard의 `/auth/oauth-server`**: 이 페이지는 Supabase를 OAuth 서버로 사용하는 기능으로, 카카오 연동과 무관합니다. 카카오 설정은 `/auth/providers` 페이지에서 합니다.
- **클라이언트 시크릿**: 외부에 노출되지 않도록 주의하세요. `.env.local` 등에 저장하지 않고 Supabase Dashboard에만 입력합니다.
