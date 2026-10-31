-- Executar em PostgreSQL exclusivo de homologação, mediante revisão administrativa.
create table if not exists ptp_companies(
 id bigint generated always as identity primary key,
 name text not null,
 active boolean not null default false,
 created_at timestamptz not null default now()
);
create table if not exists ptp_users(
 id bigint generated always as identity primary key,
 email text not null unique,
 name text not null,
 password_hash text not null,
 role text not null check(role in ('admin','manager','employee','provider')),
 company_id bigint references ptp_companies(id),
 active boolean not null default false,
 created_at timestamptz not null default now()
);
create table if not exists ptp_sessions(
 id bigint generated always as identity primary key,
 user_id bigint not null references ptp_users(id),
 token_hash text not null unique,
 expires_at timestamptz not null,
 revoked_at timestamptz
);
create table if not exists ptp_invites(
 id bigint generated always as identity primary key,
 email text not null,
 role text not null,
 company_id bigint references ptp_companies(id),
 token_hash text not null unique,
 created_by bigint not null references ptp_users(id),
 expires_at timestamptz not null,
 consumed_at timestamptz
);
create table if not exists ptp_audit(
 id bigint generated always as identity primary key,
 actor_id bigint references ptp_users(id),
 action text not null,
 target text,
 created_at timestamptz not null default now()
);
create index if not exists idx_ptp_sessions_user on ptp_sessions(user_id);
create index if not exists idx_ptp_invites_email on ptp_invites(email);
