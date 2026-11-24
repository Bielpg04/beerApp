-- US-401-T5 · Find people by the start of their username, to send them a request.
-- Minimal on purpose: the unified search (US-1001, S6) will replace it.

create function public.find_people(q text, max int default 20)
returns table (id uuid, username text, display_name text, avatar_path text, relationship text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  term text := lower(regexp_replace(coalesce(q, ''), '[@\s]', '', 'g'));
  pattern text;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if char_length(term) < 2 then
    return;
  end if;
  -- % and _ are literal characters here, not wildcards.
  pattern := replace(replace(replace(term, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
  select
    p.id,
    p.username::text,
    p.display_name,
    p.avatar_path,
    case
      when f.status = 'accepted' then 'friends'
      when f.status = 'pending' and f.requested_by = uid then 'outgoing'
      when f.status = 'pending' then 'incoming'
      else 'none'
    end
  from public.profiles p
  left join public.friendships f
    on f.user_low = least(p.id, uid) and f.user_high = greatest(p.id, uid)
  where p.onboarded_at is not null
    and p.id <> uid
    and lower(p.username::text) like pattern escape '\'
  order by (lower(p.username::text) = term) desc, p.username
  limit least(greatest(coalesce(max, 20), 1), 20);
end;
$$;

revoke execute on function public.find_people(text, int) from public, anon;
grant execute on function public.find_people(text, int) to authenticated;
