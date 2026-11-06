export interface Env {
  supabaseUrl: string;
  supabaseKey: string;
}

/**
 * Reads public config from EXPO_PUBLIC_* variables (inlined at build time).
 * Fails fast with a clear message instead of a cryptic network error later.
 */
export function readEnv(source: Record<string, string | undefined>): Env {
  const supabaseUrl = source.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = source.EXPO_PUBLIC_SUPABASE_KEY;
  const missing = [
    !supabaseUrl && 'EXPO_PUBLIC_SUPABASE_URL',
    !supabaseKey && 'EXPO_PUBLIC_SUPABASE_KEY',
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(
      `Falten variables d'entorn: ${missing.join(', ')}. Copia app/.env.example a app/.env.local.`,
    );
  }
  return { supabaseUrl: supabaseUrl!, supabaseKey: supabaseKey! };
}
