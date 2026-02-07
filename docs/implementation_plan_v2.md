# [Dalbus v2.0] Implementation Plan

## Overview
This plan outlines the steps to upgrade the Dalbus project to match the **v2.0 Documentation** (`prd.md`, `techspec.md`, `screen_spec.md`). The upgrade involves a complete database schema overhaul and a Next.js App Router structural refactor.

---

## 1. Database Migration (Supabase)

### Objective
Transition from the v1 `services` schema to the v2 `products/plans/orders` schema.

### Action Items
- [ ] **Run Migration Script**: Execute `supabase_migration_v2.sql` in the Supabase SQL Editor.
  - **Note**: This will DROP existing tables (`services`, `shared_accounts`, `orders`). Ensure no critical production data exists.
- [ ] **Verify Schema**: Check for presence of `products`, `product_plans`, `accounts`, `notices`, `faqs`.
- [ ] **Disable Email Confirmation**: In Supabase Auth Settings, keep "Confirm email" **OFF** for smooth dev testing.

---

## 2. Project Structure Refactor

### Objective
Adopt the Route Group pattern `(public)`, `(auth)`, `(protected)` defined in `techspec.md`.

### File Moves & Creations

#### 2.1 Public Routes `(public)`
- `app/page.tsx` → `app/(public)/page.tsx`
- New: `app/(public)/products/page.tsx` (Service List)
- New: `app/(public)/products/[slug]/page.tsx` (Service Detail)
- New: `app/(public)/notices/` & `app/(public)/faq/`

#### 2.2 Auth Routes `(auth)`
- `app/login/page.tsx` → `app/(auth)/login/page.tsx`
- `app/signup/page.tsx` → `app/(auth)/signup/page.tsx`
- New: `app/(auth)/reset-password/`

#### 2.3 Protected Routes `(protected)`
- `app/mypage/page.tsx` → `app/(protected)/mypage/page.tsx`
- `app/service/[id]/` (Old Ordering Logic) → **Refactor into `app/(public)/products/[slug]/` + `app/(protected)/orders/`**
- `app/admin/` → `app/(protected)/admin/` (Ensure check for `admin` role)

#### 2.4 Lib & Components
- Update `lib/supabase.ts` to `lib/supabase/client.ts`, `server.ts`.
- Create `types/database.ts` (or generate via Supabase CLI).

---

## 3. Feature Implementation Phases

### Phase 3.1: Core Infrastructure
- [ ] Apply new Folder Structure.
- [ ] Update `middleware.ts` to protect `(protected)` routes and redirect unauthenticated users.
- [ ] Create `types/index.ts` matching the new DB schema.

### Phase 3.2: Public & Auth Features
- [ ] Update **Landing Page** (`SCR_LAND_001`) with new design and data fetching from `products`.
- [ ] Update **Product List/Detail** to fetch from `products` & `product_plans`.
- [ ] Verify **Login/Signup** works with the new `profiles` table trigger.

### Phase 3.3: Ordering & Payment
- [ ] Implement **PortOne V2 SDK** in `app/(protected)/payment/`.
- [ ] Create API Route `api/payment/webhook` to handle verification and `orders` insertion.

### Phase 3.4: My Page & Admin
- [ ] Update **My Page** to fetch from `orders` linked to `accounts`.
- [ ] Build **Admin Dashboard** (`SCR_ADM_xxx`) for managing `products` and `accounts`.

---

## 4. Execution Step-by-Step

1. **User Action**: Run `supabase_migration_v2.sql` in Supabase.
2. **Dev Action**: Move files to `app/(public)`, `(auth)`, `(protected)`.
3. **Dev Action**: Fix import paths and `globals.css` references.
4. **Dev Action**: Implement `products` fetching in Landing page.
5. **Verification**: Check if Landing page loads real data from Supabase.
