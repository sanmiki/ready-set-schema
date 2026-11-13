import type { Condition, Sort, Status } from "./labels";

export type Category = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
};

export type Seller = {
  username: string;
  display_name: string | null;
  city: string | null;
  avatar_url: string | null;
  avatar_src: string | null;
};

export type ListingImage = {
  path: string;
  src: string | null;
};

export type Listing = {
  id: string;
  title: string;
  description: string;
  brand: string | null;
  size: string | null;
  color: string | null;
  condition: Condition;
  price: number;
  city: string | null;
  status: Status;
  created_at: string;
  updated_at: string;
  category: { name: string; slug: string } | null;
  seller: Seller | null;
  images: ListingImage[];
};

export type ListingQuery = {
  q?: string | undefined;
  category?: string | undefined;
  brand?: string | undefined;
  size?: string | undefined;
  condition?: string | undefined;
  city?: string | undefined;
  minPrice?: number | undefined;
  maxPrice?: number | undefined;
  sort?: Sort | undefined;
  limit?: number | undefined;
};

export type Facets = {
  brands: string[];
  cities: string[];
  sizes: string[];
  total: number;
};

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  avatar_src: string | null;
  city: string | null;
  bio: string | null;
  created_at: string;
};

export type Result<T = { id: string }> = { ok: true } & T | { ok: false; message: string };
