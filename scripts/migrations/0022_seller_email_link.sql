-- Migration 0022: link legacy sellers to auth.users by email.
--
-- Most sellers were imported from the old PHP/MySQL marketplace and have
-- `sellers.user_id IS NULL` — they have no Supabase Auth account yet. When
-- they sign up (via magic link / password reset / normal register), we need
-- to attach their auth.users.id to the existing sellers row so they land in
-- their existing seller dashboard with their products already there, instead
-- of starting a fresh empty profile.
--
-- The link key is email — admin enters it via /admin/razotaji, and on the
-- next auth.users INSERT with that email the trigger below updates
-- sellers.user_id automatically.

-- ─────────────────────────────────────────────────────────────────────
-- 1. Email column + indexes
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE sellers
  ADD COLUMN IF NOT EXISTS email text;

-- Case-insensitive uniqueness so two sellers can't share an email.
-- WHERE clause makes it a partial index — sellers without email don't
-- collide on NULL.
CREATE UNIQUE INDEX IF NOT EXISTS idx_sellers_email_unique
  ON sellers (lower(email))
  WHERE email IS NOT NULL;

-- Fast lookup for the trigger (only unlinked sellers matter here).
CREATE INDEX IF NOT EXISTS idx_sellers_email_unlinked
  ON sellers (lower(email))
  WHERE user_id IS NULL AND email IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- 2. Trigger: when an auth.users row is inserted, link any matching seller
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.link_seller_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE sellers
     SET user_id = NEW.id,
         updated_at = now()
   WHERE lower(email) = lower(NEW.email)
     AND user_id IS NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_link_seller ON auth.users;
CREATE TRIGGER on_auth_user_created_link_seller
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.link_seller_on_signup();

-- ─────────────────────────────────────────────────────────────────────
-- 3. One-time backfill: if any sellers already have email AND there's
--    already an auth.users row with the same email (e.g. the seller
--    self-registered before we filled in their email), link them now.
-- ─────────────────────────────────────────────────────────────────────

UPDATE sellers s
   SET user_id = u.id, updated_at = now()
  FROM auth.users u
 WHERE s.user_id IS NULL
   AND s.email IS NOT NULL
   AND lower(u.email) = lower(s.email);
