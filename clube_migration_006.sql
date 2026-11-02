CREATE TABLE IF NOT EXISTS ptp_first_admin_tokens (id bigint generated always as identity primary key,email text not null,name text not null,token_hash text not null unique,created_at timestamptz not null default now(),expires_at timestamptz not null,consumed_at timestamptz);
CREATE INDEX IF NOT EXISTS idx_ptp_first_admin_recent ON ptp_first_admin_tokens(email,created_at DESC);
