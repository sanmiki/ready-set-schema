-- ReWear marketplace schema: profiles, categories, products, product_images

create type public.product_status as enum ('draft', 'active', 'reserved', 'sold');

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text,
  avatar_url text,
  city text,
  bio text,
  created_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_.]{3,30}$'),
  constraint profiles_display_name_len check (display_name is null or char_length(display_name) <= 60),
  constraint profiles_city_len check (city is null or char_length(city) <= 80),
  constraint profiles_bio_len check (bio is null or char_length(bio) <= 500),
  constraint profiles_avatar_url_len check (avatar_url is null or char_length(avatar_url) <= 400)
);

-- ---------- categories ----------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  parent_id uuid references public.categories(id) on delete set null,
  constraint categories_name_len check (char_length(name) between 1 and 60),
  constraint categories_slug_format check (slug ~ '^[a-z0-9-]{1,60}$'),
  constraint categories_no_self_parent check (parent_id is null or parent_id <> id)
);

-- ---------- products ----------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  title text not null,
  description text not null default '',
  brand text,
  size text,
  color text,
  condition text not null default 'good',
  price numeric(10,2) not null,
  city text,
  status public.product_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_price_non_negative check (price >= 0),
  constraint products_condition_allowed check (condition in ('new', 'like_new', 'good', 'fair')),
  constraint products_title_len check (char_length(title) between 3 and 120),
  constraint products_description_len check (char_length(description) <= 4000),
  constraint products_brand_len check (brand is null or char_length(brand) <= 60),
  constraint products_size_len check (size is null or char_length(size) <= 30),
  constraint products_color_len check (color is null or char_length(color) <= 40),
  constraint products_city_len check (city is null or char_length(city) <= 80)
);

-- ---------- product_images ----------
create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null,
  sort_order integer not null default 0,
  constraint product_images_sort_unique unique (product_id, sort_order),
  constraint product_images_path_len check (char_length(storage_path) between 1 and 400),
  constraint product_images_sort_order_non_negative check (sort_order >= 0)
);

-- ---------- indexes ----------
create index products_status_idx on public.products (status);
create index products_category_idx on public.products (category_id);
create index products_seller_idx on public.products (seller_id);
create index products_price_idx on public.products (price);
create index products_created_idx on public.products (created_at desc);
create index products_brand_idx on public.products (brand);
create index products_city_idx on public.products (city);
create index product_images_product_idx on public.product_images (product_id, sort_order);
create index categories_parent_idx on public.categories (parent_id);

-- ---------- grants (Data API needs them; RLS alone is not enough) ----------
grant select on public.profiles to anon;
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

grant select on public.categories to anon;
grant all on public.categories to service_role;

grant select on public.products to anon;
grant select, insert, update, delete on public.products to authenticated;
grant all on public.products to service_role;

grant select on public.product_images to anon;
grant select, insert, update, delete on public.product_images to authenticated;
grant all on public.product_images to service_role;

-- ---------- row level security ----------
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;

-- profiles: public seller cards, self-edit only
create policy "profiles are publicly readable"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- categories: public read, writes are app-side only
create policy "categories are publicly readable"
  on public.categories for select
  to anon, authenticated
  using (true);

-- products: anyone sees active listings, owners also see their own drafts
create policy "active listings are publicly readable"
  on public.products for select
  to anon, authenticated
  using (status = 'active' or seller_id = auth.uid());

create policy "signed-in users can create their own listings"
  on public.products for insert
  to authenticated
  with check (seller_id = auth.uid());

create policy "owners can update their own listings"
  on public.products for update
  to authenticated
  using (seller_id = auth.uid())
  with check (seller_id = auth.uid());

create policy "owners can delete their own listings"
  on public.products for delete
  to authenticated
  using (seller_id = auth.uid());

-- product_images: visible with their listing, writable only by the listing owner
create policy "images of visible listings are readable"
  on public.product_images for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id
        and (p.status = 'active' or p.seller_id = auth.uid())
    )
  );

create policy "owners can attach images to their own listings"
  on public.product_images for insert
  to authenticated
  with check (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id and p.seller_id = auth.uid()
    )
  );

create policy "owners can replace images on their own listings"
  on public.product_images for update
  to authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id and p.seller_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id and p.seller_id = auth.uid()
    )
  );

create policy "owners can remove images from their own listings"
  on public.product_images for delete
  to authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id and p.seller_id = auth.uid()
    )
  );

-- ---------- profile auto-creation on signup ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base text;
  candidate text;
  suffix int := 0;
begin
  base := lower(regexp_replace(coalesce(nullif(split_part(new.email, '@', 1), ''), 'user'), '[^a-z0-9_.]', '', 'g'));
  base := left(base, 24);
  if char_length(base) < 3 then
    base := base || substr(replace(md5(random()::text), '-', ''), 1, 6);
  end if;

  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    suffix := suffix + 1;
    candidate := left(base, 26) || '-' || suffix::text;
  end loop;

  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    candidate,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), candidate)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- keep products.updated_at fresh ----------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_touch_updated_at
  before update on public.products
  for each row execute function public.touch_updated_at();
