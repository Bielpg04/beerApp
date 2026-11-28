export const PHOTO_MAX_SIDE = 1080;
export const PHOTO_QUALITY = 0.7;
export const THUMB_MAX_SIDE = 320;
export const THUMB_QUALITY = 0.6;

/** Resize that fits the longest side into `max`, or null when the image is already small enough. */
export function fitLongestSide(
  width: number,
  height: number,
  max: number,
): { width: number } | { height: number } | null {
  if (Math.max(width, height) <= max) return null;
  return width >= height ? { width: max } : { height: max };
}
