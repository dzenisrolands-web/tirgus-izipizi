-- PROPOSAL ONLY: requires explicit approval and actual-schema inspection.
-- Not in supabase/migrations; not executed or automatically applied.
-- No backfill: NULL means unknown, including allergens (not "allergen-free").
BEGIN;
ALTER TABLE public.listings
  ADD COLUMN ingredients text,
  ADD COLUMN allergens text[],
  ADD COLUMN net_quantity numeric(12,3),
  ADD COLUMN net_unit text,
  ADD COLUMN storage_conditions text,
  ADD COLUMN food_business_name text,
  ADD COLUMN food_business_address text,
  ADD COLUMN country_of_origin text,
  ADD COLUMN nutrition jsonb;

ALTER TABLE public.listings
  ADD CONSTRAINT listings_net_quantity_unit_valid CHECK (
    (net_quantity IS NULL AND net_unit IS NULL)
    OR (net_quantity IS NOT NULL AND net_unit IS NOT NULL
      AND net_quantity > 0 AND net_unit IN ('g','kg','ml','l','gab'))
  ),
  ADD CONSTRAINT listings_allergens_eu14_valid CHECK (
    allergens IS NULL OR allergens <@ ARRAY[
      'cereals_gluten','crustaceans','eggs','fish','peanuts','soybeans','milk',
      'tree_nuts','celery','mustard','sesame','sulphites','lupin','molluscs'
    ]::text[]
  ),
  ADD CONSTRAINT listings_food_text_nonempty CHECK (
    (ingredients IS NULL OR length(btrim(ingredients)) > 0)
    AND (storage_conditions IS NULL OR length(btrim(storage_conditions)) > 0)
    AND (food_business_name IS NULL OR length(btrim(food_business_name)) > 0)
    AND (food_business_address IS NULL OR length(btrim(food_business_address)) > 0)
    AND (country_of_origin IS NULL OR length(btrim(country_of_origin)) > 0)
  ),
  ADD CONSTRAINT listings_nutrition_object_valid CHECK (
    nutrition IS NULL OR (
      jsonb_typeof(nutrition) = 'object'
      AND nutrition ?& ARRAY['basis','energy_kj','energy_kcal','fat','saturates',
        'carbohydrate','sugars','protein','salt']
      AND jsonb_typeof(nutrition->'basis') = 'string'
      AND nutrition->>'basis' IN ('100g','100ml')
      AND jsonb_typeof(nutrition->'energy_kj') = 'number'
      AND jsonb_typeof(nutrition->'energy_kcal') = 'number'
      AND jsonb_typeof(nutrition->'fat') = 'number'
      AND jsonb_typeof(nutrition->'saturates') = 'number'
      AND jsonb_typeof(nutrition->'carbohydrate') = 'number'
      AND jsonb_typeof(nutrition->'sugars') = 'number'
      AND jsonb_typeof(nutrition->'protein') = 'number'
      AND jsonb_typeof(nutrition->'salt') = 'number'
      AND NOT jsonb_path_exists(nutrition, '$.* ? (@.type() == "number" && @ < 0)')
    )
  );
COMMIT;
-- No RLS/grant changes, price/tariff/payment changes or historical data writes.
-- Required-field exemptions and publication policy must be approved separately.
