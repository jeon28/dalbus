# [Dalbus v2.0] Implementation Master Plan
This plan details the step-by-step execution to upgrade Dalbus to v2.0, adhering to `techspec.md` and `prd.md`.

## Phase 1: Database & Environment Setup
- [ ] **Environment Variables**: Verify `.env.local` contains all keys from `techspec.md` Section 3.2.
- [ ] **Database Migration**:
    - [ ] Create `supabase/migrations/001_create_tables.sql` with schema from `techspec.md`.
    - [ ] Create `supabase/migrations/002_rls_policies.sql` with RLS policies.
    - [ ] Run migrations in Supabase SQL Editor.
    - [ ] Verify tables: `profiles`, `products`, `product_plans`, `orders`, `accounts`, etc.
- [ ] **Types Generation**:
    - [ ] Generate or manually create `types/database.ts` reflecting the new schema.
    - [ ] Create `types/index.ts` for domain models.

## Phase 2: Project Structure Refactor (Current State: Partially Done)
- [ ] **Public Routes** `app/(public)`:
    - [ ] `page.tsx` (Landing) - Ensure it uses new components.
    - [ ] `products/page.tsx` (List) - Create if missing.
    - [ ] `products/[slug]/page.tsx` (Detail) - Create if missing.
    - [ ] `notices/page.tsx` & `faq/page.tsx` - Create placeholders.
- [ ] **Auth Routes** `app/(auth)`:
    - [ ] `login/page.tsx` - Refactor to use proper form handling.
    - [ ] `signup/page.tsx` - Refactor for new fields (name, phone).
    - [ ] `layout.tsx` - Ensure auth-specific layout (centered box).
- [ ] **Protected Routes** `app/(protected)`:
    - [ ] `mypage/page.tsx` - Dashboard for user subscriptions.
    - [ ] `admin/page.tsx` - Admin dashboard.
    - [ ] `payment/page.tsx` - Payment processing page.
- [ ] **Cleanup**: Remove legacy files in `app/` root (e.g., old `login`, `service` folders) after confirming moves.

## Phase 3: Core Implementation
### 3.1 Shared Components & Libs
- [ ] **Supabase Client**: Ensure `lib/supabase/client.ts` and `server.ts` are correctly implemented for App Router.
- [ ] **UI Components**: Install/Update `shadcn/ui` components (Button, Input, Card, etc.).
- [ ] **Layout Components**:
    - [ ] `components/layout/Header.tsx` (Responsive, Auth handling).
    - [ ] `components/layout/Footer.tsx`.

### 3.2 Feature: Landing & Products
- [ ] **Landing Page**: Fetch active `products` from DB. Display Hero, Pricing, Steps.
- [ ] **Product List**: Grid view of products.
- [ ] **Product Detail**: Fetch product + plans. Select plan -> Go to Payment.

### 3.3 Feature: Authentication
- [ ] **Sign Up**: Register with Email, Password, Name, Phone. Trigger `profiles` creation (via DB trigger).
- [ ] **Login**: Supabase Auth login.
- [ ] **Middleware**: Protect `(protected)` routes. Redirect unauthenticated users to `/login`.

### 3.4 Feature: Payments (PortOne)
- [ ] **Payment Page**: Integrate PortOne SDK.
- [ ] **Payment Webhook**: `api/payment/webhook/route.ts` to handle verification and `orders` creation.

### 3.5 Feature: Admin & My Page
- [ ] **My Page**: Show `orders` and assigned `accounts`.
- [ ] **Admin**: Order management and Account assignment.

## Phase 4: Verification & Launch
- [ ] **Manual Test**: Full user flow (Sign up -> View Product -> Buy -> Check My Page).
- [ ] **Admin Test**: Assign account to order -> Verify SMS/Notification (mocked).
- [ ] **Security Check**: Verify RLS (User cannot see others' orders).

## Current Next Step:
Start with **Phase 1: Database & Environment Setup**.
Then proceed to **Phase 3.1** and **3.2** to get the public site checking against real DB.
