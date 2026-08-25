-- Lampstand Project: allow exactly one verified account to establish the first Owner family.
-- Run after the two earlier Lampstand cloud SQL files.

create or replace function public.lampstand_claim_first_owner(family_name text default 'Lampstand Family')
returns public.lampstand_families
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  claimed public.lampstand_families;
  caller auth.users;
begin
  select * into caller from auth.users where id = auth.uid();
  if caller.id is null or caller.email_confirmed_at is null then
    raise exception 'A verified email account is required.';
  end if;

  perform pg_advisory_xact_lock(20260814);
  select * into claimed from public.lampstand_families where owner_id = auth.uid() limit 1;
  if claimed.id is not null then return claimed; end if;
  if exists (select 1 from public.lampstand_families) then
    raise exception 'This email has not been invited by the Lampstand Owner.';
  end if;

  insert into public.lampstand_families (name, owner_id)
  values (coalesce(nullif(trim(family_name), ''), 'Lampstand Family'), auth.uid())
  returning * into claimed;
  return claimed;
end;
$$;

grant execute on function public.lampstand_claim_first_owner(text) to authenticated;
