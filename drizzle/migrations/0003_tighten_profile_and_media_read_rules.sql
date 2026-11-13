drop policy if exists "profiles are publicly readable" on public.profiles;
create policy "own profile or sellers with live listings are readable"
on public.profiles for select to anon, authenticated
using (
  id = auth.uid()
  or exists (select 1 from public.products p where p.seller_id = profiles.id and p.status = 'active')
);

drop policy if exists "photos of active listings are readable" on storage.objects;
create policy "photos of active listings are readable"
on storage.objects for select to anon, authenticated
using (
  bucket_id = 'rewear-media'
  and (
    exists (
      select 1 from public.product_images i
      join public.products p on p.id = i.product_id
      where i.storage_path = storage.objects.name and p.status = 'active'
    )
    or exists (
      select 1 from public.profiles pr
      where pr.avatar_url = storage.objects.name
        and exists (select 1 from public.products p where p.seller_id = pr.id and p.status = 'active')
    )
  )
);
create policy "owners read their own files"
on storage.objects for select to authenticated
using (
  bucket_id = 'rewear-media'
  and (storage.foldername(name))[2] = (select auth.uid()::text)
);