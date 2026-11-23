-- US-301-T2 · Beer search for the create-post flow (the unified search arrives in S6).
-- Every word of the query must appear in "brand name" (lower-case, without accents).
-- Order: exact brand or name match, then most barcodes (a proxy for popularity in a
-- catalog with duplicates), then the shortest name. Runs as the caller, so the RLS on
-- beers decides which pending beers are visible (only your own).
create function public.search_beers(q text, max_results int default 20)
returns table (
  id uuid,
  name text,
  brand text,
  image_thumb_url text,
  abv numeric,
  style_code text
)
language sql
stable
set search_path = ''
as $$
  with query as (
    select lower(public.f_unaccent(trim(regexp_replace(q, '\s+', ' ', 'g')))) as text
  ),
  words as (
    select array_remove(string_to_array(query.text, ' '), '') as list, query.text from query
  )
  select b.id, b.name, b.brand, b.image_thumb_url, b.abv, b.style_code
  from public.beers b, words w
  where char_length(w.text) >= 2
    and b.merged_into is null
    and not exists (
      select 1 from unnest(w.list) word
      where position(word in lower(public.f_unaccent(b.brand || ' ' || b.name))) = 0
    )
  order by
    (lower(public.f_unaccent(b.brand)) = w.text or lower(public.f_unaccent(b.name)) = w.text) desc,
    (select count(*) from public.beer_barcodes bc where bc.beer_id = b.id) desc,
    char_length(b.name),
    b.id
  limit least(greatest(coalesce(max_results, 20), 1), 50);
$$;

revoke execute on function public.search_beers(text, int) from public, anon;
grant execute on function public.search_beers(text, int) to authenticated;
