-- Fix circular RLS evaluation between lampstand_families and lampstand_members.
-- Safe to run more than once.

create or replace function public.lampstand_is_family_owner(target_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.lampstand_families
    where id = target_family_id and owner_id = auth.uid()
  );
$$;

create or replace function public.lampstand_is_family_member(target_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.lampstand_members
    where family_id = target_family_id and user_id = auth.uid() and not suspended
  );
$$;

revoke all on function public.lampstand_is_family_owner(uuid) from public;
revoke all on function public.lampstand_is_family_member(uuid) from public;
grant execute on function public.lampstand_is_family_owner(uuid) to authenticated;
grant execute on function public.lampstand_is_family_member(uuid) to authenticated;

drop policy if exists "owners manage family members" on public.lampstand_members;
create policy "owners manage family members" on public.lampstand_members
  for all using (public.lampstand_is_family_owner(family_id))
  with check (public.lampstand_is_family_owner(family_id));

drop policy if exists "members view their family" on public.lampstand_families;
create policy "members view their family" on public.lampstand_families
  for select using (public.lampstand_is_family_member(id));

drop policy if exists "owners manage family devices" on public.lampstand_devices;
create policy "owners manage family devices" on public.lampstand_devices
  for all using (public.lampstand_is_family_owner(family_id))
  with check (public.lampstand_is_family_owner(family_id));

drop policy if exists "members register their devices" on public.lampstand_devices;
create policy "members register their devices" on public.lampstand_devices
  for insert with check (user_id = auth.uid() and public.lampstand_is_family_member(family_id));

drop policy if exists "owners manage family policies" on public.lampstand_policies;
create policy "owners manage family policies" on public.lampstand_policies
  for all using (public.lampstand_is_family_owner(family_id))
  with check (public.lampstand_is_family_owner(family_id));

drop policy if exists "owners view family audit events" on public.lampstand_audit_events;
create policy "owners view family audit events" on public.lampstand_audit_events
  for select using (public.lampstand_is_family_owner(family_id));
