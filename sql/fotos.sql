-- Dispatch: afgeschermde fotomap voor de coasterfoto's. Eenmalig plakken in Supabase > SQL Editor > Run.
-- Lezen mag iedereen die is ingelogd (Wouter en Luca). Schrijven alleen Wouter (die uploadt met tools/photos/upload.mjs).

insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', false)
on conflict (id) do update set public = false;

drop policy if exists "fotos lezen" on storage.objects;
create policy "fotos lezen" on storage.objects
  for select to authenticated
  using (bucket_id = 'fotos');

drop policy if exists "fotos toevoegen" on storage.objects;
create policy "fotos toevoegen" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'fotos' and auth.uid() = 'e5aeb32f-c2d0-45cb-bd25-13a785fa07e5');

drop policy if exists "fotos bijwerken" on storage.objects;
create policy "fotos bijwerken" on storage.objects
  for update to authenticated
  using (bucket_id = 'fotos' and auth.uid() = 'e5aeb32f-c2d0-45cb-bd25-13a785fa07e5');

drop policy if exists "fotos verwijderen" on storage.objects;
create policy "fotos verwijderen" on storage.objects
  for delete to authenticated
  using (bucket_id = 'fotos' and auth.uid() = 'e5aeb32f-c2d0-45cb-bd25-13a785fa07e5');
