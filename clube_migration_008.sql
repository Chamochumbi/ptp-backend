-- Personal profile fields; CPF is deliberately not stored without an approved verification system.
create table if not exists ptp_person_profiles (
 user_id bigint primary key references ptp_users(id) on delete cascade,
 phone text not null default '',
 photo_ref text not null default '',
 updated_at timestamptz not null default now()
);
