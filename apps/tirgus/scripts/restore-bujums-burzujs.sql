-- ============================================================
-- Atjaunot izdzēstos pārdevējus: Bujums un austeru bārs BURŽUJS
-- Palaid Supabase SQL Editor
-- ============================================================

-- 1. Bujums
INSERT INTO sellers (slug, name, farm_name, logo_url, location, status, verified, rating, review_count, home_locker_ids, description)
VALUES (
  's7', 'Bujums', 'Bujums',
  'https://business.izipizi.lv/images/marketplace/logos/2424703logo-white-webp.webp',
  'Rīga', 'approved', true, 4.9, 84,
  ARRAY['brivibas', 'agenskalna'],
  'Bujums — Krimiludas saimniecība ar pelmeņiem, pankūkām, kombuču un citiem gardumiem.'
)
ON CONFLICT (slug) DO NOTHING
RETURNING id;

-- 2. austeru bārs BURŽUJS
INSERT INTO sellers (slug, name, farm_name, logo_url, location, status, verified, rating, review_count, home_locker_ids, description)
VALUES (
  's14', 'austeru bārs BURŽUJS', 'austeru bārs BURŽUJS',
  'https://business.izipizi.lv/images/marketplace/logos/3294566Burzujs-logo-reverse-jpg.jpg',
  'Rīga', 'approved', true, 4.9, 47,
  ARRAY['brivibas'],
  'austeru bārs BURŽUJS — svaigākās austeres un jūras veltes Rīgā.'
)
ON CONFLICT (slug) DO NOTHING
RETURNING id;

-- ============================================================
-- Produkti: Bujums (s7)
-- Pēc seller insert, aizstāj SELLER_ID_BUJUMS ar atgriezto id
-- ============================================================

-- SVARĪGI: Palaid šo atsevišķi PĒC tam, kad esi ieguvis seller ID!
-- Vai izmanto šo automātisko pieeju:

DO $$
DECLARE
  bujums_id uuid;
  burzujs_id uuid;
BEGIN
  SELECT id INTO bujums_id FROM sellers WHERE slug = 's7' LIMIT 1;
  SELECT id INTO burzujs_id FROM sellers WHERE slug = 's14' LIMIT 1;

  IF bujums_id IS NULL THEN
    RAISE EXCEPTION 'Bujums nav atrasts — vispirms jāinsertē sellers!';
  END IF;

  -- Bujums produkti
  INSERT INTO listings (slug, seller_id, title, description, price, unit, category, image_url, locker_id, quantity, status) VALUES
  ('l1', bujums_id, 'Pelmeņi vegānie', 'Pelmeņi vegānie no Bujums. 400g iepakojums.', 4.00, 'gab.', 'Saldēta pārtika', 'https://business.izipizi.lv/images/marketplace/products/4998684Pelmeni-veganie-webp.webp', 'brivibas', 10, 'active'),
  ('l2', bujums_id, 'Vistas gaļas pelmeņi', 'Vistas gaļas pelmeņi no Bujums. 400g.', 5.03, 'gab.', 'Saldēta pārtika', 'https://business.izipizi.lv/images/marketplace/products/4125043pelmeni-vistas-galas-webp.webp', 'salaspils', 11, 'active'),
  ('l3', bujums_id, 'Pelmeņi veģetārie', 'Siera un spinātu pelmeņi. 400g.', 5.37, 'gab.', 'Saldēta pārtika', 'https://business.izipizi.lv/images/marketplace/products/6875664pelmeni-vegetarie-webp.webp', 'agenskalna', 12, 'active'),
  ('l4', bujums_id, 'Pelmeņi bērniem', 'Krāsaini truša gaļas pelmeņi bērniem. 400g.', 6.28, 'gab.', 'Saldēta pārtika', 'https://business.izipizi.lv/images/marketplace/products/241788Pelmeni-berniem-webp.webp', 'tukums', 13, 'active'),
  ('l5', bujums_id, 'Pelmeņi ar siera un kūpinātas gaļas pildījumu', 'Siers + kūpināta gaļa pelmeņos. 400g.', 5.72, 'gab.', 'Saldēta pārtika', 'https://business.izipizi.lv/images/marketplace/products/1161383pelmeni-siera-un-kup-galas-webp.webp', 'dundaga', 14, 'active'),
  ('l6', bujums_id, 'Jēra gaļas pelmeņi', 'Jēra gaļas pelmeņi. 400g.', 6.53, 'gab.', 'Saldēta pārtika', 'https://business.izipizi.lv/images/marketplace/products/3045612pelmeni-jeragalas-webp.webp', 'ikskile', 15, 'active'),
  ('l7', bujums_id, 'Cūkgaļas pelmeņi', 'Cūkgaļas pelmeņi. 400g.', 5.89, 'kg', 'Saldēta pārtika', 'https://business.izipizi.lv/images/marketplace/products/9384041pelmeni-cukgalas-webp.webp', 'brivibas', 16, 'active'),
  ('l8', bujums_id, 'Brieža gaļas pelmeņi', 'Brieža gaļas pelmeņi. 400g.', 6.15, 'gab.', 'Saldēta pārtika', 'https://business.izipizi.lv/images/marketplace/products/4476674Pelmeni-Brieza-webp.webp', 'salaspils', 17, 'active'),
  ('l9', bujums_id, 'Pankūkas ar sieru un spinātiem', 'Pildītas pankūkas. 360g (4 gab).', 4.86, 'gab.', 'Saldēta pārtika', 'https://business.izipizi.lv/images/marketplace/products/4066818Pankukas-Spinatu-2-webp.webp', 'agenskalna', 18, 'active'),
  ('l10', bujums_id, 'Pankūkas ar sieru un kūpinātu cāļa gaļu', 'Pildītas pankūkas. 360g (4 gab).', 5.13, 'gab.', 'Saldēta pārtika', 'https://business.izipizi.lv/images/marketplace/products/2684866Pankukas-K-Cali-3-webp.webp', 'tukums', 19, 'active'),
  ('l11', bujums_id, 'Pankūkas ar cāļa gaļas pildījumu', 'Pildītas pankūkas ar cāļa gaļu. 360g.', 4.76, 'gab.', 'Saldēta pārtika', 'https://business.izipizi.lv/images/marketplace/products/2209666Pankukas-Cala-4-webp.webp', 'dundaga', 20, 'active'),
  ('l12', bujums_id, 'Pankūkas ar brieža gaļas pildījumu', 'Pildītas pankūkas ar brieža gaļu. 360g.', 5.65, 'gab.', 'Saldēta pārtika', 'https://business.izipizi.lv/images/marketplace/products/3528972Pankukas-Brieza-1-webp.webp', 'ikskile', 21, 'active'),
  ('l13', bujums_id, 'Cāļa gaļas burgeru kotletes', 'Burgerkotletes no cāļa gaļas. 400g (4 gab).', 5.11, 'gab.', 'Saldēta pārtika', 'https://business.izipizi.lv/images/marketplace/products/5520967Burgeri-Cala-16-webp.webp', 'brivibas', 22, 'active'),
  ('l14', bujums_id, 'Brieža gaļas burgeru kotletes', 'Burgerkotletes no brieža gaļas. 400g (4 gab).', 7.93, 'gab.', 'Saldēta pārtika', 'https://business.izipizi.lv/images/marketplace/products/233066Burgeri-Brieza-18-webp.webp', 'salaspils', 23, 'active'),
  ('l15', bujums_id, 'Mango-aprikožu zaļās tējas kombuča, 0,33L', 'Kombucha Factory. 0,33L.', 2.90, '33l', 'Dzērieni', 'https://business.izipizi.lv/images/marketplace/products/38128020260201-102313-png.png', 'agenskalna', 19, 'active'),
  ('l16', bujums_id, 'Upeņu-aveņu melnās tējas kombuča, 0,33L', 'Kombucha Factory. 0,33L.', 2.90, '33l', 'Dzērieni', 'https://business.izipizi.lv/images/marketplace/products/4847818gyujg-png.png', 'tukums', 20, 'active'),
  ('l24', bujums_id, 'Brieža maltās gaļas masa', 'Saldēta brieža maltā gaļa. 500g.', 7.00, 'gab.', 'Gaļa', 'https://business.izipizi.lv/images/marketplace/products/5866976brie-a-malt-ga-a-jfif.jfif', 'ikskile', 6, 'active'),
  ('l25', bujums_id, 'Paipalu olas', 'Paipalu olas 30 gab.', 5.50, 'gab.', 'Olas', 'https://business.izipizi.lv/images/marketplace/products/3837272facebook-1770717542678-7426927672127940456-jpg.jpg', 'brivibas', 18, 'active'),
  ('l26', bujums_id, 'Brieža gaļas konservi', 'BRIEŽA gaļas konservi. 250g.', 4.35, 'gab.', 'Konservi', 'https://business.izipizi.lv/images/marketplace/products/348299konservi-jfif.jfif', 'salaspils', 14, 'active'),
  ('l39', bujums_id, 'Tītara gaļas frikadeles, 220 g', '100% tītara gaļa. 220g.', 5.67, '220 g', 'Saldēta pārtika', 'https://business.izipizi.lv/images/marketplace/products/707686320260210-122843-png.png', 'agenskalna', 16, 'active'),
  ('l40', bujums_id, 'Truša gaļas frikadeles, 220 g', '100% truša gaļa. 220g.', 8.19, '220 g', 'Saldēta pārtika', 'https://business.izipizi.lv/images/marketplace/products/563392020260210-122826-png.png', 'tukums', 17, 'active'),
  ('l37', bujums_id, '"Sprīdīšu" olas M, 10 gab.', 'Brīvās turēšanas olas M.', 3.90, 'gab.', 'Olas', 'https://business.izipizi.lv/images/marketplace/products/2740558facebook-1770717389592-7426927030037824974-jpg.jpg', 'brivibas', 14, 'active'),
  ('l38', bujums_id, '"Sprīdīšu" olas L, 10 gab.', 'Brīvās turēšanas olas L.', 4.50, 'gab.', 'Olas', 'https://business.izipizi.lv/images/marketplace/products/1459799facebook-1770717415600-7426927139124478458-jpg.jpg', 'salaspils', 15, 'active')
  ON CONFLICT (slug) DO NOTHING;

  -- BURŽUJS produkti (ja burzujs_id nav null)
  IF burzujs_id IS NOT NULL THEN
    INSERT INTO listings (slug, seller_id, title, description, price, unit, category, image_url, locker_id, quantity, status) VALUES
    ('l76', burzujs_id, 'Austeres Super Speciale SIGNATURE, Īrija', 'Austeres Super Speciale no Īrijas.', 78.00, 'gab.', 'Zivis & jūras veltes', 'https://business.izipizi.lv/images/marketplace/products/austeres-signature.webp', 'brivibas', 5, 'active'),
    ('l77', burzujs_id, 'Austeres Super Speciale JOSEFINA, Francija', 'Franču austeres.', 34.00, 'gab.', 'Zivis & jūras veltes', 'https://business.izipizi.lv/images/marketplace/products/austeres-josefina.webp', 'brivibas', 5, 'active'),
    ('l78', burzujs_id, 'Austeres Mini Super Speciale AMULETTE', 'Mini austeres.', 44.00, 'gab.', 'Zivis & jūras veltes', 'https://business.izipizi.lv/images/marketplace/products/austeres-amulette.webp', 'brivibas', 5, 'active'),
    ('l79', burzujs_id, 'Austeres Super Speciale SELECTION', 'Selection austeres.', 44.00, 'gab.', 'Zivis & jūras veltes', 'https://business.izipizi.lv/images/marketplace/products/austeres-selection.webp', 'brivibas', 5, 'active'),
    ('l80', burzujs_id, 'Austeres Fine CELINE, Francija', 'Fine austeres no Francijas.', 21.00, 'gab.', 'Zivis & jūras veltes', 'https://business.izipizi.lv/images/marketplace/products/austeres-celine.webp', 'brivibas', 10, 'active'),
    ('l81', burzujs_id, 'Austeres Super Speciale POGET, Francija', 'Poget austeres.', 29.00, 'gab.', 'Zivis & jūras veltes', 'https://business.izipizi.lv/images/marketplace/products/austeres-poget.webp', 'brivibas', 8, 'active')
    ON CONFLICT (slug) DO NOTHING;
  END IF;

  RAISE NOTICE 'Bujums ID: %, BURŽUJS ID: %', bujums_id, burzujs_id;
END;
$$;
