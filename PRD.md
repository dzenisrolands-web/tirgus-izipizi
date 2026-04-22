# PRD — tirgus.izipizi.lv Marketplace

**Version**: 0.1 (Draft)  
**Date**: 2026-04-22  
**Owner**: Dzenis (dzenis.rolands@gmail.com)  
**Status**: Awaiting stakeholder input on open questions

---

## 1. Problem Statement

Latvian farmers and local food producers have no dedicated, low-friction channel to sell directly to nearby consumers. izipizi already operates a parcel locker network across Latvia. This marketplace bridges the two: producers list goods, buyers purchase online, and pickup happens at the nearest izipizi locker — no courier coordination needed.

---

## 2. Goals

| Goal | Metric |
|------|--------|
| Enable producers to list and sell locally | # active listings |
| Drive buyer adoption near locker locations | # completed orders / locker |
| Minimize friction from listing to pickup | Time from order → locker availability |
| Build trust with verified local producers | % verified seller accounts |

---

## 3. Non-Goals (MVP)

- International shipping or non-locker delivery
- Live chat / messaging between buyer and seller (post-MVP)
- Mobile native app (responsive web only for MVP)
- Auction or bidding mechanics
- Wholesale / B2B orders

---

## 4. Users

### Sellers (Producers)
- Farmers, food producers, artisans
- May have limited tech literacy
- Need simple listing creation (mobile-friendly)
- Need locker slot booking workflow
- Need payout management

### Buyers (Consumers)
- Shoppers near an izipizi locker
- Browsing by proximity / locker location
- Want fresh/local produce with convenient pickup
- Need trust signals (producer info, ratings)

---

## 5. User Flows

### Seller Flow
1. Register → verify email → complete producer profile (farm name, description, region, photo)
2. [Admin approval step — TBD] or instant access
3. Create listing: title, photos, category, price, quantity, available dates, target locker(s)
4. Receive order notification → confirm order → pack goods → book locker slot via izipizi
5. Load goods into locker → mark as "ready for pickup"
6. Buyer collects → order complete → payout triggered

### Buyer Flow
1. Land on homepage → see map or list of lockers with available goods
2. Browse by locker location or category
3. View product listing → seller profile → add to cart
4. Checkout → select pickup locker → pay
5. Receive locker code via email/SMS when seller loads goods
6. Collect from locker → optionally leave rating

---

## 6. Features

### MVP (Phase 1)

#### Authentication & Profiles
- Email + magic link auth (Supabase Auth)
- Two roles: `buyer` and `seller`
- Seller profile: farm name, bio, location, avatar, verification badge
- Buyer profile: name, saved lockers, order history

#### Listings
- Create/edit/delete listing
- Fields: title, description, photos (up to 5), category, price, unit (kg/piece/bundle), quantity, freshness date, available locker(s)
- Listing status: draft / active / sold out / expired
- Categories: Vegetables, Fruit, Dairy, Meat, Eggs, Honey, Baked Goods, Preserves, Other

#### Discovery & Browse
- Homepage: hero + featured listings + locker map
- Catalog page: grid layout (Vinted-style), left filter sidebar
  - Filter by: category, locker location, price range, freshness, seller rating
  - Sort by: newest, price asc/desc, distance (if location allowed)
- Search: full-text search on title + description
- Locker map view: pins showing # of available listings per locker

#### Cart & Checkout
- Single-seller cart (MVP simplification)
- Checkout: select/confirm pickup locker, review order, pay
- Payment: TBD (Stripe or local provider)
- Order confirmation email with estimated availability window

#### Orders & Fulfillment
- Seller dashboard: incoming orders, confirm/reject, mark as loaded
- Buyer: order status tracking (confirmed → packed → ready → collected)
- Locker code delivered when seller marks "loaded"
- Auto-cancel if seller doesn't confirm within 24h

#### Ratings
- Buyer rates seller after collection (1–5 stars + comment)
- Seller rating shown on profile and listing cards

#### Admin
- Seller verification queue
- Listing moderation
- Basic analytics dashboard

### Post-MVP (Phase 2)
- SMS notifications
- Multi-seller cart
- Repeat order / subscription boxes
- Seller analytics
- Promoted listings (paid)
- Mobile app (React Native or PWA)
- izipizi locker API deep integration (auto-booking)

---

## 7. Design System (Vinted-Inspired)

### Layout
- Fixed top nav: logo | search bar | [Sell] CTA | auth links
- Max-width container with responsive grid
- Sidebar filters (desktop) → bottom sheet filters (mobile)

### Color Palette (TBD — pending izipizi brand guidelines)
- Primary: to match izipizi.lv branding (likely green/teal)
- Background: white / very light grey
- Text: near-black (#1a1a1a)
- Accent: brand primary
- Success/trust: green
- Warning: amber

### Typography
- Font: Inter or similar clean sans-serif
- Scale: 12/14/16/20/24/32px

### Components
- **ListingCard**: portrait image (3:4 ratio) + title + seller name + price + freshness badge + locker tag
- **SellerBadge**: avatar + name + star rating + verified icon
- **LockerMap**: interactive map (Mapbox or Leaflet)
- **FilterSidebar**: collapsible sections
- **CheckoutStepper**: 3-step (cart → locker → payment)

---

## 8. Data Model (High-Level)

```
users
  id, email, role (buyer|seller), created_at

seller_profiles
  id, user_id, farm_name, bio, location, avatar_url, verified, rating_avg

listings
  id, seller_id, title, description, category, price, unit, quantity,
  freshness_date, status, created_at, locker_ids[]

listing_photos
  id, listing_id, url, order

lockers
  id, name, address, city, lat, lng, izipizi_locker_id

orders
  id, buyer_id, seller_id, listing_id, locker_id, status,
  quantity, total_price, locker_code, created_at

ratings
  id, order_id, buyer_id, seller_id, stars, comment, created_at
```

---

## 9. Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | Next.js 14+ (App Router) | SSR/SSG for SEO, file-based routing |
| Styling | Tailwind CSS + shadcn/ui | Fast, consistent, accessible |
| Database | Supabase Postgres | Auth + DB + Storage + Realtime in one |
| Auth | Supabase Auth | Magic link, social OAuth |
| Storage | Supabase Storage | Listing photos, seller avatars |
| Payments | TBD (Stripe preferred) | Wide support, good DX |
| Maps | TBD (Leaflet/Mapbox) | Locker proximity view |
| Hosting | Vercel | Next.js-native, preview deployments |
| Domain | tirgus.izipizi.lv | Custom domain via Vercel DNS |
| VCS | Git → GitHub | Standard, integrates with Vercel |

---

## 10. Open Questions

| # | Question | Impact |
|---|----------|--------|
| 1 | izipizi locker API — does one exist? | Core fulfillment flow |
| 2 | Payment provider — Stripe, Paysera, or other? | Checkout implementation |
| 3 | Site languages — LV only, LV+EN, LV+EN+RU? | i18n complexity |
| 4 | Seller onboarding — manual approval or instant? | Trust model |
| 5 | Commission model — % per sale, subscription, free? | Revenue + payout logic |
| 6 | Returns policy — who handles disputes? | Policy pages + support flow |
| 7 | izipizi branding/design system to follow? | Visual design constraints |
| 8 | How many lockers and which cities? | Locker seed data, map scope |
| 9 | MVP launch target date? | Scope decisions |
| 10 | Any existing user base to import? | Onboarding strategy |

---

## 11. Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| No izipizi locker API → manual locker booking | Medium | Build manual flow first, API later |
| Low seller adoption | Medium | Simple onboarding, mobile-first listing creation |
| Food safety/legal compliance | Medium | Disclaimer pages, seller responsibility policy |
| Payment provider approval delays | Low | Start Stripe integration early |

---

## 12. Milestones

| Phase | Deliverable | Status |
|-------|------------|--------|
| 0 | PRD + CLAUDE.md | Done |
| 1 | Project scaffold (Next.js + Supabase + Vercel) | Pending |
| 2 | Auth + seller/buyer profiles | Pending |
| 3 | Listings CRUD + photo upload | Pending |
| 4 | Browse + search + filters | Pending |
| 5 | Cart + checkout + payments | Pending |
| 6 | Orders + fulfillment flow | Pending |
| 7 | Ratings + admin dashboard | Pending |
| 8 | QA + domain setup + launch | Pending |
