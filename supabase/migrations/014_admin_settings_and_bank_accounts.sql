-- Create site_settings table for admin credentials and other site-wide config
CREATE TABLE IF NOT EXISTS site_settings (
    id TEXT PRIMARY KEY DEFAULT 'main',
    admin_login_id TEXT NOT NULL DEFAULT 'dalbus',
    admin_login_pw TEXT NOT NULL DEFAULT '1q2w3e4r5t!!',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default settings if not exists
INSERT INTO site_settings (id, admin_login_id, admin_login_pw)
VALUES ('main', 'dalbus', '1q2w3e4r5t!!')
ON CONFLICT (id) DO NOTHING;

-- Create bank_accounts table for payment options
CREATE TABLE IF NOT EXISTS bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    account_holder TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert a default bank account (matching existing hardcoded one)
INSERT INTO bank_accounts (bank_name, account_number, account_holder)
VALUES ('하나은행', '39091001317704', '유한회사 소프트데이');
