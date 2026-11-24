/**
 * UPC-E (8 digits: number system, 6 digits, check) → UPC-A (12 digits).
 * Only the app can do this: the scanner says which symbology it read, and
 * an 8-digit UPC-E looks exactly like an EAN-8. Other codes are returned as they are.
 */
export function expandUpcE(code: string): string {
  if (!/^[01]\d{7}$/.test(code)) return code;
  const [ns, d1, d2, d3, d4, d5, d6, check] = code.split('') as [string, ...string[]];
  let body: string;
  switch (d6) {
    case '0':
    case '1':
    case '2':
      body = `${d1}${d2}${d6}0000${d3}${d4}${d5}`;
      break;
    case '3':
      body = `${d1}${d2}${d3}00000${d4}${d5}`;
      break;
    case '4':
      body = `${d1}${d2}${d3}${d4}00000${d5}`;
      break;
    default:
      body = `${d1}${d2}${d3}${d4}${d5}0000${d6}`;
  }
  return `${ns}${body}${check}`;
}
