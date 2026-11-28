import type { TFunction } from 'i18next';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "ara", "fa 5 min", "fa 2 h", "fa 3 d", and the date after a week. */
export function relativeTime(iso: string, now: Date, t: TFunction, language: string): string {
  const ms = now.getTime() - new Date(iso).getTime();
  if (ms < MINUTE) return t('feed.time.now');
  if (ms < HOUR) return t('feed.time.minutes', { count: Math.floor(ms / MINUTE) });
  if (ms < DAY) return t('feed.time.hours', { count: Math.floor(ms / HOUR) });
  if (ms < 7 * DAY) return t('feed.time.days', { count: Math.floor(ms / DAY) });
  return new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(new Date(iso));
}
