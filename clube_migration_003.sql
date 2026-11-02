-- Workflow de ofertas e telemetria autenticada; sem dados financeiros.
create table if not exists ptp_offer_submissions (
 id bigint generated always as identity primary key,
 provider_user_id bigint not null references ptp_users(id),
 title text not null,
 category text not null default '',
 description text not null default '',
 benefit_id text references ptp_benefits(id),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 reviewed_by bigint references ptp_users(id),
 reviewed_at timestamptz,
 submitted_at timestamptz not null default now()
);
create index if not exists idx_ptp_offers_queue on ptp_offer_submissions(status,submitted_at desc);
create table if not exists ptp_usage_events (
 id bigint generated always as identity primary key,
 user_id bigint not null references ptp_users(id),
 company_id bigint references ptp_companies(id),
 event_type text not null,
 subject_type text not null,
 subject_id text,
 occurred_at timestamptz not null default now()
);
create index if not exists idx_ptp_usage_dimensions on ptp_usage_events(event_type,subject_type,occurred_at desc);
create index if not exists idx_ptp_usage_user on ptp_usage_events(user_id,occurred_at desc);
