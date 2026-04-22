# CLAUDE.md — tirgus.izipizi.lv Marketplace

## Project Overview
B2C marketplace at `tirgus.izipizi.lv` for Latvian farmers and food producers to sell goods via izipizi parcel lockers. Buyers discover nearby listings and pick up orders from lockers.

## Tech Stack
- **Frontend**: Next.js (App Router) + TypeScript + Tailwind CSS
- **Backend**: Supabase (Postgres + Auth + Storage + Realtime)
- **Hosting**: Vercel (with custom domain tirgus.izipizi.lv)
- **Version Control**: Git (GitHub)
- **Design Reference**: vinted.com

## Current Status
- [x] PRD written (`PRD.md`)
- [x] CLAUDE.md created (this file)
- [x] Project scaffolded (all files written, awaiting `npm install`)
- [ ] Node.js installed by user
- [ ] `npm install` run
- [ ] `npm run dev` tested
- [ ] GitHub repo created
- [ ] Deployed to Vercel
- [ ] Domain configured (tirgus.izipizi.lv)
- [ ] Supabase — DEFERRED (add when ready for auth/DB)

## Approach Decision
No Supabase/database for MVP. Pure frontend with mock data. Add backend incrementally later.

## Key Files Created
| File | Purpose |
|------|---------|
| `PRD.md` | Full product requirements document |
| `CLAUDE.md` | This file — project context for Claude |

## Architecture Decisions (TBD pending user answers)
- Auth: Supabase Auth (email + magic link, possibly Google OAuth)
- Payments: TBD — need user input (Stripe? Local Latvian provider?)
- Languages: TBD — likely Latvian + possibly Russian/English
- Locker integration: TBD — need izipizi API details

## Confirmed Decisions
- locker API: exists (details TBD)
- Payment: Paysera
- Language: Latvian only
- Seller approval: admin manual approval
- Revenue: commission model
- Brand: follow izipizi.lv (green-based, WebFetch couldn't extract exact hex — needs user input)
- Lockers: 6 locations (see mock-data.ts)
- MVP: no DB, static pages first

## Open Questions
- Exact izipizi brand hex colors? (currently using green placeholder #16a34a)
- Commission rate %?
- izipizi locker API docs / endpoint URL?

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
- Color: appears white/light with teal/green accent (Vinted brand)

## Notes for Future Claude Sessions
- User: Dzenis (dzenis.rolands@gmail.com), building for izipizi.lv parcel locker network
- This is a greenfield project — no existing codebase
- Start with Next.js App Router scaffold when user confirms tech choices
- All work tracked here and in PRD.md
