# API 호출 및 안정성 가이드 (Stability Guide)

Next.js 15 환경에서 Supabase 인증과 API 호출 시 발생할 수 있는 **무한 로딩(Infinite Loading)** 및 **인증 교착 상태(Deadlock)**를 방지하기 위한 가이드입니다.

## 1. `apiFetch` 유틸리티 사용 규칙

모든 클라이언트 사이드 API 호출은 전역 `src/lib/api.ts`에 정의된 `apiFetch`를 사용해야 합니다.

### 왜 `apiFetch`인가?
- **XHR 기반**: Next.js 15의 `fetch` 인터셉션 및 캐싱 버그를 피하기 위해 `XMLHttpRequest`를 사용합니다.
- **세션 캐싱**: `getSession()`이 비동기로 무한히 대기하는 현상을 막기 위해 전역적으로 세션을 캐싱합니다.
- **자동 인증**: Supabase JWT를 `Authorization` 헤더에 자동으로 삽입합니다.

### 사용 예시
```typescript
import { apiFetch } from '@/lib/api';

const fetchData = async () => {
  try {
    const data = await apiFetch('/api/admin/some-endpoint');
    // 사용 시 별도의 headers나 Content-Type 설정이 필요 없습니다.
  } catch (error) {
    console.error(error);
  }
};
```

## 2. 무한 루프 방지를 위한 주의사항

### ❌ 피해야 할 패턴: `useEffect` 내부의 원시 `fetch`
`useEffect` 내에서 브라우저 기본 `fetch`를 사용하면서 의존성 배열을 잘못 설정할 경우, Next.js의 캐시 정책과 결합하여 무한 호출이 발생할 수 있습니다.

### ❌ 피해야 할 패턴: 반복적인 `getSession()` 호출
컴포넌트 수준에서 매번 `supabase.auth.getSession()`을 `await` 하면 인증 상태 변경 시마다 컴포넌트가 리렌더링되며 교착 상태에 빠질 수 있습니다.

### ✅ 권장 패턴: 세션 캐시 공유
`apiFetch` 내부에서는 이미 `onAuthStateChange`를 통해 최신 세션을 캐시에 보유하고 있습니다. 컴포넌트에서는 `useServices` 컨텍스트 등을 통해 제공되는 사용자 상태를 활용하세요.

## 3. DB 및 API 에러 처리

### 관리자 대상 친절한 에러 메시지
데이터 무결성(외래 키 제약 등)으로 인해 작업이 실패할 경우, 관리자가 조치할 수 있는 방안을 명확히 제시해야 합니다.
- **예시**: 삭제 실패 시 "주문이 있어 삭제할 수 없습니다" -> "Inactive 상태로 변경하여 판매를 중단하세요"

## 4. 추가 업데이트 가이드
시스템 핵심 인터페이스(Auth, API Core)를 수정할 때는 반드시 `npm run build`를 통해 ESLint 및 타입 체크를 완료한 뒤 커밋해야 합니다. 특히 `any` 타입 사용은 지양하고 구체적인 인터페이스를 정의하십시오.
