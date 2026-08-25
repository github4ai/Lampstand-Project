-- Lampstand Project: verified member invitations and per-user workspace access.
-- Run once after lampstand-cloud-schema.sql.

alter table public.lampstand_members
  add column if not exists invited_email text,
  add column if not exists permissions jsonb not null default '[]'::jsonb,
  add column if not exists invited_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

alter table public.lampstand_members
  alter column local_profile_id set default gen_random_uuid()::text;

create unique index if not exists lampstand_members_family_email_key
  on public.lampstand_members (family_id, lower(invited_email))
  where invited_email is not null;

alter table public.lampstand_devices
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create or replace function public.lampstand_claim_member_invitation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.lampstand_members
  set user_id = new.id, updated_at = now()
  where user_id is null
    and invited_email is not null
    and lower(invited_email) = lower(new.email);
  return new;
end;
$$;

drop trigger if exists lampstand_claim_member_after_signup on auth.users;
create trigger lampstand_claim_member_after_signup
  after insert or update of email on auth.users
  for each row execute function public.lampstand_claim_member_invitation();

drop policy if exists "members view their membership" on public.lampstand_members;
create policy "members view their membership" on public.lampstand_members
  for select using (user_id = auth.uid());

drop policy if exists "members view their family" on public.lampstand_families;
create policy "members view their family" on public.lampstand_families
  for select using (
    id in (select family_id from public.lampstand_members where user_id = auth.uid())
  );

drop policy if exists "members register their devices" on public.lampstand_devices;
create policy "members register their devices" on public.lampstand_devices
  for insert with check (
    user_id = auth.uid()
    and family_id in (select family_id from public.lampstand_members where user_id = auth.uid() and not suspended)
  );

drop policy if exists "members view their devices" on public.lampstand_devices;
create policy "members view their devices" on public.lampstand_devices
  for select using (user_id = auth.uid());

drop policy if exists "members update their devices" on public.lampstand_devices;
create policy "members update their devices" on public.lampstand_devices
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.lampstand_touch_member_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists lampstand_members_updated_at on public.lampstand_members;
create trigger lampstand_members_updated_at
  before update on public.lampstand_members
  for each row execute function public.lampstand_touch_member_updated_at();
