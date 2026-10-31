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
