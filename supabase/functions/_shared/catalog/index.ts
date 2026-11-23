export { IN_SCOPE, countryFromName, countryFromOffTag } from './countries.ts';
export { groupRows } from './group.ts';
export { normalizeGtin } from './gtin.ts';
export { USER_AGENT, createFetchOff, lookupBarcode, type LookupDeps } from './lookup.ts';
export { beerNameKey, brandKey, displayName, isGenericOnly } from './keys.ts';
export { acceptRow, isBeer, isInScope, parseAbv } from './off.ts';
export { STYLE_CODES, styleFromName, styleFromTags } from './styles.ts';
export type { BeerGroup, LookupResult, OffRow } from './types.ts';
