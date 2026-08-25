-- Lampstand Project remote family-access control for Supabase.
-- This stores identities, devices, permissions, and audit events only.
-- It does not store conversations, documents, Ministry libraries, or generated media.

create extension if not exists pgcrypto;

create table if not exists public.lampstand_families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.lampstand_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.lampstand_families(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  local_profile_id text not null,
  display_name text not null,
  role text not null check (role in ('owner','family-admin','adult','student','child','guest')),
  suspended boolean not null default false,
  created_at timestamptz not null default now(),
  unique (family_id, local_profile_id)
);

create table if not exists public.lampstand_devices (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.lampstand_families(id) on delete cascade,
  device_key text not null unique,
  name text not null,
  platform text,
  approved boolean not null default false,
  revoked_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.lampstand_policies (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.lampstand_families(id) on delete cascade,
  device_id uuid not null references public.lampstand_devices(id) on delete cascade,
  member_id uuid not null references public.lampstand_members(id) on delete cascade,
  policy jsonb not null,
  version integer not null default 1,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.lampstand_audit_events (
  id bigint generated always as identity primary key,
  family_id uuid not null references public.lampstand_families(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  device_id uuid references public.lampstand_devices(id) on delete set null,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.lampstand_families enable row level security;
alter table public.lampstand_members enable row level security;
alter table public.lampstand_devices enable row level security;
alter table public.lampstand_policies enable row level security;
alter table public.lampstand_audit_events enable row level security;

create policy "owners manage their families" on public.lampstand_families
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners manage family members" on public.lampstand_members
  for all using (family_id in (select id from public.lampstand_families where owner_id = auth.uid()))
  with check (family_id in (select id from public.lampstand_families where owner_id = auth.uid()));
create policy "owners manage family devices" on public.lampstand_devices
  for all using (family_id in (select id from public.lampstand_families where owner_id = auth.uid()))
  with check (family_id in (select id from public.lampstand_families where owner_id = auth.uid()));
create policy "owners manage family policies" on public.lampstand_policies
  for all using (family_id in (select id from public.lampstand_families where owner_id = auth.uid()))
  with check (family_id in (select id from public.lampstand_families where owner_id = auth.uid()));
create policy "owners view family audit events" on public.lampstand_audit_events
  for select using (family_id in (select id from public.lampstand_families where owner_id = auth.uid()));
