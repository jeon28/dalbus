# Dalbus (달버스) - 프리미엄 서비스 매칭 플랫폼

Dalbus는 Tidal과 같은 프리미엄 OTT 및 스트리밍 서비스의 구독료를 절감하기 위해 사용자들을 매칭해주는 플랫폼입니다. 현대적인 Glassmorphism 디자인과 모바일 퍼스트 전략을 사용하여 프리미엄한 사용자 경험을 제공합니다.

---

## 1. 설치법 (Installation)

이 프로젝트는 **Next.js 15**를 기반으로 작성되었습니다. 로컬 환경에서 개발을 시작하려면 아래 단계를 따르세요.

1. **저장소 클론 및 이동**
   ```bash
   git clone <repository-url>
   cd dalbus
   ```

2. **의존성 패키지 설치**
   `npm`을 사용하여 필요한 패키지들을 설치합니다.
   ```bash
   npm install
   ```

---

## 1.5. 사전 준비 사항 (Pre-requisites)

서비스 운영 및 개발을 위해 아래 외부 서비스 계정 및 설정이 필요합니다.

### 1) Supabase (Database)
- [Supabase](https://supabase.com/) 계정 생성 및 새 프로젝트를 생성합니다.
- 프로젝트 설정에서 **Project URL**과 **API Key (anon/public)**를 확인합니다.
- 기술 명세서(`docs/techspec.md`)의 데이터 구조를 참고하여 테이블을 생성합니다.

### 2) 외부 서비스 (API)
- **포트원 (PortOne)**: 결제 및 본인인증 연동을 위해 가입 후 API 키를 발급받아야 합니다.
- **솔라피 (Solapi)**: 알림톡(카카오톡) 전송을 위해 계정 생성 및 발송용 API 키가 필요합니다.

### 3) 환경 변수 설정
프로젝트 루트에 `.env.local` 파일을 생성하고 아래 정보를 입력합니다.
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
PORTONE_API_KEY=your_portone_key
SOLAPI_API_KEY=your_solapi_key
```

---

## 2. 실행법 (Getting Started)

설치가 완료되면 아래 명령어들로 프로젝트를 실행하거나 빌드할 수 있습니다.

- **개발 서버 실행** (소스 변경 시 실시간 반영):
  ```bash
  npm run dev
  ```
  실행 후 브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다.

- **프로젝트 빌드**:
  ```bash
  npm run build
  ```

- **프로덕션 서버 실행**:
  ```bash
  npm start
  ```

---

## 3. 디렉토리 및 소스 설명 (Directory Structure)

프로젝트는 Next.js의 **App Router** 구조를 따르고 있습니다.

```text
dalbus/
├── app/                # Next.js App Router용 페이지 및 레이아웃
│   ├── admin/          # 관리자 대시보드 (주문 관리, 가격 설정)
│   ├── login/          # 로그인 페이지
│   ├── signup/         # 회원가입 페이지
│   ├── mypage/         # 마이페이지 (구독 정보 및 계정 확인)
│   ├── service/[id]/   # 서비스 상세 및 구독 신청 페이지
│   ├── globals.css     # 전역 스타일링 (디자인 시스템 정의)
│   ├── layout.tsx      # 루트 레이아웃 (ServiceProvider 포함)
│   └── page.tsx        # 메인 홈 페이지
├── lib/                # 공통 라이브러리 및 컨텍스트
│   └── ServiceContext.tsx # 전역 상태 관리 (서비스 정보, 유저 인증)
├── public/             # 이미지, 아이콘 등 정적 자산
├── docs/               # 기획 및 기술 명세서 (PRD, 기술 제안서 등)
├── package.json        # 프로젝트 의존성 및 스크립트 설정
└── tsconfig.json       # TypeScript 설정
```

---

## 4. 사용법 (Usage)

### 사용자 (User) Flow
1. **홈 화면**: 현재 이용 가능한 서비스(예: Tidal)를 확인합니다.
2. **구독 신청**: 원하는 서비스를 선택하고 이용 기간(1개월/3개월)을 선택한 뒤 결제를 진행합니다. (현재 시뮬레이션 모드)
3. **마이페이지**: 결제 완료 후 배정된 공유 계정의 ID와 비밀번호를 확인하여 해당 서비스를 이용합니다.

### 관리자 (Admin) Flow
1. **대시보드**: `/admin` 경로로 접속하여 신규 주문 현황과 매출 통계를 확인합니다.
2. **가격 관리**: 서비스별 이용료를 실시간으로 조정하고 저장할 수 있습니다.
3. **계정 배정**: 신규 주문 고객에게 공유 계정 정보를 입력하고 매칭을 완료합니다.

---

## 5. 배포 가이드 (Deployment)

[Vercel](https://vercel.com/)을 사용하여 가장 간편하게 배포할 수 있습니다.

### Vercel 배포 단계
1. **GitHub 저장소 준비**: 먼저 프로젝트를 본인의 GitHub **Private Repository**로 푸시합니다.
2. **Vercel 프로젝트 생성**:
   - Vercel 대시보드에서 `New Project`를 클릭합니다.
   - **Git Scope**: GitHub 계정 또는 조직(Organization)을 선택합니다.
   - **Import Project**: 방금 생성한 Private Repository를 선택합니다.
3. **설정 구성 (Configure Project)**:
   - **Project Name**: Vercel에서 사용할 프로젝트 이름을 입력합니다.
   - **Framework Preset**: `Next.js`가 자동으로 감지됩니다.
4. **환경 변수 설정 (Environment Variables)**:
   - 사전 준비 사항(`1.5절`)에서 설정한 환경 변수들을 Vercel 설정 화면에 하나씩 등록합니다.
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 등.
5. **Deploy**: `Deploy` 버튼을 누르면 자동으로 빌드 및 배포가 완료됩니다.

---

## 주요 기술 스택 (Tech Stack)

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: CSS Modules, Glassmorphism UI
- **State Management**: React Context API
- **Design Principles**: Mobile-First, Responsive Design
