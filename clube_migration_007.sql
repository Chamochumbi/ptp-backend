-- Additional editable presentation profile for each company; legal identity remains managed separately.
create table if not exists ptp_company_profiles (
 company_id bigint primary key references ptp_companies(id) on delete cascade,
 display_name text not null default '',
 logo_url text not null default '',
 segment text not null default '',
 city text not null default '',
 website text not null default '',
 description text not null default '',
 updated_by bigint references ptp_users(id),
 updated_at timestamptz not null default now()
);
