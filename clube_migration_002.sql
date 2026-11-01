create table if not exists ptp_applications (
 id bigint generated always as identity primary key,
 application_type text not null check (application_type in ('company','provider')),
 organization_name text not null,
 contact_name text not null,
 contact_email text not null,
 contact_phone text,
 employee_count integer check (employee_count > 0),
 notes text,
 status text not null default 'pending' check (status in ('pending','under_review','approved','rejected')),
 reviewed_by bigint references ptp_users(id),
 reviewed_at timestamptz,
 submitted_at timestamptz not null default now()
);
create index if not exists idx_ptp_application_review on ptp_applications(status,submitted_at desc);

-- Catálogo canônico e registro individual de uso do Clube (sem módulo financeiro).
create table if not exists ptp_benefits (
 id text primary key,
 title text not null,
 provider text not null default '',
 category text not null default '',
 description text not null default '',
 active boolean not null default true,
 updated_at timestamptz not null default now()
);
create table if not exists ptp_redemptions (
 id bigint generated always as identity primary key,
 benefit_id text not null references ptp_benefits(id),
 user_id bigint not null references ptp_users(id),
 company_id bigint not null references ptp_companies(id),
 status text not null default 'requested' check(status in ('requested','confirmed','cancelled')),
 requested_at timestamptz not null default now(),
 confirmed_at timestamptz,
 confirmed_by bigint references ptp_users(id),
 constraint uq_ptp_redemption unique(benefit_id,user_id,requested_at)
);
create index if not exists idx_ptp_redemptions_benefit on ptp_redemptions(benefit_id,requested_at desc);
create index if not exists idx_ptp_redemptions_company on ptp_redemptions(company_id,requested_at desc);
