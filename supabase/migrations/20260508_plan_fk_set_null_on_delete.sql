-- Allow plan deletion even when soft-deleted orders reference it.
-- Changes orders.plan_id FK from default (RESTRICT) to ON DELETE SET NULL,
-- and makes the column nullable so the database can nullify it automatically.

ALTER TABLE orders ALTER COLUMN plan_id DROP NOT NULL;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_plan_id_fkey;

ALTER TABLE orders
    ADD CONSTRAINT orders_plan_id_fkey
    FOREIGN KEY (plan_id)
    REFERENCES product_plans(id)
    ON DELETE SET NULL;
