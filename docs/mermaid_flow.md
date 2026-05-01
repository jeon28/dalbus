# Dalbus Screen Flow (Mermaid Visualization)

This document provides a visual representation of the Dalbus platform's screen flow using Mermaid diagrams.

## 1. User Order Flow (Member & Guest)

```mermaid
graph TD
    Start((랜딩 페이지)) --> Shop[서비스 목록]
    Shop --> Detail[서비스 상세 / 기간 선택]
    Detail -- "결제하기 클릭" --> AuthCheck{로그인 상태?}
    
    AuthCheck -- "비회원" --> Auth[로그인 / 회원가입]
    Auth --> Detail
    
    AuthCheck -- "회원" --> Pay[결제 진행 / PG 팝업]
    
    Pay -- "결제 성공" --> Success[결제 완료 페이지]
    Pay -- "결제 실패" --> Fail[결제 실패 / 재시도]
    
    Success --> MyPage[마이페이지 이동]
    Fail --> Detail
```

---

## 2. Q&A Process

```mermaid
graph TD
    QA_List[Q&A 목록] --> Write_Btn["문의하기 클릭"]
    Write_Btn --> Write_Page[문의 작성 페이지]
    
    subgraph "작성 유형"
        Write_Page --> Member[회원: 자동 입력]
        Write_Page --> Guest[비회원: 이름/PW 입력]
    end
    
    Member --> Submit[등록하기]
    Guest --> Submit
    Submit --> QA_List
    
    QA_List -- "글 클릭" --> SecretCheck{비밀글?}
    SecretCheck -- "아니오" --> View[내용 조회]
    SecretCheck -- "예" --> AuthCheck{권한 확인}
    
    AuthCheck -- "작성자/관리자" --> View
    AuthCheck -- "비회원 작성자" --> PW_Input[비밀번호 입력]
    PW_Input -- "일치" --> View
    PW_Input -- "비매칭" --> Deny[접근 거부]
    AuthCheck -- "제3자" --> Deny
```

---

## 3. Admin Management Flow

```mermaid
graph TD
    Admin_Home[관리자 대시보드] --> Nav{메뉴 선택}
    
    Nav --> Orders[주문 관리]
    Nav --> Tidal[Tidal 계정 관리]
    Nav --> Services[서비스 관리]
    Nav --> Members[회원 관리]
    Nav --> Board[공지 / FAQ / Q&A]
    Nav --> Settings[운영 설정 / 계좌]
    
    subgraph "주문 관리 Flow"
        Orders --> Filter[필터: Status / 전화번호]
        Filter --> OrderDetail[주문 상세]
        OrderDetail --> Assign[계정 배정]
        Assign -- "배정 완료" --> Email[관리자 이메일 발송]
        Orders --> OrderExport[Excel 다운로드]
    end
    
    subgraph "Tidal 계정 Flow"
        Tidal --> AccList[마스터 계정 목록]
        AccList --> SlotList[슬롯 상세 관리]
        Tidal --> TidalExport[Excel 다운로드]
    end
    
    subgraph "콘텐츠 관리"
        Board --> Notice[공지사항 CRUD]
        Board --> FAQ[FAQ CRUD]
        Board --> Answer[Q&A 답변 작성]
        Notice --> Cat[카테고리 관리]
        FAQ --> Cat
    end
```

---

## 4. Full System Architecture Overview

```mermaid
stateDiagram-v2
    [*] --> Public
    
    state Public {
        [*] --> Landing
        Landing --> ProductList
        ProductList --> ProductDetail
        ProductDetail --> Notice_FAQ
    }
    
    Public --> Auth : 결제 / 로그인 필요
    
    state Auth {
        Login --> Signup
        Signup --> Login
    }
    
    Auth --> Protected : 인증 성공
    
    state Protected {
        state User {
            MyPage
            Checkout
            OrderSuccess
        }
        state Admin {
            Dashboard
            OrderManage
            TidalManage
            ProductManage
            NoticeManage
        }
    }
```
