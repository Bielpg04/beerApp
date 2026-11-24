import { exifDate } from '..';

it('reads the original date as local phone time when there is no time zone', () => {
  expect(exifDate({ DateTimeOriginal: '2026:11:20 21:15:00' })).toBe(
    new Date(2026, 10, 20, 21, 15).toISOString(),
  );
});

it('respects the time zone when the photo has one', () => {
  expect(exifDate({ DateTimeOriginal: '2026:11:20 21:15:00', OffsetTimeOriginal: '+01:00' })).toBe(
    '2026-11-20T20:15:00.000Z',
  );
});

it('falls back to the digitized date and then the file date', () => {
  expect(exifDate({ DateTimeDigitized: '2026:11:19 10:00:00' })).toBe(
    new Date(2026, 10, 19, 10, 0).toISOString(),
  );
  expect(exifDate({ DateTime: '2026:11:18 09:30:05' })).toBe(new Date(2026, 10, 18, 9, 30, 5).toISOString());
});

it('ignores empty, zero and malformed dates', () => {
  expect(exifDate({ DateTimeOriginal: '0000:00:00 00:00:00' })).toBeNull();
  expect(exifDate({ DateTimeOriginal: '2026:13:40 99:00:00' })).toBeNull();
  expect(exifDate({ DateTimeOriginal: 42 })).toBeNull();
  expect(exifDate({})).toBeNull();
  expect(exifDate(null)).toBeNull();
  expect(exifDate(undefined)).toBeNull();
});
