---
name: format_jira_story
description: Jira Story 작성 시 항상 정해진 템플릿과 양식에 맞추어 스토리를 작성합니다.
---

# format_jira_story

이 스킬은 사용자가 Jira Story 작성을 요청할 때, 반드시 지정된 템플릿 규칙에 따라 내용을 구성하도록 강제합니다.

## Jira Story Template

새로운 스토리를 작성하거나 제안할 때는 예외 없이 **아래의 템플릿 구조와 헤딩(Heading)** 을 지켜서 작성하세요.

```markdown
## 1. Summary (요약)
[As a <사용자 역할>, I want to <기능/목적> so that <비즈니스 가치>]

## 2. Description (상세 설명)
- **Background**: 이 기능이 필요한 배경 설명
- **User Scenario**: 사용자가 이 기능을 사용하는 흐름

## 3. Acceptance Criteria (수용 기준)
AI가 구현 여부를 판단할 수 있도록 체크리스트 형태로 작성합니다.
- [ ] 조건 1: ...
- [ ] 조건 2: ...

## 4. Technical Notes / Constraints (기술적 제약)
- API Endpoint: ...
- Data Model: ...
- Security: ...
```

### 📝 Story 작성 예시 참고

```markdown
## 1. Summary (요약)
[As a 서비스 운영자, I want to 대시보드에서 실시간 안전 사고 현황을 확인하여 즉각적인 대응을 하고 싶다]

## 2. Description (상세 설명)
- **Background**: 현재 사고 발생 시 알림은 오지만 전체적인 현황을 한눈에 보기 어려움.
- **User Scenario**: 메인 대시보드 상단에 위젯 형태로 사고 유형별 카운트 표시 필요.

## 3. Acceptance Criteria (수용 기준)
- [ ] 당일 발생한 사고 건수가 실시간으로 업데이트되어야 함.
- [ ] 사고 등급(심각, 보통, 주의)에 따라 색상별로 구분되어야 함.
- [ ] 클릭 시 해당 사고 리스트 페이지로 필터링되어 이동해야 함.

## 4. Technical Notes / Constraints (기술적 제약)
- API Endpoint: Supabase Realtime을 사용하여 데이터 변경 감지.
- Data Model: 기존 `safety_incidents` 테이블의 `severity` 컬럼 참조.
```
