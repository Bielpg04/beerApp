-- US-201-T1 · Beer catalog: read-only for signed-in users, barcode lookup, merged beers.
begin;
create extension if not exists pgtap with schema extensions;

select plan(26);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-00000000000a', 'a@example.com');

create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select has_table('public', 'beer_styles', 'beer_styles exists');
select has_table('public', 'breweries', 'breweries exists');
select has_table('public', 'beers', 'beers exists');
select has_table('public', 'beer_barcodes', 'beer_barcodes exists');

select results_eq(
  'select code from public.beer_styles order by sort_order',
  $$ values ('non_alcoholic'), ('trappist'), ('abbey'), ('sour'), ('fruit'), ('witbier'), ('wheat'), ('ipa'),
            ('pale_ale'), ('saison'), ('bock'), ('stout'), ('porter'), ('pilsner'), ('amber'), ('blonde'),
            ('dark'), ('lager') $$,
  'the 18 styles, in priority order'
);

-- ---------- barcode normalization ----------

select is(public.normalize_gtin('012345678905'), '0012345678905', 'UPC-A becomes GTIN-13');
select is(public.normalize_gtin('00012345678905'), '0012345678905', 'GTIN-14 with a leading 0 becomes GTIN-13');
select is(public.normalize_gtin('96385074'), '96385074', 'EAN-8 stays as it is');
select is(public.normalize_gtin(' 0012-3456-78905 '), '0012345678905', 'non-digits are ignored');
select is(public.normalize_gtin('0012345678906'), null, 'a wrong check digit is rejected');
select is(public.normalize_gtin('abc'), null, 'no digits is rejected');
select is(public.normalize_gtin('5410228142249'), '5410228142249', 'a valid EAN-13 stays as it is');

-- ---------- fixtures ----------

insert into public.beers (id, name, name_key, brand, brand_key, source)
values
  ('10000000-0000-0000-0000-00000000000a', 'Heineken', 'heineken', 'Heineken', 'heineken', 'off'),
  ('10000000-0000-0000-0000-00000000000b', 'Heineken Lager', 'heineken lager', 'Heineken', 'heineken', 'off');
update public.beers set merged_into = '10000000-0000-0000-0000-00000000000a'
where id = '10000000-0000-0000-0000-00000000000b';
insert into public.beers (id, name, name_key, brand, brand_key, source, status)
values ('10000000-0000-0000-0000-00000000000c', 'Pending', 'pending', 'X', 'x', 'user', 'pending');

insert into public.beer_barcodes (barcode, beer_id)
values
  ('0012345678905', '10000000-0000-0000-0000-00000000000a'),
  ('4006381333931', '10000000-0000-0000-0000-00000000000b'),
  ('5410228142249', '10000000-0000-0000-0000-00000000000c');

select throws_ok(
  $$ insert into public.beer_barcodes (barcode, beer_id) values ('5410204740010', '10000000-0000-0000-0000-00000000000a') $$,
  '23514', null, 'a barcode with a wrong check digit cannot be stored'
);

-- ---------- as a signed-in user ----------

select pg_temp.login_as('00000000-0000-0000-0000-00000000000a');
set local role authenticated;

select is((select count(*)::int from public.beers where id::text like '10000000-%'), 2, 'a signed-in user reads beers');
select throws_ok(
  $$ insert into public.beers (name, name_key, brand, brand_key, source) values ('x', 'x', 'x', 'x', 'user') $$,
  '42501', null, 'a signed-in user cannot insert beers'
);
select throws_ok(
  $$ update public.beers set name = 'hacked' $$,
  '42501', null, 'a signed-in user cannot update beers'
);
select throws_ok(
  $$ insert into public.beer_barcodes (barcode, beer_id) values ('96385074', '10000000-0000-0000-0000-00000000000a') $$,
  '42501', null, 'a signed-in user cannot insert barcodes'
);

select is(
  public.beer_by_barcode('012345678905'), '10000000-0000-0000-0000-00000000000a'::uuid,
  'a UPC-A scan finds the beer stored as EAN-13'
);
select is(
  public.beer_by_barcode('4006381333931'), '10000000-0000-0000-0000-00000000000a'::uuid,
  'a barcode of a merged beer resolves to the final beer'
);
select is(public.beer_by_barcode('5410228142249'), null, 'pending beers are not found by barcode');
select is(public.beer_by_barcode('96385074'), null, 'an unknown barcode returns null');
select is(
  public.resolve_beer('10000000-0000-0000-0000-00000000000b'), '10000000-0000-0000-0000-00000000000a'::uuid,
  'resolve_beer follows merged_into'
);
select is(
  public.resolve_beer('10000000-0000-0000-0000-00000000000a'), '10000000-0000-0000-0000-00000000000a'::uuid,
  'resolve_beer returns a final beer as it is'
);

select has_schema('catalog_import', 'catalog_import schema exists');
select throws_ok(
  $$ create table catalog_import.x (id int) $$,
  '42501', null, 'a signed-in user has no access to catalog_import'
);

-- ---------- anonymous ----------

reset role;
set local role anon;
select throws_ok('select count(*) from public.beers', '42501', null, 'anonymous users cannot read beers');

select * from finish();
rollback;
