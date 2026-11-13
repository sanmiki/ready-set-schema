# ReWear — marketplace build roadmap

Source brief: `user-uploads://Continue_building_my_existing_ReWear_second-hand_pasted.md`
(plus the uploaded home page `user-uploads://index.tsx`, which is the design to preserve).

## Done
- [x] Cloud, Storage, Auth connected; email/password enabled; signup auto-confirms (user chose "straight in"); Lovable + Google sign-in providers on.
- [x] Database migration: profiles, categories, products, product_images + RLS + grants + profile trigger.

## Open
- [ ] Storage bucket for product photos + avatars, with owner-only upload policies.
- [ ] Site chrome: header/footer, design tokens (sage/neutral palette, Georgian fonts), ProductCard, category data from DB.
- [ ] Home page: real active products (featured + recently added), real brands, empty state.
- [ ] Catalog: search, category/brand/size/condition/city/price filters, sorting — all on real data.
- [ ] Product detail page by ID: gallery, seller info, owner edit/delete controls.
- [ ] Sell form: photo upload to Storage + all fields + validation with Georgian errors; publish → redirect to new product page; edit + delete own listings.
- [ ] Auth pages: sign in / sign up, password reset, protected routes (sell, profile, my items).
- [ ] Profile edit: username, display name, avatar, city, bio.
- [ ] Remove demo data / demo-only notices; Georgian empty states.
- [ ] Tests for the rules the brief states (price non-negative, status values, required fields, routing).
- [ ] End-to-end verification in the browser: register → publish with photo → catalog → refresh → second user cannot edit.
