create table public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
create index favorites_product_id_idx on public.favorites(product_id);

grant select, insert, delete on public.favorites to authenticated;
grant all on public.favorites to service_role;

alter table public.favorites enable row level security;

create policy "users read their own favorites" on public.favorites
for select to authenticated using (user_id = (select auth.uid()));
create policy "users add their own favorites" on public.favorites
for insert to authenticated with check (user_id = (select auth.uid()));
create policy "users remove their own favorites" on public.favorites
for delete to authenticated using (user_id = (select auth.uid()));