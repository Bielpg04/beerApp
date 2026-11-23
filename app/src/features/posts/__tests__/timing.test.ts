import { defaultPublishToFeed, FEED_DEFAULT_MAX_AGE_MS, isRetroactive, RETRO_AFTER_MS } from '..';

const now = new Date('2026-11-23T12:00:00Z');
const ago = (ms: number) => new Date(now.getTime() - ms);

it('uses 1 h and 48 h as the limits', () => {
  expect(RETRO_AFTER_MS).toBe(3_600_000);
  expect(FEED_DEFAULT_MAX_AGE_MS).toBe(48 * 3_600_000);
});

it('is retroactive only when drunk more than 1 h ago', () => {
  expect(isRetroactive(now, now)).toBe(false);
  expect(isRetroactive(ago(RETRO_AFTER_MS), now)).toBe(false);
  expect(isRetroactive(ago(RETRO_AFTER_MS + 1), now)).toBe(true);
});

it('goes to the feed by default only when drunk in the last 48 h', () => {
  expect(defaultPublishToFeed(ago(FEED_DEFAULT_MAX_AGE_MS), now)).toBe(true);
  expect(defaultPublishToFeed(ago(FEED_DEFAULT_MAX_AGE_MS + 1), now)).toBe(false);
});
