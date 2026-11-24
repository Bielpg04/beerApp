import type { TFunction } from 'i18next';

import type { Serving } from '../types';

/** "Ampolla · 330 ml", or just "Ampolla" without a volume. */
export function formatServing(serving: Serving, volumeMl: number | null, t: TFunction): string {
  const label = t(`posts.serving.${serving}`);
  return volumeMl === null ? label : `${label} · ${volumeMl} ml`;
}

/** Date and time in the user's language, e.g. "20 de nov. 2026, 21:15". */
export function formatConsumedAt(iso: string, language: string): string {
  return new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}
