insert into storage.buckets (id, name, public)
values ('reports-images', 'reports-images', true)
on conflict (id) do nothing;

drop policy if exists "Public can view reports images" on storage.objects;
create policy "Public can view reports images"
on storage.objects
for select
to public
using (bucket_id = 'reports-images');

drop policy if exists "Public can upload reports images" on storage.objects;
create policy "Public can upload reports images"
on storage.objects
for insert
to public
with check (bucket_id = 'reports-images');

drop policy if exists "Public can update reports images" on storage.objects;
create policy "Public can update reports images"
on storage.objects
for update
to public
using (bucket_id = 'reports-images')
with check (bucket_id = 'reports-images');
