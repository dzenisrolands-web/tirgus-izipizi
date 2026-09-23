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
- [x] Paysera payment integration (create-session, webhook, retry, diagnostics)
- [x] Locker code delivery — SMS via Esteria + email with PIN on `shipped`
- [x] Auto-cancel unconfirmed orders (72h, not 24h — changed 2026-07-10)
- [x] Fixed commission system (15%, automatic, all products)
- [x] Role separation — super admin via `app_metadata`, buyer/seller switcher
- [x] Self-billing invoices + automatic generation (cron on 1st and 16th)
- [x] Seller payouts / bank details UI (IBAN + auto bank/SWIFT lookup)
- [x] Seller invitation system (batch import, auto-send, funnel tracking)
- [x] Admin: pakomāti, sūtījumi, lietotāji, e-pasta šabloni, impersonation
- [x] Delivery fee per seller per address + commission per product
- [ ] izipizi locker API integration (manual PIN entry only)
- [ ] Buyer bonus system (not started — promo credits exist, different thing)
- [ ] Automatic refunds on cancellation (Paysera webhook does not handle)

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
| `lib/commission.ts` | Fixed commission rate config (15%) |
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
- **Use cases live**: seller followers notified on new hot drops; bell icon shows unread count via `components/notifications-bell.tsx`; order status changes (processing / shipped / delivered) notify the buyer
- **SMS**: Esteria API via `lib/sms.ts` — sends the locker PIN when an order is
  marked `shipped`. Latin-only (auto-transliterates Latvian), 160 char cap.
- **Email**: Resend via `lib/email.ts`, templates editable in `/admin/e-pasti`
  and stored in the `email_templates` table

## Payment Status (Paysera)
- **Status**: LIVE. Full checkout flow works end to end.
- **Provider**: Paysera (Latvian, SEPA + cards), project under SIA IziPizi
- **Endpoints**:
  - `/api/checkout/create-session` — builds the Paysera request
  - `/api/webhooks/paysera` — payment confirmation callback
  - `/api/checkout/retry-payment` — retry for failed attempts
  - `/api/admin/paysera-diagnostics` — config troubleshooting
- **Webhook fallback**: `/cart/success` self-confirms payment if the callback is
  delayed, so a slow webhook cannot strand a paid order
- **Env**: `PAYSERA_MODE` (live/test/mock), `PAYSERA_PROJECT_ID`,
  `PAYSERA_SIGN_PASSWORD`. `mock` skips Paysera entirely — used by E2E tests.
- **Still missing**: automatic refunds on cancellation (handled manually today)

## Confirmed Decisions
- Auth: Supabase Auth — email/password + magic link + Google OAuth
- Super admin: `app_metadata.is_super_admin`, checked via `lib/admin-auth.ts`.
  Never `profiles.role` — the client token can read that, so it is not a
  trust boundary.
- Payment: Paysera, live
- Language: Latvian only
- Locker integration: manual workflow — seller types the PIN by hand
- Seller approval: admin manual approval (`/admin/razotaji`), but new products
  go live immediately without waiting for review
- Revenue: fixed 15% commission on all products (`lib/commission.ts`)
- Operator: SIA IziPizi (migrated from SIA Svaigi 2026-08, migration 0023)
- Delivery: courier 3.50 EUR charged once per seller per address; locker free
- Brand colors: izipizi green `#53F3A4`, purple `#AD47FF`, dark navy `#192635`
- MVP: real Supabase DB in use; mock data retained for dev fallback

## Open Questions
- izipizi locker API docs / endpoint URL?
- Buyer bonus system — exact bonus rules / point economy?
- Repo consolidation — which Supabase project survives, and does `user_roles`
  replace `profiles.role`? (see the monorepo consolidation plan)

## Current Priorities
1. **Repo consolidation** — merge the `izipizi` monorepo and this repo into one
   Turborepo on a single Supabase project
2. **Commission bug** — `sellerNetWithVat()` in `lib/commission.ts` hardcodes a
   21% VAT assumption via `commissionForPrice()`, so 5% and 12% VAT products
   are calculated incorrectly
3. **izipizi locker API** — replace manual PIN entry
4. **Automatic refunds** — Paysera webhook does not handle cancellations
5. **Buyer bonus system** — still only an idea

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

## Notes for Future Sessions
- User: Dzenis (dzenis.rolands@gmail.com), building for the izipizi.lv parcel
  locker network
- The site is **live and taking real orders**. Anything touching checkout,
  invoices or the orders table needs care.
- Migrations live in `scripts/migrations/` (0001–0029). Some earlier schema was
  applied straight in the Supabase dashboard, so the directory is not a
  complete history — verify against the live schema before assuming.
- There is a **second repo**, `izipizi` (Turborepo, github.com/dzenisrolands-web/izipizi),
  holding the logistics domain and a stale copy of this app. It is mid-migration
  and paused. Do not add features there — this repo is the source of truth.
- `/admin/pakomati` and `/api/admin/sutijumi` read a **different Supabase
  project** (izipizi-web) via `IZP_SUPABASE_*` env vars. Temporary, until the
  databases are merged.
- All work tracked here and in `PRD.md`
