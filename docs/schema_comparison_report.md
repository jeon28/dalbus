# Database Schema Comparison Report

This report compares the documented schema in `docs/db_schema.md` (v2.3) with the actual database schema inferred from `supabase/migrations`.

**Date:** 2026-02-15
**Status:** ⚠️ Discrepancies Found

## Summary
The documentation appears to be ahead of the actual implementation (migrations). Several fields and tables described in `db_schema.md` are missing from the migration files, particularly in the `orders` and `order_accounts` tables.

## 1. Missing Columns (In `migrations`, present in `docs`)

### `orders` Table
| Column Name | Type | Description in Docs | Status |
| :--- | :--- | :--- | :--- |
| `order_type` | ENUM | `NEW` / `REPURCHASE` | ❌ **Missing** in DB |
| `related_order_id` | UUID | FK to `orders` (self-referencing) | ❌ **Missing** in DB |

### `order_accounts` Table
| Column Name | Type | Description in Docs | Status |
| :--- | :--- | :--- | :--- |
| `type` | ENUM | `master` / `user` | ❌ **Missing** in DB (Found in types but not migrations) |
| `buyer_name` | String | "Added in v2.8" | ❌ **Missing** in DB |
| `buyer_phone` | String | "Added in v2.8" | ❌ **Missing** in DB |
| `buyer_email` | String | "Added in v2.8" | ❌ **Missing** in DB |
| `order_number` | String | Stored redundantly | ❌ **Missing** in DB |

> **Note:** `buyer_name`, `buyer_phone`, `buyer_email` exist in the `orders` table (added in migration `005`), but the documentation lists them *also* in `order_accounts` as a redundancy added in v2.8. This redundancy is currently missing.

## 2. Confirmed Matches

The following tables and key columns match between the documentation and migrations:

-   **`profiles`**: Matches perfectly.
-   **`products`**: Matches (including `detail_content` added in `013`).
-   **`product_plans`**: Matches.
-   **`accounts`**: Matches (including `payment_email` added in `009` and `payment_day` in `012`). `login_pw` is correctly nullable (migration `018`).
-   **`qna`**: Matches (table created in `008`).
-   **`notices` / `faqs`**: Match.

## 3. Recommendations

To align the database with `docs/db_schema.md`, the following SQL migration is required:

```sql
-- Migration Recommendation

-- 1. Add missing Enums if not present
CREATE TYPE IF NOT EXISTS order_group_type AS ENUM ('NEW', 'REPURCHASE'); -- naming collision with order_type?
CREATE TYPE IF NOT EXISTS account_role_type AS ENUM ('master', 'user');

-- 2. Update orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS order_type order_group_type DEFAULT 'NEW',
ADD COLUMN IF NOT EXISTS related_order_id UUID REFERENCES orders(id);

-- 3. Update order_accounts table
ALTER TABLE order_accounts
ADD COLUMN IF NOT EXISTS type account_role_type DEFAULT 'user',
ADD COLUMN IF NOT EXISTS buyer_name TEXT,
ADD COLUMN IF NOT EXISTS buyer_phone TEXT,
ADD COLUMN IF NOT EXISTS buyer_email TEXT,
ADD COLUMN IF NOT EXISTS order_number TEXT;
```

## 4. Source of Truth
-   **Documentation**: `docs/db_schema.md`
-   **Actual Schema**: `supabase/migrations/*.sql`
-   **Outdated/Generated**: `src/types/database.ts` (Partially outdated/inconsistent)
