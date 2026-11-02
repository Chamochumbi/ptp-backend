-- Credenciais rotativas e resgates presenciais auditáveis.
create table if not exists ptp_member_credentials(
 user_id bigint primary key references ptp_users(id),
 member_code text not null unique,
 photo_url text,
 created_at timestamptz not null default now()
);
create table if not exists ptp_checkin_tokens(
 token_hash text primary key,
 user_id bigint not null references ptp_users(id),
 expires_at timestamptz not null,
 consumed_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists ptp_physical_checkins(
 id bigint generated always as identity primary key,
 redemption_id bigint not null unique references ptp_redemptions(id),
 provider_user_id bigint not null references ptp_users(id),
 beneficiary_user_id bigint not null references ptp_users(id),
 benefit_id text not null references ptp_benefits(id),
 company_id bigint not null references ptp_companies(id),
 confirmed_at timestamptz not null default now()
);
create index if not exists idx_ptp_checkins_provider on ptp_physical_checkins(provider_user_id,confirmed_at desc);
