-- The media bucket is private, so photos are served through short-lived signed
-- URLs. That signing check needs a read path on storage.objects: anyone may read
-- photos that belong to an active listing, plus every seller's own files.

create policy "photos of active listings are readable"
on storage.objects for select to anon, authenticated
using (
  bucket_id = 'rewear-media'
  and (
    (
      (storage.foldername(name))[1] = 'products'
      and exists (
        select 1 from public.products p
        where p.id::text = (storage.foldername(name))[3]
          and p.status = 'active'
      )
    )
    or (
      (storage.foldername(name))[1] = 'avatars'
    )
    or (
      (storage.foldername(name))[2] = auth.uid()::text
    )
  )
);
