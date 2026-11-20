# მეორადი (MEORADI, formerly ReWear) — marketplace build roadmap

Source brief: `user-uploads://Continue_building_my_existing_ReWear_second-hand_pasted.md`
(plus the uploaded home page `user-uploads://index.tsx`, which is the design to preserve).

## Done
- [x] Cloud, Storage, Auth connected; email/password enabled; signup goes straight in (user chose "straight in"); Lovable + Google sign-in providers on.
- [x] Database: profiles, categories, products, product_images + RLS + grants + profile trigger; categories seeded.
- [x] Private photo storage with owner-only upload rules; public photos served through a same-origin address that only hands out a link for a live listing.
- [x] Site chrome: header/footer, sage/neutral palette, Georgian fonts, product card, categories from the database.
- [x] Home page: real live products (featured + recently added), real brands, Georgian empty state.
- [x] Catalog: search, category/brand/size/condition/city/price filters and sorting — all on real data.
- [x] Product page: photo gallery, seller card, owner edit/delete controls, related items.
- [x] Sell form: photo upload, every field, Georgian validation; publish → product page; edit opens filled in; delete with confirmation.
- [x] Auth pages: sign in / sign up, password reset with its own page, protected sell / profile / my items.
- [x] Profile edit: username, display name, avatar, city, bio.
- [x] No demo listings, no demo-only notices; empty states in Georgian.
- [x] Tests: every page has a route, price cannot be negative, title required, only the offered conditions, password length, username format.
- [x] Browser verification: register → publish with photos → catalog → product → edit price → profile save → reserve → publish again → sign out.

## Open
- [x] Secure persistent messaging, product contact button, realtime inbox and unread navigation indicators.
- [x] Verified two-party realtime messaging, refresh persistence, read receipts, uniqueness, self-message protection, third-party privacy and mobile layout; manual testing steps provided.
- [ ] Google sign-in round trip in a real browser — needs a person to finish Google's account picker; the button and provider are in place.

- [x] Persistent favorites (hearts, /favorites page, owner-only access)
- [x] Seller phone contact (opt-in per listing, reveal + call), approximate location
- [x] Listing fee (first free, then 0.50 ₾ from balance), wallet page, ledger, publish guard
- [ ] Card payments + balance top-ups — blocked: no bank (TBC/BoG) merchant contract/credentials yet
- [x] Promotion packages (VIP / VIP+ / SUPER VIP), highlight, bump — wallet only; card payment waits on a bank contract
