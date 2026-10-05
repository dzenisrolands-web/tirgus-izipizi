-- Dienas produkts: automātiska publicēšana uz Instagram (tirgus.izipizi.lv)
-- un Facebook (svaigi.lv). Viena rinda = viena diena.
-- Lasa/raksta tikai serveris ar service-role atslēgu (RLS bez politikām).

create table if not exists public.social_daily_posts (
  id            uuid primary key default gen_random_uuid(),
  post_date     date not null unique,              -- Rīgas laika diena
  listing_id    uuid not null references public.listings(id) on delete cascade,
  product_url   text not null,
  image_url     text not null,
  copy          jsonb not null,                    -- { facebook, instagram }
  status        text not null default 'draft'
                check (status in ('draft', 'published', 'partial', 'failed', 'skipped')),
  fb_post_id    text,
  ig_media_id   text,
  ig_story_id   text,
  error         text,
  created_at    timestamptz not null default now(),
  published_at  timestamptz
);

create index if not exists social_daily_posts_listing_idx
  on public.social_daily_posts (listing_id, post_date desc);

alter table public.social_daily_posts enable row level security;

-- Aizsardzības slānis zem RLS: ne anon, ne ielogoti lietotāji šai tabulai nepiekļūst vispār.
-- (RLS bez politikām jau bloķē rindas; REVOKE novērš arī pašu piekļuvi tabulai.)
-- Serveris lieto service role, kas abus apiet.
revoke all on public.social_daily_posts from anon, authenticated;
