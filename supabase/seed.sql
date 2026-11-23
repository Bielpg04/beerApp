-- Local development seed data. Runs after migrations on `supabase db reset`.

-- ---------- beer catalog (US-201) ----------
-- A complete beer, one with only the essentials, and a duplicate merged into the first.
-- Barcodes starting with 2 are in-store codes, so they never clash with real products.
insert into public.breweries (id, name, name_key, country, city, source, obdb_id)
values ('b0000000-0000-0000-0000-000000000001', 'Brouwerij Westmalle', 'westmalle', 'BE', 'Westmalle', 'obdb', 'seed-westmalle');

insert into public.beers (id, name, name_key, brand, brand_key, brewery_id, style_code, abv, country, image_url, image_thumb_url, source)
values
  ('beef0000-0000-0000-0000-000000000001', 'Westmalle Tripel', 'tripel', 'Westmalle', 'westmalle',
   'b0000000-0000-0000-0000-000000000001', 'trappist', 9.5, 'BE',
   'https://images.openfoodfacts.org/images/products/541/020/474/0018/front_en.3.400.jpg',
   'https://images.openfoodfacts.org/images/products/541/020/474/0018/front_en.3.200.jpg', 'off'),
  ('beef0000-0000-0000-0000-000000000002', 'Coors Light', 'coors light', 'Coors Light', 'coors light',
   null, null, null, null, null, null, 'off'),
  ('beef0000-0000-0000-0000-000000000003', 'Westmalle Trappist Tripel', 'trappist tripel', 'Westmalle', 'westmalle',
   'b0000000-0000-0000-0000-000000000001', 'trappist', 9.5, 'BE', null, null, 'off');

update public.beers set merged_into = 'beef0000-0000-0000-0000-000000000001'
where id = 'beef0000-0000-0000-0000-000000000003';

insert into public.beer_barcodes (barcode, beer_id)
values
  ('5410204740018', 'beef0000-0000-0000-0000-000000000001'),
  ('0071990301033', 'beef0000-0000-0000-0000-000000000002'),
  ('2000000000015', 'beef0000-0000-0000-0000-000000000003');
