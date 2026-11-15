import postgres from 'postgres';

/** Local Supabase by default; CATALOG_DB_URL for dev/prod (session pooler URL). */
export function connect(
  url = process.env.CATALOG_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
) {
  return postgres(url, { max: 1, onnotice: () => {} });
}
