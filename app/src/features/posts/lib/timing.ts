/** Same rules as create_post on the server (it decides; the app only previews them). */
export const RETRO_AFTER_MS = 60 * 60_000;
export const FEED_DEFAULT_MAX_AGE_MS = 48 * 60 * 60_000;

export function isRetroactive(consumedAt: Date, now: Date): boolean {
  return now.getTime() - consumedAt.getTime() > RETRO_AFTER_MS;
}

export function defaultPublishToFeed(consumedAt: Date, now: Date): boolean {
  return now.getTime() - consumedAt.getTime() <= FEED_DEFAULT_MAX_AGE_MS;
}
