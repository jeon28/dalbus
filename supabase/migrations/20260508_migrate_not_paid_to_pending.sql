-- Migrate existing not_paid orders to pending (주문신청)
-- The not_paid status is no longer used in the UI; pending covers all unpaid orders
UPDATE orders SET payment_status = 'pending' WHERE payment_status = 'not_paid';
