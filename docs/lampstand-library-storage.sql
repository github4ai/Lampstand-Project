-- Run once in the Supabase SQL Editor after lampstand-cloud-schema.sql.
-- Library files can be downloaded by installed Lampstand clients, while only a
-- signed-in Lampstand family Owner can publish or replace them.

insert into storage.buckets (id, name, public, file_size_limit)
values ('lampstand-library', 'lampstand-library', true, 524288000)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit;

drop policy if exists "lampstand owners publish library files" on storage.objects;
create policy "lampstand owners publish library files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'lampstand-library'
  and exists (select 1 from public.lampstand_families where owner_id = auth.uid())
);

drop policy if exists "lampstand owners update library files" on storage.objects;
create policy "lampstand owners update library files"
on storage.objects for update to authenticated
using (
  bucket_id = 'lampstand-library'
  and exists (select 1 from public.lampstand_families where owner_id = auth.uid())
)
with check (
  bucket_id = 'lampstand-library'
  and exists (select 1 from public.lampstand_families where owner_id = auth.uid())
);

drop policy if exists "lampstand owners delete library files" on storage.objects;
create policy "lampstand owners delete library files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'lampstand-library'
  and exists (select 1 from public.lampstand_families where owner_id = auth.uid())
);
