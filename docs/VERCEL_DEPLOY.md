# Vercel 배포 상세 가이드 (Dalbus)

이 문서는 Dalbus 프로젝트를 Vercel에 배포하고 운영하는 과정을 상세히 설명합니다.

---

## 1. 사전 준비 (Prerequisites)

- **GitHub 계정**: 프로젝트 소스 코드가 GitHub 저장소에 업로드되어 있어야 합니다.
- **Vercel 계정**: [Vercel](https://vercel.com/)에 가입하고 GitHub 계정을 연동해야 합니다.
- **환경 변수**: Supabase URL과 API Key가 필요합니다.

---

## 2. 배포 단계 (Step-by-Step)

### Step 1: 프로젝트 가져오기 (Import)
1. Vercel 대시보드에서 **[Add New...]** -> **[Project]**를 클릭합니다.
2. GitHub 저장소 목록에서 `dalbus` 저장소를 찾아 **[Import]** 버튼을 누릅니다.
   - 저장소가 보이지 않는다면 상단의 **"Git Scope"**가 본인의 계정으로 설정되어 있는지 확인하세요.

### Step 2: 프로젝트 설정 (Configure)
1. **Project Name**: 기본값(`dalbus`)을 유지하거나 원하는 이름을 입력합니다.
2. **Framework Preset**: `Next.js`가 자동으로 선택되어야 합니다.
3. **Root Directory**: `./` (기본값)로 설정되어 있는지 확인합니다. 만약 파일이 폴더 안에 있다면 해당 폴더를 지정해야 하지만, 현재 우리 프로젝트는 루트에 파일이 있으므로 비워둡니다.

### Step 3: 환경 변수 등록 (CRITICAL)
배포 시 가장 중요한 단계입니다. **이 설정을 빠뜨리면 빌드 오류가 발생하거나 기능이 작동하지 않습니다.**

1. [Settings] -> [Environment Variables] 메뉴로 이동합니다.
2. 다음 필수 변수들을 추가합니다:
   - `NEXT_PUBLIC_SUPABASE_URL`: Supabase 프로젝트 URL (Project Settings > API)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase `anon` `public` API Key
   - `RESEND_API_KEY`: 관리자 주문 알림 메일 발송용 API Key (**오늘 추가됨**)
   - `NEXT_PUBLIC_SITE_URL`: 사이트 실 주소 (예: `https://dalbus.vercel.app`)
3. (선택 사항) 외부 연동 시 추가:
   - `PORTONE_API_KEY`: 포트원 결제 연동 시
   - `SOLAPI_API_KEY`: 솔라피 SMS 연동 시

### Step 4: Supabase 통합 설정 (Supabase Integration)
Vercel 대시보드 상단에서도 Supabase와 상호 연동을 설정할 수 있습니다.
1. [Integrations] 탭에서 **Supabase**를 검색하여 추가합니다.
2. 배포된 프로젝트와 Supabase 프로젝트를 연결하면 환경 변수가 자동으로 동기화되어 관리가 편리해집니다.

### Step 4: 배포 실행 (Deploy)
1. **[Deploy]** 버튼을 클릭합니다.
2. 빌드 로그를 확인하며 "Congratulations!" 메시지가 뜰 때까지 기다립니다.

---

## 3. 배포 후 관리 및 실행

### 사이트 접속
- 배포가 완료되면 Vercel이 `https://dalbus.vercel.app`과 같은 고유 URL을 제공합니다. 
- 이 주소로 접속하면 전 세계 어디서든 서비스를 이용할 수 있습니다.

### 자동 배포 (CI/CD)
- 로컬에서 코드를 수정하고 `git push origin main`을 실행하면, Vercel이 이를 자동으로 감지하여 **새로운 버전을 즉시 배포**합니다. 별도의 명령어를 서버에서 실행할 필요가 없습니다.

---

## 4. 자주 발생하는 오류 및 해결 방법

### ❌ 빌드 실패 (Lint Errors)
- **증상**: `next build` 과정에서 `ESLint` 오류로 인해 중단됨.
- **원인**: 사용하지 않는 변수, `any` 타입 사용, `next/image` 대신 일반 `<img>` 태그 사용 등.
- **해결**: 
  - 로컬에서 `npm run lint`를 실행하여 모든 오류를 수정하세요.
  - 특히 `any` 타입은 `@typescript-eslint/no-explicit-any` 오류를 유발하므로 적절한 인터페이스를 정의하거나 불가피한 경우 `// eslint-disable-next-line` 주석을 추가하세요.
  - 외부 이미지는 반드시 `next/image` 컴포넌트를 사용하고, `next.config.ts`의 `images.remotePatterns`에 도메인을 등록해야 합니다.

### ❌ "supabaseUrl is required" 에러
- **증상**: 런타임 또는 빌드 중 Supabase 클라이언트 초기화 실패.
- **원인**: `NEXT_PUBLIC_SUPABASE_URL` 환경 변수 누락.
- **해결**: Vercel 설정에서 환경 변수를 확인하고, 오타가 없는지 체크한 후 다시 배포하세요.

### ❌ 주문 후 알림 메일이 오지 않을 때
- **증상**: 주문은 생성되지만 관리자에게 이메일이 가지 않음.
- **원인**: `RESEND_API_KEY`가 설정되지 않았거나 유효하지 않음.
- **해결**: Resend API 키를 확인하고, `site_settings` 테이블의 `admin_email` 필드가 올바르게 설정되어 있는지 체크하세요.

### ❌ API Route (405 Method Not Allowed / 500 Internal Server Error)
- **증상**: `/api/orders` 호출 시 오류 발생.
- **원인**: 서버 측 환경 변수 접근 권한 문제 또는 오타.
- **해결**: Vercel 프로젝트 설정의 환경 변수 범위(Environment Scope)가 `Production`, `Preview`, `Development` 모두에 체크되어 있는지 확인하세요.

### ❌ 회원가입은 되는데 DB(`profiles`)에 데이터가 안 들어올 때
- **원인**: Supabase의 **Email Confirmation**이 켜져 있으면 인증 전까지 RLS 권한이 제한됩니다.
- **해결**: [Authentication] -> [Settings]에서 **"Confirm email"**을 **OFF**로 설정하거나, 사용자가 이메일 인증을 완료하도록 유도하세요.

### ❌ SQL 스키마 불일치 (최신 기능 미작동)
- **증상**: 특정 필드(예: `tidal_id`, `admin_email`)가 없다는 오류 발생.
- **원인**: Supabase에 최신 마이그레이션 파일이 적용되지 않음.
- **해결**: `supabase/migrations` 폴더의 최신 `.sql` 파일들을 Supabase SQL Editor에서 실행하여 스키마를 동기화하세요. (**v0.91 기준 017번까지 완료되어야 함**)

---

## 5. 유용한 팁
- **Custom Domain**: 본인이 소유한 도메인(예: `dalbus.com`)이 있다면 Vercel [Settings] -> [Domains] 메뉴에서 연결할 수 있습니다.
- **Logs**: 서비스 운영 중 발생하는 에러는 Vercel 대시보드의 [Logs] 탭에서 실시간으로 확인할 수 있습니다.
