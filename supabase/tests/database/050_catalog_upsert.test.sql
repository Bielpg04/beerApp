-- US-201-T4 · Catalog upsert policy: stable ids, no renames, barcodes added, user beers untouched.
begin;
create extension if not exists pgtap with schema extensions;

select plan(25);

create function pg_temp.grp(
  name text, name_key text, codes text[], abv numeric default null, brand text default 'Heineken',
  brand_key text default 'heineken', image text default null
) returns jsonb language sql as $$
  select jsonb_build_object(
    'name', name, 'nameKey', name_key, 'brand', brand, 'brandKey', brand_key,
    'abv', abv, 'styleCode', 'lager', 'country', 'NL', 'imageUrl', image, 'imageThumbUrl', image,
    'barcodes', (select coalesce(jsonb_agg(jsonb_build_object('code', c, 'offLastModified', '2026-01-01T00:00:00Z')), '[]')
                 from unnest(codes) c)
  );
$$;

-- ---------- create, then re-import ----------

create temp table ids (label text primary key, id uuid);

insert into ids values ('heineken', catalog_import.upsert_beer(
  pg_temp.grp('Heineken', 'heineken', array['8712000025649', '0072890000224'], 5)));
select is((select count(*)::int from public.beers where brand_key = 'heineken'), 1, 'first import creates one beer');
select is(
  (select count(*)::int from public.beer_barcodes where beer_id = (select id from ids where label = 'heineken')), 2,
  'with both barcodes'
);
select is(
  (select source || '/' || status from public.beers where id = (select id from ids where label = 'heineken')),
  'off/approved', 'imported beers are approved OFF beers'
);

select is(
  catalog_import.upsert_beer(pg_temp.grp('Heineken', 'heineken', array['8712000025649', '0072890000224'], 5)),
  (select id from ids where label = 'heineken'), 'the same group again returns the same id'
);
select is((select count(*)::int from public.beers where brand_key = 'heineken'), 1, 'and creates nothing new');

select is(
  catalog_import.upsert_beer(pg_temp.grp('Heineken Premium', 'premium', array['8712000025649'], 5)),
  (select id from ids where label = 'heineken'), 'a renamed product with a known barcode keeps its beer id'
);
select is(
  (select name from public.beers where id = (select id from ids where label = 'heineken')), 'Heineken',
  'and the beer is not renamed'
);

select lives_ok(
  $$ select catalog_import.upsert_beer(pg_temp.grp('Heineken', 'heineken', array['8712000025649'], 5.2)) $$,
  'a new ABV is accepted'
);
select is((select abv from public.beers where brand_key = 'heineken'), 5.20::numeric(4, 2), 'and stored');
select lives_ok(
  $$ select catalog_import.upsert_beer(pg_temp.grp('Heineken', 'heineken', array['8712000025649'], null)) $$,
  'an empty ABV is accepted'
);
select is((select abv from public.beers where brand_key = 'heineken'), 5.20::numeric(4, 2), 'but keeps the previous value');

select is(
  catalog_import.upsert_beer(pg_temp.grp('Heineken', 'heineken', array['8712000025649', '4006381333931'])),
  (select id from ids where label = 'heineken'), 'a new barcode of a known beer'
);
select is(
  (select beer_id from public.beer_barcodes where barcode = '4006381333931'), (select id from ids where label = 'heineken'),
  'is added to that beer'
);

-- ---------- user beers are never changed ----------

insert into public.beers (id, name, name_key, brand, brand_key, source, abv)
values ('20000000-0000-0000-0000-000000000001', 'Homebrew', 'homebrew', 'Me', 'me', 'user', 6);
insert into public.beer_barcodes (barcode, beer_id) values ('96385074', '20000000-0000-0000-0000-000000000001');

select is(
  catalog_import.upsert_beer(pg_temp.grp('Other', 'other', array['96385074'], 4, 'Other', 'other')),
  '20000000-0000-0000-0000-000000000001'::uuid, 'a group with a user beer''s barcode resolves to that beer'
);
select is(
  (select name || '/' || abv from public.beers where id = '20000000-0000-0000-0000-000000000001'), 'Homebrew/6.00',
  'without changing it'
);

-- ---------- barcodes split between two beers ----------

insert into public.beers (id, name, name_key, brand, brand_key, source, created_at)
values
  ('30000000-0000-0000-0000-000000000001', 'Old', 'old', 'Dup', 'dup', 'off', now() - interval '2 days'),
  ('30000000-0000-0000-0000-000000000002', 'New', 'new', 'Dup', 'dup', 'off', now() - interval '1 day');
insert into public.beer_barcodes (barcode, beer_id)
values ('0012345678905', '30000000-0000-0000-0000-000000000001'), ('5410228142249', '30000000-0000-0000-0000-000000000002');

insert into catalog_import.staged_groups (payload)
values (pg_temp.grp('Dup', 'dup', array['0012345678905', '5410228142249', '5000112548167'], null, 'Dup', 'dup'));
select results_eq(
  'select created, updated, barcodes_added, conflicts from catalog_import.merge()',
  $$ values (0, 1, 1, 1) $$,
  'merge reports one updated beer, one new barcode and one conflict'
);
select is(
  (select beer_id from public.beer_barcodes where barcode = '5000112548167'), '30000000-0000-0000-0000-000000000001'::uuid,
  'new barcodes of a split group go to the oldest beer'
);
select is((select count(*)::int from catalog_import.staged_groups), 0, 'merge empties the staging table');

-- ---------- breweries ----------

insert into public.breweries (name, name_key, country, source, obdb_id)
values ('Sierra Nevada Brewing Co.', 'sierra nevada', 'US', 'obdb', 'sn'),
       ('Twin A', 'twin', 'DE', 'obdb', 't1'), ('Twin B', 'twin', 'BE', 'obdb', 't2');

insert into ids values ('sierra', catalog_import.upsert_beer(
  pg_temp.grp('Pale Ale', 'pale ale', array['0083783375251'], 5.6, 'Sierra Nevada', 'sierra nevada')));
select is(
  (select br.name || '/' || b.country from public.beers b join public.breweries br on br.id = b.brewery_id
   where b.id = (select id from ids where label = 'sierra')),
  'Sierra Nevada Brewing Co./US', 'a brand matching one brewery links it and takes its country'
);
select is(
  (select brewery_id from public.beers where id = catalog_import.upsert_beer(
     pg_temp.grp('Twin', 'twin', array['0087692000051'], null, 'Twin', 'twin'))),
  null, 'a brand matching two breweries stays without brewery'
);

-- ---------- manual merge ----------

select catalog_import.merge_beers('30000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001');
select is(
  (select merged_into from public.beers where id = '30000000-0000-0000-0000-000000000002'),
  '30000000-0000-0000-0000-000000000001'::uuid, 'merge_beers redirects the duplicate'
);
select is(
  (select beer_id from public.beer_barcodes where barcode = '5410228142249'), '30000000-0000-0000-0000-000000000001'::uuid,
  'and moves its barcodes'
);

-- ---------- live lookup rate limit ----------

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'a@example.com');
insert into catalog_import.lookups (user_id, created_at)
select '00000000-0000-0000-0000-00000000000a', now() - interval '61 minutes';
insert into catalog_import.lookups (user_id, created_at)
select '00000000-0000-0000-0000-00000000000a', now() from generate_series(1, 29);
select ok(public.catalog_register_lookup('00000000-0000-0000-0000-00000000000a'), 'the 30th lookup in an hour is allowed');
select ok(not public.catalog_register_lookup('00000000-0000-0000-0000-00000000000a'), 'the 31st is refused');

-- ---------- only service_role writes ----------

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select public.catalog_upsert_beer('{}') $$, '42501', null, 'signed-in users cannot write the catalog');

select * from finish();
rollback;
