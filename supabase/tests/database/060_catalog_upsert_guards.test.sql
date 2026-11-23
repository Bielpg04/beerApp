-- Sprint 2 review: re-imports only touch rows that change, keep known dates, link breweries
-- with unknown countries correctly, and old live lookups are purged.
begin;
create extension if not exists pgtap with schema extensions;

select plan(13);

create function pg_temp.grp(
  name_key text, codes text[], abv numeric default null, brand_key text default 'guard',
  modified text default '2026-01-01T00:00:00Z'
) returns jsonb language sql as $$
  select jsonb_build_object(
    'name', name_key, 'nameKey', name_key, 'brand', brand_key, 'brandKey', brand_key,
    'abv', abv, 'styleCode', 'lager', 'country', 'NL', 'imageUrl', 'https://img/x.jpg',
    'imageThumbUrl', 'https://img/x_small.jpg',
    'barcodes', (select coalesce(jsonb_agg(jsonb_build_object('code', c, 'offLastModified', modified)), '[]')
                 from unnest(codes) c)
  );
$$;

-- Inside one transaction now() never moves, so backdate updated_at to see whether a re-import touches the row.
create function pg_temp.backdate(beer uuid) returns void language plpgsql as $$
begin
  alter table public.beers disable trigger beers_set_updated_at;
  update public.beers set updated_at = '2000-01-01' where id = beer;
  alter table public.beers enable trigger beers_set_updated_at;
end;
$$;

create temp table ids (label text primary key, id uuid);

-- ---------- an unchanged re-import does not touch the beer ----------

insert into ids values ('same', catalog_import.upsert_beer(pg_temp.grp('same', array['2999999000017'], 5.123)));
select pg_temp.backdate((select id from ids where label = 'same'));

select is(
  catalog_import.upsert_beer(pg_temp.grp('same', array['2999999000017'], 5.123)),
  (select id from ids where label = 'same'), 'the same group again finds the beer'
);
select is(
  (select updated_at from public.beers where id = (select id from ids where label = 'same')), '2000-01-01'::timestamptz,
  'but does not update it (an ABV with more decimals than stored counts as the same)'
);
select is(
  catalog_import.upsert_beer(pg_temp.grp('same', array['2999999000017'], null)),
  (select id from ids where label = 'same'), 'a group with less data finds it too'
);
select is(
  (select updated_at from public.beers where id = (select id from ids where label = 'same')), '2000-01-01'::timestamptz,
  'and does not update it either'
);

select catalog_import.upsert_beer(pg_temp.grp('same', array['2999999000017'], 6));
select isnt(
  (select updated_at from public.beers where id = (select id from ids where label = 'same')), '2000-01-01'::timestamptz,
  'a real change still updates the beer'
);
select is((select abv from public.beers where id = (select id from ids where label = 'same')), 6.00::numeric(4, 2), 'with the new value');

-- ---------- barcode dates ----------

select catalog_import.upsert_beer(pg_temp.grp('same', array['2999999000017'], 6, 'guard', null));
select is(
  (select off_last_modified from public.beer_barcodes where barcode = '2999999000017'), '2026-01-01T00:00:00Z'::timestamptz,
  'a re-import without a date keeps the known one'
);
select catalog_import.upsert_beer(pg_temp.grp('same', array['2999999000017'], 6, 'guard', '2026-06-01T00:00:00Z'));
select is(
  (select off_last_modified from public.beer_barcodes where barcode = '2999999000017'), '2026-06-01T00:00:00Z'::timestamptz,
  'a newer date replaces it'
);

-- ---------- breweries with unknown country ----------

insert into public.breweries (name, name_key, country, source, obdb_id)
values ('Solo Brewing', 'solo', null, 'obdb', 'test-s1'),
       ('Pair A', 'pair', null, 'obdb', 'test-p1'), ('Pair B', 'pair', null, 'obdb', 'test-p2'),
       ('Split', 'split', null, 'obdb', 'test-x1'), ('Split', 'split', 'US', 'obdb', 'test-x2');

-- Upsert first: a beer created inside a query is not visible to that same query.
insert into ids values
  ('solo', catalog_import.upsert_beer(pg_temp.grp('solo', array['2999999000024'], null, 'solo'))),
  ('pair', catalog_import.upsert_beer(pg_temp.grp('pair', array['2999999000031'], null, 'pair'))),
  ('split', catalog_import.upsert_beer(pg_temp.grp('split', array['2999999000048'], null, 'split')));

select is(
  (select br.name from public.beers b join public.breweries br on br.id = b.brewery_id
   where b.id = (select id from ids where label = 'solo')),
  'Solo Brewing', 'a brand matching one brewery without country links it'
);
select is(
  (select brewery_id from public.beers where id = (select id from ids where label = 'pair')),
  null, 'two different breweries without country are ambiguous'
);
select is(
  (select brewery_id from public.beers where id = (select id from ids where label = 'split')),
  null, 'the same name with and without country is ambiguous'
);

-- ---------- old live lookups are purged ----------

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-00000000000a', 'a@example.com'), ('00000000-0000-0000-0000-00000000000b', 'b@example.com');
insert into catalog_import.lookups (user_id, created_at)
values ('00000000-0000-0000-0000-00000000000b', now() - interval '61 minutes'),
       ('00000000-0000-0000-0000-00000000000b', now() - interval '10 minutes');

select ok(public.catalog_register_lookup('00000000-0000-0000-0000-00000000000a'), 'a lookup is registered');
select results_eq(
  $$ select user_id::text, created_at > now() - interval '1 hour' from catalog_import.lookups order by created_at $$,
  $$ values ('00000000-0000-0000-0000-00000000000b', true), ('00000000-0000-0000-0000-00000000000a', true) $$,
  'and lookups older than an hour, of any user, are deleted'
);

select * from finish();
rollback;
