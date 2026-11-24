const KEYS = ['DateTimeOriginal', 'DateTimeDigitized', 'DateTime'] as const;
const OFFSET_KEYS: Record<(typeof KEYS)[number], string> = {
  DateTimeOriginal: 'OffsetTimeOriginal',
  DateTimeDigitized: 'OffsetTimeDigitized',
  DateTime: 'OffsetTime',
};
const EXIF_DATE = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/;
const OFFSET = /^([+-])(\d{2}):(\d{2})$/;

/**
 * When the photo was taken, as an ISO date, from its EXIF. EXIF dates have no time zone unless an
 * Offset* tag says so: without it they are read as the phone's local time. Invalid → null.
 */
export function exifDate(exif: Record<string, unknown> | null | undefined): string | null {
  if (!exif) return null;
  for (const key of KEYS) {
    const raw = exif[key];
    if (typeof raw !== 'string') continue;
    const match = EXIF_DATE.exec(raw.trim());
    if (!match) continue;
    const [year, month, day, hour, minute, second] = match.slice(1).map(Number) as [
      number,
      number,
      number,
      number,
      number,
      number,
    ];
    if (
      year < 1970 ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31 ||
      hour > 23 ||
      minute > 59 ||
      second > 59
    )
      continue;

    const offset = exif[OFFSET_KEYS[key]];
    const zone = typeof offset === 'string' ? OFFSET.exec(offset.trim()) : null;
    const date = zone
      ? new Date(
          Date.UTC(year, month - 1, day, hour, minute, second) -
            (zone[1] === '-' ? -1 : 1) * (Number(zone[2]) * 60 + Number(zone[3])) * 60_000,
        )
      : new Date(year, month - 1, day, hour, minute, second);
    // Rejects dates JavaScript rolled over (e.g. 31 February).
    if (!zone && (date.getMonth() !== month - 1 || date.getDate() !== day)) continue;
    return date.toISOString();
  }
  return null;
}
