-- Base extensions required by the schema.
begin;
create extension if not exists pgtap with schema extensions;

select plan(3);

select has_extension('postgis', 'PostGIS is installed');
select has_extension('pg_trgm', 'pg_trgm is installed (fuzzy search)');
select has_extension('unaccent', 'unaccent is installed (accent-insensitive search)');

select * from finish();
rollback;
