# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dalbus (달버스) is a premium subscription service matching platform that helps users save money on services like Tidal by sharing subscription costs. Built with Next.js 16, React 19, and Supabase.

**Key Characteristics:**
- Mobile-first design with Glassmorphism UI
- Korean-language platform (all UI text is in Korean)
- B2C subscription matching service
- Admin-managed account assignment workflow
- Email notification system via Resend with template editing (Unlayer)

## Development Commands

### Core Commands
```bash
npm install              # Install dependencies
npm run dev             # Start development server at http://localhost:3000
npm run build           # Build for production
npm start               # Run production build
npm run lint            # Run ESLint
```

### Supabase Migrations
Database schema is managed through numbered SQL migration files in `supabase/migrations/`:
- Files are numbered sequentially (001–029+) or date-prefixed (20260xxx)
- Apply migrations in order via the Supabase SQL Editor
- Legacy root-level SQL files (`supabase_migration_v2.sql`, etc.) are kept for reference only; do NOT re-apply them

## Architecture

### Tech Stack
- **Frontend:** Next.js 16 (App Router), React 19, TypeScript 5
- **Styling:** Tailwind CSS 3 with shadcn/ui components, Glassmorphism design
- **State Management:** React Context API (`ServiceContext`)
- **Database:** Supabase (PostgreSQL with RLS)
- **Authentication:** Supabase Auth
- **Email:** Resend API with Unlayer drag-and-drop template editor
- **UI Components:** Radix UI primitives via shadcn/ui
- **Icons:** Lucide React
- **Excel:** XLSX library (import/export)
- **Dates:** date-fns

### Route Structure (Next.js App Router)

**Route Groups:**
- `(auth)/` - Unauthenticated routes (login, signup)
- `(protected)/` - Protected routes requiring authentication (admin, mypage)
- `api/` - API routes for backend operations

**User-Facing Pages:**
- `/` - Home/landing page (hero, price comparison, reviews, step guide)
- `/service/[id]` - Service detail and subscription purchase
- `/login` - User login (with forgot-password dialog)
- `/signup` - Registration; `/signup/complete` - post-registration
- `/mypage` - User dashboard (subscription info, account credentials)
- `/public/products` - Public product listing
- `/public/faq` - FAQ page
- `/public/notices` - Notices page
- `/public/qna` - Q&A listing; `/public/qna/write` - submit question
- `/public/terms`, `/public/privacy` - Legal pages
- `/public/checkout/success` - Post-order success page
- `/quick/legacy-tidal` - Quick access to legacy-tidal management
- `/quick/legacy-tidal/inactive` - Inactive legacy-tidal accounts

**Admin Pages (`/admin/`):**
- `/admin` - Dashboard
- `/admin/orders` - Order management and account assignment
- `/admin/services`, `/admin/services/new`, `/admin/services/[id]` - Product/plan management
- `/admin/members` - User management
- `/admin/qna` - Q&A management
- `/admin/faqs` - FAQ management
- `/admin/notices` - Notice management
- `/admin/tidal`, `/admin/tidal/inactive` - Tidal account pool
- `/admin/legacy-tidal`, `/admin/legacy-tidal/inactive` - Legacy Tidal account pool
- `/admin/hifitidal`, `/admin/hifitidal/inactive` - HiFi Tidal account pool
- `/admin/email-templates` - Email template management (Unlayer editor)
- `/admin/mail-history` - Email send history

**API Routes (`/api/`):**

| Prefix | Purpose |
|---|---|
| `/api/admin/accounts` | Account CRUD, assignment, bulk import, move between products |
| `/api/admin/assignments` | Assignment CRUD, inactive/deleted views |
| `/api/admin/bank-accounts` | Admin bank account settings |
| `/api/admin/email-templates` | Email template CRUD and test-send |
| `/api/admin/faq-categories` | FAQ category CRUD |
| `/api/admin/faqs` | FAQ CRUD |
| `/api/admin/legacy-tidal` | Legacy Tidal account management |
| `/api/admin/mail-history` | Email send log |
| `/api/admin/members` | User management |
| `/api/admin/notice-categories` | Notice category CRUD |
| `/api/admin/notices` | Notice CRUD |
| `/api/admin/orders` | Order management, assignment, status update |
| `/api/admin/plans` | Product plan CRUD |
| `/api/admin/products` | Product CRUD |
| `/api/admin/qna` | Q&A answer and management |
| `/api/admin/settings` | Admin settings |
| `/api/admin/tidal` | Tidal account management + notifications |
| `/api/auth/*` | check-email, check-guest-email, check-user, guest-signup, login, password-reset |
| `/api/public/*` | Public read endpoints: banks, faqs, notices, products, settings |
| `/api/orders` | Create order; `/api/orders/lookup` - guest order lookup |
| `/api/qna` | Q&A submission and password verification |
| `/api/quick/legacy-tidal` | Quick access legacy-tidal actions |
| `/api/user/mypage` | Authenticated user profile data |
| `/api/diag` | Diagnostics endpoint |

### Global State Management

The application uses React Context (`src/lib/ServiceContext.tsx`) for global state:

**Managed State:**
- `services`: Product list from Supabase `products` table
- `user`: Currently authenticated user
- `isAdmin`: Admin authentication status
- `isHydrated`: Client-side hydration flag (important for SSR)

**Key Methods:**
- `refreshServices()`: Reload product list from database
- `updatePrice(id, newPrice)`: Update product pricing (admin only)
- `login/logout`: User authentication
- `loginAdmin/logoutAdmin`: Admin session management

**Usage Pattern:**
```typescript
import { useServices } from '@/lib/ServiceContext';

const { services, user, isAdmin } = useServices();
```

### Database Schema (Supabase)

**Core Tables:**
- `profiles` - User profiles linked to `auth.users` (includes `birth_date`, `memo`, `signup_method`)
- `products` - Subscription services (Tidal, etc.)
- `product_plans` - Pricing plans (1-month, 3-month variants)
- `accounts` - Shared account pool (login credentials, `deleted` status)
- `orders` - User purchases and subscriptions; supports `order_type` and `related_id` for linked orders
- `order_accounts` - Order-to-account assignment mapping (includes `end_date`, `memo`, `amount`, `period`)
- `notices`, `notice_categories` - Notice management
- `faqs`, `faq_categories` - FAQ management
- `qna` - Customer Q&A with password verification for guests
- `email_templates` - Reusable email templates (Unlayer JSON + HTML)
- `mail_history` - Log of all sent email notifications
- `admin_settings` - Key-value store for admin configuration
- `bank_accounts` - Admin bank account details for payment instructions
- `verification_codes` - Temporary codes for guest order verification
- `legacy_tidal_accounts` - Dedicated table for legacy Tidal accounts

**Key Relationships:**
- `orders.user_id` → `profiles.id`
- `orders.product_id` → `products.id`
- `orders.plan_id` → `product_plans.id`
- `order_accounts` links `orders` ↔ `accounts` (many-to-many)

**Status Enums:**
- `payment_status`: pending, paid, failed, cancelled, refunded, completed
- `assignment_status`: waiting, assigned, expired, replaced
- `account_status`: available, assigned, disabled, deleted
- `user_role`: user, admin

**Row Level Security (RLS):**
- All tables have RLS enabled
- Users can only view/modify their own data
- Admin role has full access (checked via `is_admin()` function)
- Products, plans, notices, and FAQs are publicly readable

**Migration Management:**
- Canonical migrations are in `supabase/migrations/` (37+ numbered files)
- Run in ascending order: `001_create_tables.sql` → latest
- Recent notable migrations:
  - `026_add_memo_to_profiles.sql`
  - `028_add_verification_codes.sql`
  - `029_create_mail_history_table.sql`
  - `20260224_auto_link_guest_orders.sql`
  - `20260329_create_legacy_tidal_account.sql`

### Environment Variables

Required in `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
RESEND_API_KEY=your_resend_api_key
```

**Important:** Environment variables are trimmed in `src/lib/supabase.ts` to handle whitespace issues. All `NEXT_PUBLIC_` variables are accessible client-side; others are server-only.

## Component Architecture

### UI Components (shadcn/ui)
Located in `src/components/ui/`:
- Built on Radix UI primitives
- Styled with Tailwind CSS
- Import as `@/components/ui/*`

### Layout Components
Located in `src/components/layout/`:
- `Header.tsx` - Site navigation header
- `Footer.tsx` - Site footer
- `landing/HeroSection.tsx` - Landing page hero section
- `landing/PriceComparison.tsx` - Price comparison section
- `landing/ReviewCarousel.tsx` - Customer review carousel
- `landing/StepGuide.tsx` - How-to steps guide

### Admin Components
Located in `src/components/admin/`:
- `AdminSidebar.tsx` - Admin navigation sidebar
- `AdminMobileMenu.tsx` - Mobile admin navigation
- `EmailTemplateModal.tsx` - Unlayer-powered email template editor modal
- `LegacyTidalContent.tsx` - Shared UI for legacy-tidal account management pages
- `PasswordGate.tsx` - Password protection wrapper for quick-access pages

### Error Handling
- `src/components/ErrorHandler.tsx` - Global error boundary component

### Styling System
- Global styles: `src/app/globals.css`
- Tailwind config: `tailwind.config.js`
- Design tokens: CSS variables (HSL colors) in globals.css
- Mobile-first responsive breakpoints
- `reactStrictMode: false` in `next.config.mjs` (prevents AbortError on dev HMR)

## Key Development Patterns

### Path Aliases
TypeScript is configured with `@/*` mapping to `src/*`:
```typescript
import { supabase } from '@/lib/supabase';
import { useServices } from '@/lib/ServiceContext';
import Header from '@/components/layout/Header';
```

### Client vs Server Components
- Most pages use `"use client"` directive because they use:
  - `ServiceContext` (React Context)
  - Supabase client authentication
  - Interactive UI components
- API routes run server-side with the admin Supabase client (`supabaseAdmin.ts`)
- Use `supabaseAdmin.ts` in API routes when bypassing RLS is required

### TypeScript Types
- Auto-generated DB types: `src/types/database.ts`
- Custom domain types: `src/types/index.ts` (Product, ProductPlan, Order, Profile, Notice, FAQ, CartItem)
- Pattern: `Database['public']['Tables']['table_name']['Row']`

### Admin Authentication
Admin access uses a simple session-based approach:
- `isAdmin` state in `ServiceContext`
- Protected routes check `isAdmin` before rendering
- Admin layout (`(protected)/admin/layout.tsx`) wraps all admin pages

### Email System
- Email integration via Resend API (`src/lib/email.ts`)
- Templates managed in DB (`email_templates` table) and edited with Unlayer drag-and-drop editor
- `EmailTemplateModal.tsx` renders the Unlayer editor in a dialog
- Sent email history is logged in `mail_history` table
- Test-send endpoint: `POST /api/admin/email-templates/test-send`

### Tidal Account Types
The platform manages three distinct Tidal account categories, each with dedicated routes and UI:

| Type | DB Table | Admin Page | API Prefix |
|---|---|---|---|
| Standard Tidal | `accounts` (product-linked) | `/admin/tidal` | `/api/admin/accounts` |
| Legacy Tidal | `legacy_tidal_accounts` | `/admin/legacy-tidal` | `/api/admin/legacy-tidal` |
| HiFi Tidal | `accounts` (product-linked) | `/admin/hifitidal` | `/api/admin/accounts` |

### Date and Timezone Handling
- All date calculations for expiry use `date-fns` `format()` — do NOT use `.toISOString()` for display dates as it causes 1-day UTC offset errors
- End dates are stored in `order_accounts.end_date`
- Admin pages compute expiry by adding plan duration to a fixed reference `start_date`

### Excel Import/Export
- Uses the `xlsx` (SheetJS) library
- Bulk account import: `POST /api/admin/accounts/import`
- Export features available in admin order and account list pages

### Guest Order Flow
1. Guest submits email and order details
2. Guest-signup API creates a profile or links to existing via `auto_link_guest_orders` DB trigger
3. Verification codes used for guest identity checks (`verification_codes` table)
4. Guest can look up their order at `/api/orders/lookup`

## Business Logic

### Order Flow
1. User (or guest) selects product and plan on `/service/[id]`
2. Order created with `payment_status: 'paid'`, `assignment_status: 'waiting'`
3. Admin manually assigns an account via `/admin/orders`
4. Assignment creates `order_accounts` record and updates `account.used_slots`
5. Account credentials displayed in user's `/mypage`
6. Email notification sent via Resend

### Account Assignment
- Manual process in admin panel
- Admin selects available account from pool
- `order.assignment_status` → 'assigned'
- Links via `order_accounts` table with `end_date`, `amount`, `period`
- `account.used_slots` counter incremented

### Pricing Management
Admins update pricing in real-time:
- Product base price in `products.original_price`
- Plan-specific pricing in `product_plans.price`
- Changes reflect immediately via `ServiceContext.refreshServices()`

## Testing & Quality

### Linting
```bash
npm run lint
```
ESLint config: `.eslintrc.json` (Next.js Core Web Vitals + TypeScript rules). Fix unused imports and variables before committing.

### Build Validation
Always run before pushing:
```bash
npm run build
```
Catches TypeScript errors, validates routes, and checks for missing dependencies.

## Common Issues & Solutions

### Empty Interface TypeScript Error
"An interface declaring no members is equivalent to its supertype" — either add members or replace the interface with a type alias.

### Supabase Environment Variables
If the client throws errors about invalid URL/key:
- Check for whitespace in `.env.local`
- `supabase.ts` auto-trims values
- Client-side keys must be prefixed with `NEXT_PUBLIC_`
- Server-only keys (e.g., `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`) must only be used in API routes

### Route Group Naming
Directories with parentheses `(group)` are route groups — they are NOT part of the URL:
- `(auth)/login` → URL `/login`
- `(protected)/admin` → URL `/admin`

### Date Offset (1-day off)
Use `date-fns` `format(date, 'yyyy-MM-dd')` for display. Using `.toISOString()` strips time and shifts the date by UTC offset, causing off-by-one errors.

### Supabase `auth.getSession` Warning
`supabase.ts` uses `getSession()` with an auth lock workaround. This is intentional; do not refactor unless Supabase client is upgraded.

## Deployment

**Recommended:** Vercel

**Deployment Checklist:**
1. Push to GitHub private repository
2. Import to Vercel
3. Set all environment variables in Vercel dashboard (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`)
4. Deploy (automatic on git push)
5. Run pending Supabase migrations in production SQL editor

See `docs/VERCEL_DEPLOY.md` for detailed deployment instructions.

## Korean Language Context

All user-facing text is in Korean:
- UI labels, buttons, messages, error text
- Database content (product names, descriptions, notices, FAQs)
- When adding features, maintain Korean for consistency

## Reference Documentation

Detailed docs are in the `docs/` directory:
- `docs/prd.md` - Product requirements
- `docs/db_schema.md` - Full database schema reference
- `docs/business-logic.md` - Detailed business logic flows
- `docs/screen_spec.md` - UI screen specifications
- `docs/techspec.md` - Technical specification
- `docs/supabase-migration-guide.md` - Migration workflow
- `docs/CHANGELOG.md` - Version history
- `docs/stability_guide.md` - Production stability notes
