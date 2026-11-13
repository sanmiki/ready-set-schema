-- Only the owner may upload into their own listing / avatar folders in the rewear-media bucket.

create policy "sellers upload photos to their own listing folders"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'rewear-media'
  and (
    (
      (storage.foldername(name))[1] = 'products'
      and (storage.foldername(name))[2] = auth.uid()::text
      and exists (
        select 1 from public.products p
        where p.id::text = (storage.foldername(name))[3]
          and p.seller_id = auth.uid()
      )
    )
    or (
      (storage.foldername(name))[1] = 'avatars'
      and (storage.foldername(name))[2] = auth.uid()::text
    )
  )
);

create policy "owners replace files in their own folders"
on storage.objects for update to authenticated
using (
  bucket_id = 'rewear-media'
  and (
    (
      (storage.foldername(name))[1] = 'products'
      and (storage.foldername(name))[2] = auth.uid()::text
    )
    or (
      (storage.foldername(name))[1] = 'avatars'
      and (storage.foldername(name))[2] = auth.uid()::text
    )
  )
)
with check (
  bucket_id = 'rewear-media'
  and (
    (
      (storage.foldername(name))[1] = 'products'
      and (storage.foldername(name))[2] = auth.uid()::text
    )
    or (
      (storage.foldername(name))[1] = 'avatars'
      and (storage.foldername(name))[2] = auth.uid()::text
    )
  )
);

create policy "owners delete files from their own folders"
on storage.objects for delete to authenticated
using (
  bucket_id = 'rewear-media'
  and (
    (
      (storage.foldername(name))[1] = 'products'
      and (storage.foldername(name))[2] = auth.uid()::text
    )
    or (
      (storage.foldername(name))[1] = 'avatars'
      and (storage.foldername(name))[2] = auth.uid()::text
    )
  )
);
