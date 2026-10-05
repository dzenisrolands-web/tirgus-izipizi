-- Adds JSONB `variants` column to listings.
-- Variant shape: [{ id, title, price, quantity }]
-- When set, the listing page renders <VariantSelector /> instead of a single
-- price + "Add to cart" button. Catalog cards display the listing's `price`
-- column as the "no €X" minimum, which migration 0015 sets to MIN(variant.price).

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS variants JSONB;

-- Optional integrity hint: when variants is set, it must be a non-empty array.
-- (Not enforced as a CHECK constraint — keeping flexible for future shapes.)
COMMENT ON COLUMN listings.variants IS
  'Optional JSONB array of {id,title,price,quantity}. When set, overrides the single price/unit on the listing page.';
