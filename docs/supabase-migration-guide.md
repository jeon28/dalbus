# Supabase 프로젝트 이전 가이드 (supabase db dump 방식)

## ap-south-1 (인도) → us-east-1 (미국 동부)

> **문서 작성일**: 2026-02-22
> **전제 조건**: Docker Desktop 설치 및 실행 중
> **목표**: `.env.local` 값만 바꾸면 두 환경 모두에서 정상 동작

---

## 이전 대상 정보

| 구분 | 소스 (이전 전) | 대상 (이전 후) |
|------|--------------|--------------|
| 프로젝트명 | `dalbus` | `dalbus-us-north` |
| 지역 | `ap-south-1` (인도) | `us-east-1` (미국 동부) |
| Project Ref | `axfopkixhvqqfpilljlk` | `etfoluotiejftyqbourd` |
| Project URL | `https://axfopkixhvqqfpilljlk.supabase.co` | `https://etfoluotiejftyqbourd.supabase.co` |

---

## 이전 범위

- ✅ Public 스키마 전체 (테이블 구조, 인덱스, 제약조건, 열거형, 함수, 트리거)
- ✅ RLS(Row Level Security) 정책
- ✅ 모든 테이블 데이터 (products, orders, accounts, profiles 등)
- ✅ Auth 사용자 계정 (`auth.users`, `auth.identities`)

### ⚠️ 주의

```
┌─────────────────────────────────────────────────────────┐
│  기존 사용자의 로그인 세션(JWT 토큰)은 이전 후 무효화됩니다.   │
│  사용자들은 이전 완료 후 다시 로그인해야 합니다.              │
│  비밀번호 자체는 그대로 유지되므로 재설정은 불필요합니다.       │
└─────────────────────────────────────────────────────────┘
```

---

## 전체 작업 흐름

```
[0단계] 사전 준비
    └─ npm install, 폴더 생성, DB 비밀번호 확인, Docker 실행 확인

[1단계] Supabase CLI 로그인 및 소스 프로젝트 연결
    ├─ npx supabase login  (브라우저 인증)
    └─ npx supabase link   (소스 프로젝트 연결)

[2단계] 소스 DB 내보내기 (Export)
    ├─ public 스키마 덤프 (구조 + RLS)
    ├─ public 데이터 덤프
    └─ auth 사용자 데이터 덤프

[3단계] 대상 DB에 가져오기 (Import)
    ├─ 방법 A: Supabase 대시보드 SQL Editor (권장)
    └─ 방법 B: CLI --db-url 방식 (파일이 클 경우)

[4단계] 대상 프로젝트 링크 전환 및 데이터 검증

[5단계] Supabase 대시보드 설정 재구성
    └─ Auth URL, 이메일 설정

[6단계] .env.local 업데이트 및 로컬 테스트

[7단계] Vercel 환경변수 업데이트 및 재배포
```

---

## 0단계: 사전 준비

### 0-1. npm install

```bash
cd D:\dev\dalbus
npm install
```

설치 확인:
```bash
npx supabase --version
# 출력 예시: 2.76.9
```

### 0-2. 출력 파일 저장 폴더 생성

```bash
mkdir supabase-migration
echo "supabase-migration/" >> .gitignore
```

> ⚠️ `supabase-migration/` 폴더에는 비밀번호 해시 등 민감한 정보가 담기므로 `.gitignore`에 반드시 추가합니다.

### 0-3. DB 비밀번호 확인 (양쪽 프로젝트 모두)

> DB 비밀번호는 Supabase 로그인 비밀번호와 **다른 별도의 값**입니다.

1. [app.supabase.com](https://app.supabase.com) 로그인
2. 해당 프로젝트 선택 → **Settings** → **Database**
3. "Database password" 확인 (모르면 "Reset database password"로 재설정)

```
소스 DB 비밀번호 (dalbus, 인도):          __________________
대상 DB 비밀번호 (dalbus-us-north, 미국): __________________
```

### 0-4. Docker Desktop 실행 확인

시스템 트레이(화면 우측 하단)에 **고래 아이콘** 🐳 이 있으면 준비 완료.

> `supabase db dump`는 Docker 컨테이너 안에서 pg_dump를 실행합니다. Docker Desktop이 실행 중이어야만 동작합니다.

---

## 1단계: Supabase CLI 로그인 및 소스 프로젝트 연결

### 1-1. Supabase 로그인

```bash
npx supabase login
```

브라우저가 자동으로 열리면 Supabase 계정으로 로그인합니다.
완료 후 터미널에 `Token saved to ...` 메시지 확인.

### 1-2. 소스 프로젝트 연결 (Link)

```bash
npx supabase link --project-ref axfopkixhvqqfpilljlk
```

DB 비밀번호 입력 프롬프트:
```
Enter your database password (or leave blank to skip):
```

**소스(dalbus, 인도) DB 비밀번호** 입력 → `Finished supabase link.` 확인

연결 확인:
```bash
npx supabase projects list
```

```
# 출력 예시
    REGION    |   ORG ID    |       REF ID             |      NAME       |    STATUS
 ap-south-1   | [org-id]    | axfopkixhvqqfpilljlk    | dalbus          | ACTIVE_HEALTHY
 us-east-1    | [org-id]    | etfoluotiejftyqbourd    | dalbus-us-north | ACTIVE_HEALTHY
```

> 💡 `npx supabase status`는 로컬 Docker 컨테이너 상태 확인 명령으로, 리모트 연결 확인과는 다릅니다.
> 연결 확인에는 항상 `projects list`를 사용하세요.

---

## 2단계: 소스 DB 내보내기 (Export)

> 📁 모든 명령어는 달버스 프로젝트 루트(`D:\dev\dalbus`)에서 실행합니다.

### 2-1. Public 스키마 구조 내보내기

테이블 구조, 인덱스, 제약조건, 열거형, 함수, 트리거, RLS 정책이 모두 포함됩니다.

```bash
npx supabase db dump -f supabase-migration/public_schema.sql
```

```
Dumping schemas from remote database...
Write to supabase-migration/public_schema.sql...
```

### 2-2. Public 데이터 내보내기

```bash
npx supabase db dump --data-only -f supabase-migration/public_data.sql
```

> `--data-only`: 테이블 구조 제외, 실제 데이터(INSERT 구문)만 내보냄

### 2-3. Auth 사용자 데이터 내보내기

Auth 스키마에는 사용자 계정, 비밀번호 해시, OAuth 연동 정보 등이 포함됩니다.

```bash
npx supabase db dump --schema auth --data-only -f supabase-migration/auth_data.sql
```

### 2-4. 내보낸 파일 확인

```bash
# Windows PowerShell
Get-ChildItem supabase-migration/ | Select-Object Name, @{N='Size(KB)';E={[math]::Round($_.Length/1KB,1)}}

# Mac / Linux / Git Bash
ls -lh supabase-migration/
```

**예상 결과 (파일 3개):**
```
public_schema.sql    → 수십~수백 KB
public_data.sql      → 수 KB ~ 수 MB (데이터 양에 따라 다름)
auth_data.sql        → 수 KB (사용자 수에 따라 다름)
```

> ⚠️ 파일 크기가 0 bytes라면 덤프 중 오류가 발생한 것입니다. 파일을 열어 내용을 확인하세요.

---

## 3단계: 대상 DB에 가져오기 (Import)

두 가지 방법 중 선택합니다. **방법 A가 권장**입니다.

---

### 방법 A: Supabase 대시보드 SQL Editor (권장)

추가 도구 설치 없이 웹 브라우저만으로 진행합니다.

**A-1. Public 스키마 적용**

1. [app.supabase.com](https://app.supabase.com) → **`dalbus-us-north`** 프로젝트 선택
2. 좌측 사이드바 → **SQL Editor** → **New query**
3. `supabase-migration/public_schema.sql` 파일 전체 내용 붙여넣기
4. **Run** 클릭 (또는 `Ctrl+Enter`)

> ✅ `ERROR: extension "xxx" already exists` 오류는 무시해도 됩니다.

**A-2. Public 데이터 적용**

1. **New query** 클릭 (새 탭)
2. `supabase-migration/public_data.sql` 전체 붙여넣기 → Run

**A-3. Auth 사용자 데이터 적용**

auth 스키마에 직접 INSERT하므로 트리거 비활성화가 필요합니다.

1. **New query** 클릭
2. 아래 형식으로 작성:

```sql
-- auth 트리거 일시 비활성화
SET session_replication_role = replica;

-- [여기에 auth_data.sql 파일 내용 전체 붙여넣기]

-- 트리거 복원
SET session_replication_role = DEFAULT;
```

3. **Run** 클릭

**A-4. 대용량 파일 처리 (SQL Editor 크기 제한 초과 시)**

파일 크기 확인:
```bash
# Windows PowerShell
"{0:N1} MB" -f ((Get-Item supabase-migration/public_data.sql).Length / 1MB)

# Mac / Linux
du -sh supabase-migration/public_data.sql
```

2MB 초과 시 → 방법 B 사용

---

### 방법 B: CLI --db-url 방식 (대용량 파일)

**B-1. Public 스키마 적용**

```bash
npx supabase db execute \
  --db-url "postgresql://postgres:[대상_DB_비밀번호]@db.etfoluotiejftyqbourd.supabase.co:5432/postgres" \
  -f supabase-migration/public_schema.sql
```

**B-2. Public 데이터 적용**

```bash
npx supabase db execute \
  --db-url "postgresql://postgres:[대상_DB_비밀번호]@db.etfoluotiejftyqbourd.supabase.co:5432/postgres" \
  -f supabase-migration/public_data.sql
```

**B-3. Auth 사용자 데이터 적용**

래퍼 파일 생성:
```bash
# Windows PowerShell
$header = "SET session_replication_role = replica;"
$footer = "SET session_replication_role = DEFAULT;"
$body = Get-Content supabase-migration/auth_data.sql -Raw
"$header`n$body`n$footer" | Set-Content supabase-migration/auth_data_wrapped.sql

# Mac / Linux / Git Bash
{
  echo "SET session_replication_role = replica;"
  cat supabase-migration/auth_data.sql
  echo "SET session_replication_role = DEFAULT;"
} > supabase-migration/auth_data_wrapped.sql
```

```bash
npx supabase db execute \
  --db-url "postgresql://postgres:[대상_DB_비밀번호]@db.etfoluotiejftyqbourd.supabase.co:5432/postgres" \
  -f supabase-migration/auth_data_wrapped.sql
```

---

## 4단계: 대상 프로젝트 링크 전환 및 데이터 검증

### 4-1. 대상 프로젝트로 링크 전환

```bash
npx supabase link --project-ref etfoluotiejftyqbourd
```

대상(미국) DB 비밀번호 입력 → `Finished supabase link.` 확인

### 4-2. 데이터 건수 검증

**소스(dalbus)**와 **대상(dalbus-us-north)** 양쪽 SQL Editor에서 실행하여 건수 비교:

```sql
SELECT '① auth.users'     AS 테이블, COUNT(*) AS 건수 FROM auth.users
UNION ALL
SELECT '② profiles'       AS 테이블, COUNT(*) AS 건수 FROM public.profiles
UNION ALL
SELECT '③ products'       AS 테이블, COUNT(*) AS 건수 FROM public.products
UNION ALL
SELECT '④ product_plans'  AS 테이블, COUNT(*) AS 건수 FROM public.product_plans
UNION ALL
SELECT '⑤ accounts'       AS 테이블, COUNT(*) AS 건수 FROM public.accounts
UNION ALL
SELECT '⑥ orders'         AS 테이블, COUNT(*) AS 건수 FROM public.orders
UNION ALL
SELECT '⑦ order_accounts' AS 테이블, COUNT(*) AS 건수 FROM public.order_accounts
UNION ALL
SELECT '⑧ site_settings'  AS 테이블, COUNT(*) AS 건수 FROM public.site_settings
ORDER BY 테이블;
```

**모든 건수가 소스 = 대상으로 일치해야 합니다.**

### 4-3. RLS 정책 확인

```sql
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### 4-4. 핵심 함수 확인

```sql
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;
```

`generate_order_number` 함수가 목록에 있어야 합니다.

---

## 5단계: Supabase 대시보드 설정 재구성

> [app.supabase.com](https://app.supabase.com) 에서 **`dalbus-us-north` 프로젝트**를 선택한 상태에서 진행합니다.

### 5-1. Auth URL 설정

1. **Authentication** → **URL Configuration**
2. 아래 값 입력 후 **Save**:

| 항목 | 입력값 |
|------|--------|
| **Site URL** | `https://dalbus.vercel.app` (실제 운영 도메인) |
| **Redirect URLs** | `https://dalbus.vercel.app/**` |
| **Redirect URLs** | `http://localhost:3000/**` (로컬 개발용) |

### 5-2. site_settings 데이터 확인

```sql
SELECT key, value FROM site_settings ORDER BY key;
```

`admin_email` 등 운영 설정이 소스와 동일한지 확인합니다.

---

## 6단계: .env.local 업데이트 및 로컬 테스트

### 6-1. 현재 .env.local 백업

```bash
# Windows PowerShell
Copy-Item .env.local .env.local.backup_india

# Mac / Linux / Git Bash
cp .env.local .env.local.backup_india
```

### 6-2. 대상 프로젝트 API 키 확인

[app.supabase.com](https://app.supabase.com) → `dalbus-us-north` → **Settings** → **API**

| 항목 | 위치 |
|------|------|
| Project URL | "Project URL" 복사 |
| anon public key | "anon public" 복사 |
| service_role key | "service_role" 클릭하여 표시 후 복사 |

### 6-3. .env.local 수정

```env
NEXT_PUBLIC_SUPABASE_URL=https://etfoluotiejftyqbourd.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[대상_ANON_KEY]
SUPABASE_SERVICE_ROLE_KEY=[대상_SERVICE_ROLE_KEY]

# 변경 불필요
RESEND_API_KEY=[기존값_그대로]
```

### 6-4. 로컬 테스트

```bash
npm run dev
```

`http://localhost:3000` 접속 후 체크:

```
□ 랜딩 페이지 정상 로드
□ 기존 계정으로 로그인 성공 (이전된 비밀번호 그대로 사용 가능)
□ 마이페이지에서 구독 정보 및 계정 정보 확인
□ 어드민 로그인 후 주문 목록 확인
□ 어드민 Tidal 계정 목록 확인
□ npm run build 성공
```

---

## 7단계: Vercel 환경변수 업데이트 및 재배포

1. [vercel.com](https://vercel.com) → 프로젝트 → **Settings** → **Environment Variables**
2. 아래 3개 변수를 대상 프로젝트 값으로 수정:

| 변수명 | 새 값 |
|--------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://etfoluotiejftyqbourd.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 대상 anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | 대상 service_role key |

3. **Deployments** → 최신 배포 → **⋯** → **Redeploy**

---

## 작업 완료 후 정리

### 덤프 파일 삭제 (보안 필수)

```bash
# Windows PowerShell
Remove-Item -Recurse -Force supabase-migration/

# Mac / Linux / Git Bash
rm -rf supabase-migration/
```

### 환경별 .env 파일 관리

```bash
# 현재 .env.local (미국 환경) 별도 저장
cp .env.local .env.local.us
echo ".env.local.us" >> .gitignore
echo ".env.local.backup_india" >> .gitignore
```

**환경 전환:**
```bash
# 미국 환경 (신규)으로 전환
cp .env.local.us .env.local

# 인도 환경 (기존)으로 되돌리기
cp .env.local.backup_india .env.local

# 전환 후 개발 서버 재시작
npm run dev
```

---

## 전체 완료 체크리스트

```
[0단계 사전 준비]
□ npm install 완료
□ supabase-migration/ 폴더 생성 및 .gitignore 추가
□ 양쪽 DB 비밀번호 확인
□ Docker Desktop 실행 중 확인 (트레이 고래 아이콘)

[1단계 로그인 및 링크]
□ npx supabase login 완료 (브라우저 인증)
□ npx supabase link --project-ref axfopkixhvqqfpilljlk 완료

[2단계 Export]
□ public_schema.sql 생성 완료
□ public_data.sql 생성 완료
□ auth_data.sql 생성 완료
□ 3개 파일 모두 0 bytes가 아닌지 확인

[3단계 Import]
□ 대상 DB에 public_schema.sql 적용 완료
□ 대상 DB에 public_data.sql 적용 완료
□ 대상 DB에 auth_data.sql 적용 완료 (replica 모드 포함)

[4단계 검증]
□ npx supabase link --project-ref etfoluotiejftyqbourd 완료
□ 데이터 건수 쿼리: 소스 = 대상 일치
□ RLS 정책 목록 일치
□ generate_order_number 함수 존재 확인

[5단계 대시보드 설정]
□ Authentication > URL Configuration 설정 완료
□ site_settings 데이터 확인 완료

[6단계 로컬 테스트]
□ .env.local 백업 완료
□ .env.local 대상 프로젝트 값으로 업데이트
□ npm run dev 후 로그인 성공
□ npm run build 성공

[7단계 Vercel 배포]
□ Vercel 환경변수 3개 업데이트 완료
□ Vercel 재배포 완료

[최종 정리]
□ supabase-migration/ 폴더 삭제 완료
□ .env.local.us 파일 보관
□ .gitignore에 환경 파일 추가 확인
```

---

## 트러블슈팅

### 문제 1: `supabase: command not found`
```bash
npm install
npx supabase --version
```

### 문제 2: `supabase link` 실패 - 비밀번호 오류
Supabase 대시보드 → Settings → Database → "Reset database password" 후 재시도

### 문제 3: SQL Editor에서 `ERROR: type "xxx" already exists`
대상 DB에 기존 스키마가 있는 경우. SQL Editor에서 실행 후 재시도:
```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO postgres;
```

### 문제 4: auth 데이터 삽입 시 `violates foreign key constraint`
`SET session_replication_role = replica;` 구문을 auth_data.sql 앞에 반드시 추가

### 문제 5: `supabase db dump` Docker 오류
```
failed to inspect docker image: error during connect: ...
```
Docker Desktop이 실행 중인지 확인 (시스템 트레이 고래 아이콘).
실행 중이 아니면 Docker Desktop을 시작한 후 재시도.

현재 로그인 상태 확인:
```bash
npx supabase projects list
```

> ⚠️ `npx supabase status`는 로컬 Docker 컨테이너용 명령입니다. 리모트 연결 확인에는 사용하지 마세요.

### 문제 6: `supabase db execute` 명령어를 찾을 수 없음
```bash
npm install supabase@latest --save-dev
```

### 문제 7: `supabase db push` 시 비밀번호 오류
```bash
npx supabase link --project-ref etfoluotiejftyqbourd
npx supabase db push
```

---

## 이전 후 환경 변수 참조표

| 환경 | 파일 | SUPABASE_URL |
|------|------|-------------|
| 인도 (기존) | `.env.local.backup_india` | `https://axfopkixhvqqfpilljlk.supabase.co` |
| 미국 (신규) | `.env.local.us` | `https://etfoluotiejftyqbourd.supabase.co` |

> **전환 방법**: 원하는 환경의 파일을 `.env.local`로 복사 → `npm run dev` 재시작
