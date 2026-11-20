import { getMyWallet } from "./wallet.functions";
import { queryOptions } from "@tanstack/react-query";

import {
  getListing,
  listCategories,
  listFacets,
  listListings,
  listPromotedListings,
  listRelatedListings,
} from "./catalog.functions";
import { getMyListing, getMyProfile, listMyListings } from "./seller.functions";
import { listMyFavorites } from "./favorites.functions";
import type { ListingQuery } from "./types";

export const categoriesQuery = queryOptions({
  queryKey: ["categories"],
  queryFn: () => listCategories(),
});

export const facetsQuery = queryOptions({
  queryKey: ["facets"],
  queryFn: () => listFacets(),
});

export const listingsQuery = (input: ListingQuery) =>
  queryOptions({
    queryKey: ["listings", input],
    queryFn: () => listListings({ data: input }),
  });

export const listingQuery = (id: string) =>
  queryOptions({
    queryKey: ["listing", id],
    queryFn: () => getListing({ data: { id } }),
  });

export const relatedListingsQuery = (id: string, categorySlug: string | null) =>
  queryOptions({
    queryKey: ["related-listings", id, categorySlug],
    queryFn: () => listRelatedListings({ data: { id, categorySlug: categorySlug ?? undefined } }),
  });

export const myListingsQuery = queryOptions({
  queryKey: ["my-listings"],
  queryFn: () => listMyListings(),
});

export const myListingQuery = (id: string) =>
  queryOptions({
    queryKey: ["my-listing", id],
    queryFn: () => getMyListing({ data: { id } }),
  });

export const myProfileQuery = queryOptions({
  queryKey: ["my-profile"],
  queryFn: () => getMyProfile(),
});

export const myFavoritesQuery = queryOptions({
  queryKey: ["my-favorites"],
  queryFn: () => listMyFavorites(),
});

export const myWalletQuery = (userId: string | null) =>
  queryOptions({
    queryKey: ["my-wallet", userId],
    queryFn: () => getMyWallet(),
    enabled: !!userId,
  });

export const promotedListingsQuery = (minTier: number, limit = 8) =>
  queryOptions({
    queryKey: ["promoted-listings", minTier, limit],
    queryFn: () => listPromotedListings({ data: { minTier, limit } }),
  });
