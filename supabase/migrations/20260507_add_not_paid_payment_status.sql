-- Add 'not_paid' value to payment_status enum
-- 미입금: admin explicitly marks an order as unpaid (no payment received)
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'not_paid';
