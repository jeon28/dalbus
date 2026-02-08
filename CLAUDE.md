# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dalbus (달버스) is a premium subscription service matching platform that helps users save money on services like Tidal by sharing subscription costs. Built with Next.js 15, React 19, and Supabase.

**Key Characteristics:**
- Mobile-first design with Glassmorphism UI
- Korean-language platform (all UI text is in Korean)
- B2C subscription matching service
- Admin-managed account assignment workflow

## Development Commands

### Core Commands
```bash
npm install              # Install dependencies
npm run dev             # Start development server at http://localhost:3000
npm run build           # Build for production
npm start               # Run production build
npm run lint            # Run ESLint
```

### Supabase Migration
Database schema is managed through SQL migration files in the root directory:
- `supabase_migration_v2.sql` - Main schema (products, orders, accounts, etc.)
- `supabase_RLS_fix.sql` - Row Level Security policies
- Apply migrations directly in Supabase SQL Editor

## Architecture

### Tech Stack
- **Frontend:** Next.js 15 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS with shadcn/ui components, Glassmorphism design
- **State Management:** React Context API (ServiceContext)
- **Database:** Supabase (PostgreSQL with RLS)
- **Authentication:** Supabase Auth
- **UI Components:** Radix UI primitives via shadcn/ui

### Route Structure (Next.js App Router)

**Route Groups:**
- `(auth)/` - Unauthenticated routes (login, signup)
- `(protected)/` - Protected routes requiring authentication (admin, mypage)
- `api/` - API routes for backend operations

**Key Pages:**
- `/` - Home page showing available services
- `/service/[id]` - Service detail and subscription purchase
- `/login` - User login
- `/signup` - User registration
- `/mypage` - User dashboard (subscription info, account details)
- `/admin` - Admin dashboard (order management, pricing)
- `/admin/orders` - Order management and account assignment
- `/admin/services` - Product and plan management
- `/admin/members` - User management
- `/admin/qna` - Customer inquiry management

**API Routes:**
- `/api/admin/products` - Product CRUD
- `/api/admin/plans` - Plan CRUD
- `/api/admin/orders` - Order management
- `/api/admin/members` - User management
- `/api/qna` - Customer inquiry submission

### Global State Management

The application uses React Context (`ServiceContext.tsx`) for global state:

**Managed State:**
- `services`: Product list fetched from Supabase `products` table
- `user`: Currently authenticated user
- `isAdmin`: Admin authentication status
- `isHydrated`: Client-side hydration status (important for SSR)

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
- `profiles` - User profiles (linked to auth.users)
- `products` - Subscription services (Tidal, etc.)
- `product_plans` - Pricing plans (1-month, 3-month variants)
- `accounts` - Shared account pool (login credentials)
- `orders` - User purchases and subscriptions
- `order_accounts` - Order-to-account assignment mapping
- `notices`, `faqs` - Content management
- `notification_logs` - SMS/Alimtalk notification tracking

**Key Relationships:**
- `orders.user_id` → `profiles.id`
- `orders.product_id` → `products.id`
- `orders.plan_id` → `product_plans.id`
- `order_accounts` links `orders` ↔ `accounts` (many-to-many)

**Status Enums:**
- `payment_status`: pending, paid, failed, cancelled, refunded
- `assignment_status`: waiting, assigned, expired, replaced
- `account_status`: available, assigned, disabled
- `user_role`: user, admin

**Row Level Security (RLS):**
- All tables have RLS enabled
- Users can only view/modify their own data
- Admin role has full access (checked via `is_admin()` function)
- Products/plans are publicly readable

### Environment Variables

Required in `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**Important:** Environment variables are trimmed in `src/lib/supabase.ts` to handle whitespace issues.

## Component Architecture

### UI Components (shadcn/ui)
Located in `src/components/ui/`:
- Built on Radix UI primitives
- Styled with Tailwind CSS
- Use `@/components/ui/*` imports

### Layout Components
Located in `src/components/layout/`:
- `Header.tsx` - Site navigation
- `Footer.tsx` - Site footer

### Styling System
- Global styles: `src/app/globals.css`
- Tailwind config: `tailwind.config.js`
- Design tokens defined as CSS variables (HSL colors)
- Mobile-first responsive breakpoints

## Key Development Patterns

### Path Aliases
TypeScript is configured with `@/*` alias pointing to `src/*`:
```typescript
import { supabase } from '@/lib/supabase';
import Header from '@/components/layout/Header';
```

### Client vs Server Components
- Most pages use `"use client"` directive due to:
  - ServiceContext (React Context)
  - Supabase client authentication
  - Interactive UI components
- API routes run server-side with full Supabase access

### TypeScript Types
Database types are auto-generated in `src/types/database.ts`:
- Type-safe Supabase queries
- `Database.public.Tables['table_name']['Row']` pattern

### Admin Authentication
Admin access uses a simple session-based approach:
- `isAdmin` state in ServiceContext
- Protected routes check `isAdmin` before rendering
- No complex role-based access control (RBAC) in MVP

## Business Logic

### Order Flow
1. User selects product and plan
2. Payment processed (currently simulation mode)
3. Order created with status `payment_status: 'paid'`, `assignment_status: 'waiting'`
4. Admin manually assigns account via `/admin/orders`
5. Account credentials displayed in user's `/mypage`
6. SMS notification sent (future: via Solapi integration)

### Account Assignment
- Manual process (MVP)
- Admin selects available account from pool
- Updates `order.assignment_status` to 'assigned'
- Links via `order_accounts` table
- Updates `account.used_slots` counter

### Pricing Management
Admins can update pricing in real-time:
- Product base price in `products.original_price`
- Plan-specific pricing in `product_plans.price`
- Changes reflect immediately via ServiceContext

## Testing & Quality

### Linting
ESLint is configured for Next.js:
- Config: `.eslintrc.json`
- Run: `npm run lint`
- Fix unused imports and variables before committing

### Build Validation
Always run `npm run build` before pushing:
- Catches TypeScript errors
- Validates route configurations
- Checks for missing dependencies

## Common Issues & Solutions

### Empty Interface Errors
If you see "An interface declaring no members is equivalent to its supertype":
- This is a TypeScript lint rule
- Either add members or remove the interface
- Example: `Textarea.tsx` had this issue (see commit df5447f)

### Supabase Environment Variables
If Supabase client throws errors about invalid URL/key:
- Check for whitespace in `.env.local`
- The `supabase.ts` client trims values automatically
- Verify variables are prefixed with `NEXT_PUBLIC_` for client-side access

### Route Group Naming
Directories with parentheses `(group)` are route groups:
- Not included in URL path
- Used for organization and shared layouts
- Example: `(auth)/login` → URL is `/login`

## Deployment

**Recommended:** Vercel (official Next.js platform)

**Deployment Checklist:**
1. Push to GitHub private repository
2. Import to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy (automatic on git push)
5. Run Supabase migrations in production database

## Korean Language Context

All user-facing text is in Korean:
- UI labels, buttons, messages
- Database content (product names, descriptions)
- Error messages and notifications
- When adding features, maintain Korean for consistency

## Future Integrations (Not Yet Implemented)

- **PortOne:** Payment gateway for real transactions
- **Solapi:** SMS/Alimtalk notifications for account delivery
- Automatic subscription renewal
- Self-service account replacement
