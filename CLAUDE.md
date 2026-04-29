# CLAUDE.md — tirgus.izipizi.lv Marketplace

## Project Overview
B2C marketplace at `tirgus.izipizi.lv` for Latvian farmers and food producers to sell goods via izipizi parcel lockers. Buyers discover nearby listings and pick up orders from lockers.

## Tech Stack
- **Frontend**: Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 3.4
- **Backend**: Supabase (Postgres + Auth + Storage + Realtime)
- **Hosting**: Vercel (with custom domain tirgus.izipizi.lv)
- **Version Control**: Git (GitHub)
- **Animations**: Framer Motion + canvas-confetti
- **Design Reference**: vinted.com

## Current Status
- [x] PRD written (`PRD.md`)
- [x] CLAUDE.md created (this file)
- [x] Project scaffolded
- [x] `npm install` run, dev server working
- [x] GitHub repo created
- [x] Deployed to Vercel
- [x] Domain configured (tirgus.izipizi.lv)
- [x] Supabase wired (Auth + DB + Storage + Realtime all in use)
- [x] Auth: email/password, magic link, Google OAuth, password reset
- [x] Seller dashboard (profile editor, product CRUD, orders queue)
- [x] Admin panel (seller approval, listing moderation, stats)
- [x] Catalog + filters + search + sorting
- [x] Cart + checkout UI (locker selection, delivery choice)
- [x] Hot drops feature ("Karstie pīrādziņi") — flash sales with realtime + cron expiry
- [x] Recipes section linked to products
- [x] Image upload to Supabase Storage (avatar, cover, listing photos)
- [x] Web push notifications (VAPID + subscribe + send)
- [x] Ratings (1–5 stars + comments)
- [x] Seller followers
- [x] SEO: sitemap, robots, OG image
- [ ] Paysera payment integration — checkout dead-ends
- [ ] Locker code delivery (SMS/email when seller marks ready)
- [ ] Auto-cancel after 24h seller-confirm timeout
- [ ] izipizi locker API integration (manual booking only)
- [ ] Buyer bonus system (planned, not started)
- [ ] Seller payouts / bank details UI
- [ ] Commission deduction logic in checkout

## Approach Decision
Originally planned no DB for MVP, but Supabase has been fully integrated. Mock data (`lib/mock-data.ts`) still exists for fallback/dev but real DB queries are primary path.

## Key Files
| File | Purpose |
|------|---------|
| `PRD.md` | Full product requirements document |
| `CLAUDE.md` | This file — project context for Claude |
| `lib/supabase.ts` | Supabase client (browser + server) |
| `lib/db-listings.ts` | Listing queries |
| `lib/db-types.ts` | DB row TypeScript types |
| `lib/cart-context.tsx` | Cart state via React Context |
| `lib/hot-drops/` | Hot drops queries, types, badges, realtime hook |
| `lib/push.ts` | Web push send utility (VAPID) |
| `lib/mock-data.ts` | Fallback mock listings/sellers/lockers |
| `lib/recipes-data.ts` | Recipe definitions linked to product IDs |
| `app/api/push/` | Push subscribe + notify endpoints |
| `app/api/cron/expire-drops/` | Vercel cron to expire stale hot drops |

## Notification Infrastructure (Web Push)
- **Standard**: Web Push API with VAPID keys (no third-party service)
- **Env vars**: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`
- **Subscribe flow**: `components/PushSubscribeButton.tsx` → `POST /api/push/subscribe` → row in `push_subscriptions` table (user_id, endpoint, p256dh, auth)
- **Send flow**: `lib/push.ts` `sendPushToSubscriptions()` → `POST /api/push/notify` (server-side, uses `web-push` library with VAPID private key)
- **Use cases live**: seller followers notified on new hot drops; bell icon shows unread count via `components/notifications-bell.tsx`
- **Use cases TODO**: order status changes (confirmed → packed → ready), locker code delivery, admin approval result
- **No SMS/email** yet — push is the only out-of-band channel

## Payment Status (Paysera)
- **Status**: NOT integrated. Checkout UI is complete but the "Pay" button does not call any payment API.
- **Decision**: Paysera (Latvian provider, supports SEPA + cards)
- **Env placeholder**: commented out in `.env.example` — credentials not yet provisioned
- **What's missing**:
  1. Paysera merchant account + API credentials
  2. Server-side checkout session creation endpoint (`/api/checkout/create-session`)
  3. Webhook handler for payment confirmation (`/api/webhooks/paysera`)
  4. Order state transition: `pending_payment` → `paid` → seller notified
  5. Refund flow for cancellations
- **Blocker on**: revenue, hot drop reservations (currently reserve without payment), order finality

## Architecture Decisions (Confirmed)
- Auth: Supabase Auth — email/password + magic link + Google OAuth ✓ done
- Payments: Paysera (not yet wired)
- Languages: Latvian only
- Locker integration: manual workflow for MVP, API integration deferred

## Confirmed Decisions
- locker API: exists (details TBD, manual workflow used for now)
- Payment: Paysera (not yet integrated)
- Language: Latvian only
- Seller approval: admin manual approval (live in `/admin/razotaji`)
- Revenue: commission model (rate TBD)
- Brand colors: izipizi green `#53F3A4`, purple `#AD47FF`, dark navy `#192635` (in `tailwind.config.ts`)
- Lockers: 6 locations (see `lib/mock-data.ts`)
- MVP: real Supabase DB in use; mock data retained for dev fallback

## Open Questions
- Commission rate %?
- izipizi locker API docs / endpoint URL?
- Paysera merchant account — provisioned yet?
- Buyer bonus system — exact bonus rules / point economy?

## Current Priorities
1. **Paysera integration** — biggest blocker; without it, checkout cannot complete and hot drop reservations are not finalized
2. **Order status push notifications** — buyer needs locker code when seller marks "ready"
3. **Buyer bonus system** — outlined in memory, no code yet
4. **Seller payouts** — bank details capture + commission deduction in checkout
5. **24h auto-cancel** — Vercel cron similar to hot drop expiry

## Vinted Design Reference Notes
- Minimalist, clean, lots of whitespace
- Fixed header: logo + primary CTA ("Sell now") + auth links
- Catalog: 4-5 col responsive grid
- Product card: image (portrait ratio ~310x430) + brand + condition badge + size + price + engagement metric
- Left-side filter sidebar: category, size, brand, condition, color, price range, material
- Sort dropdown above grid
- Buyer protection fee shown inline on price
- "Bumped" recency indicator on cards
- Footer: social links + app download badges

## Notes for Future Claude Sessions
- User: Dzenis (dzenis.rolands@gmail.com), building for izipizi.lv parcel locker network
- Project is past scaffold stage — most MVP features are live; focus is on payment + notification polish
- Real DB schema lives in Supabase dashboard (no `.sql` migrations in repo) — read `lib/db-types.ts` and `lib/hot-drops/types.ts` for table shapes
- All work tracked here and in `PRD.md`
