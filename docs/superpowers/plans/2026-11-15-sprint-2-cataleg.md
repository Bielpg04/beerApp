# Sprint 2 · Catàleg de cerveses — pla d'implementació

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Catàleg de cerveses d'Europa + EUA importat d'Open Food Facts i Open Brewery DB, amb fitxa de cervesa i escàner de codis de barres que importa en viu les que falten.

**Architecture:** Un mòdul TypeScript pur (`supabase/functions/_shared/catalog/`) normalitza i agrupa les dades d'OFF; el fan servir l'importador (Node, `scripts/catalog/`) i la Edge Function `beer-lookup` (Deno). Tota escriptura al catàleg passa per una sola funció SQL, `catalog_import.upsert_beer(jsonb)`, que aplica la política de reimportació. L'app (`features/beers`) només llegeix i crida la RPC `beer_by_barcode` i la Edge Function.

**Tech Stack:** Postgres 17 + pgTAP · Supabase Edge Functions (Deno) · Node 26 (type stripping, `node --test`) · `postgres` (porsager) 3.4 · Expo SDK 58 · expo-camera · TanStack Query 5

**Spec:** `docs/superpowers/specs/2026-11-15-sprint-2-cataleg-design.md`

## Global Constraints

- Paquets d'Expo amb `npx expo install`; la resta amb versió exacta (`--save-exact`).
- Textos visibles a `app/src/shared/i18n/locales/{ca,es,en}.json` (el test de paritat ha de passar).
- Imports entre features només via `@/features/<feature>`.
- El mòdul `supabase/functions/_shared/catalog/` l'executen Node i Deno: només TypeScript esborrable (sense `enum`, `namespace` ni paràmetres-propietat), imports relatius amb extensió `.ts`, cap dependència externa, cap API exclusiva de Node o Deno.
- Taules del catàleg: RLS activat, `select` només per a `authenticated`; cap permís d'escriptura per a `anon`/`authenticated`. L'esquema `catalog_import` no s'exposa a l'API i `authenticated` no hi té accés.
- Codis de barres: només dígits; 12 → `'0' || codi`; 14 amb `0` inicial → els 13 últims; longituds vàlides finals 8 i 13; dígit de control GTIN obligatori. UPC-E només s'expandeix a l'app (és l'única que sap el tipus).
- Europa = els 44 estats europeus + `GB`; EUA = `US`. Filtre d'importació: `categories_tags ∋ en:beers`, algun `countries_tags` d'aquests països, `product_name` no buit.
- `abv` vàlid: 0–70; qualsevol altre valor → `null`.
- Reimportació: mai canvia `name`, `brand`, `name_key`, `brand_key`; actualitza `abv`, `style_code`, `image_url`, `image_thumb_url`, `country`, `brewery_id` si el valor nou no és null; mai toca `source = 'user'`. Mai s'esborra res.
- Estils (codis fixos, en aquest ordre de prioritat quan una cervesa en té diversos): `non_alcoholic`, `trappist`, `abbey`, `sour`, `fruit`, `witbier`, `wheat`, `ipa`, `pale_ale`, `saison`, `bock`, `stout`, `porter`, `pilsner`, `amber`, `blonde`, `dark`, `lager`.
- OFF: User-Agent `BeerApp/<versió> (https://github.com/Bielpg04/beerApp)`; timeout 5 s a la consulta en viu.
- Límit de cerques en viu: 30 per usuari i hora.
- Cada migració → `npm run db:types` i commit del fitxer de tipus.
- Git com a l'S1: branca `task/…` per subtasca (nom exacte al cos de l'issue) → PR squash a `feature/…`; la US → `main` amb merge commit.

## Review Focus

1. **El mateix producte escanejat a iOS (EAN-13 `0…`) i a Android (UPC-A de 12)** → la mateixa fitxa. _Tests a Task 1 (SQL) i Task 2 (TS)._
2. **OFF canvia el nom o la marca d'una cervesa ja importada** → la reimportació conserva `id` i nom, no peta per `unique (brand_key, name_key)`. _Test a Task 3._
3. **La càmera llegeix el mateix codi 10 cops per segon** (o un segon codi mentre es consulta el primer) → una sola consulta. _Test a Task 9._
4. **Un producte d'OFF amb dades brutes** (`alcohol_100g` = `"4,5"`, `500`, nom buit amb marca, sense imatge) → s'importa amb nulls, o es descarta si no té nom, sense errors. _Tests a Task 2 i Task 8._
5. **Obrir una fitxa fusionada** (`merged_into` no null, per exemple des d'un enllaç antic) → es mostra la cervesa final. _Test a Task 1 (RPC) i Task 7 (pantalla)._

---

## Fase 0 · Preparació

### Task 0: Pla, backlog i subtasques de l'S2

**Files:** Modify `docs/PLAN.md`; Create aquest pla i la spec (ja escrits).

- [ ] **Step 1:** A `docs/PLAN.md`: treure T2 i T3 de US-202; crear a l'EPIC 2 **US-205 · Historial i amics a la fitxa de cervesa (2)** (T1 "L'has begut X vegades" + amics que l'han begut) i **US-206 · On serveixen la cervesa (2)** (T1 bars propers, enllaç al mapa); afegir US-205 a la fila S5 i US-206 a la fila S7; canviar US-204 T3 per "Si no existeix enlloc → missatge 'no la tenim' amb el codi (el formulari arriba amb US-203)".
- [ ] **Step 2:** `npm run test:scripts` → PASS (el parser accepta el pla).
- [ ] **Step 3:** `npm run backlog -- --dry-run --tasks S2` → han de sortir US-205 i US-206 noves i les subtasques US-201-T1…T5, US-202-T1, US-204-T1…T3.
- [ ] **Step 4:** `npm run backlog -- --tasks S2` i `node scripts/github/setup-project.ts`. Editar el cos de l'issue #32 (US-202) per treure-hi T2/T3.
- [ ] **Step 5:** Branca `docs/sprint-2-design` amb spec + pla + `PLAN.md` → PR a `main`, commit `docs: plan sprint 2 (design, plan, backlog)`.

---

## Fase A · `feature/us-201-cataleg-inicial`

### Task 1 (US-201-T1): Taules del catàleg i `beer_by_barcode`

**Files:**

- Create: `supabase/migrations/<ts>_catalog.sql`, `supabase/tests/database/040_catalog.test.sql`
- Modify: `supabase/seed.sql` (3 cerveses de prova: una amb tot, una sense ABV/imatge/estil/cervesera, una fusionada a la primera), `app/src/types/database.ts`

Desviació de la spec: la correspondència estil ↔ categories d'OFF viu al mòdul TypeScript (Task 2), així que `beer_styles` no té columna `off_tags`. Els tests de la Edge Function són de Node sobre el handler pur (Task 8), perquè ni aquest Mac ni la CI tenen Deno.

**Interfaces — Produces:**

- `public.beer_styles(code text pk, sort_order smallint)` amb els 18 codis.
- `public.breweries(id, name, name_key, country char(2), city, website, location geography(Point), source check in ('obdb','user'), obdb_id unique, created_at, updated_at)`.
- `public.beers(id, name, name_key, brand, brand_key, brewery_id null, style_code null, abv numeric(4,2) null check 0–70, country char(2) null, image_url, image_thumb_url, source check in ('off','user'), status check in ('approved','pending') default 'approved', created_by null, merged_into uuid null → beers, created_at, updated_at)`; `unique (brand_key, name_key) where merged_into is null and source = 'off'`; índex GIN trigram sobre `extensions.unaccent(lower(name))` (amb un wrapper `immutable`).
- `public.beer_barcodes(barcode text pk, beer_id uuid → beers on delete cascade, off_last_modified timestamptz null)`.
- `public.normalize_gtin(code text) returns text` (`immutable`; null si no és vàlid).
- `public.beer_by_barcode(code text) returns uuid` (segueix `merged_into` fins al final; només `approved`; `grant execute` a `authenticated`).
- `public.resolve_beer(id uuid) returns uuid` (segueix `merged_into`; la fa servir l'app a Task 7).
- Esquema `catalog_import` (buit encara; `revoke all` de `anon`, `authenticated`).

- [ ] **Step 1: Test que falla** — `040_catalog.test.sql` (mateix helper `pg_temp.login_as` que `030_avatars`):
  - `has_table` per a les 4 taules; `results_eq` dels 18 codis d'estil en l'ordre de la constraint
  - com a `authenticated`: llegeix `beers`; `insert into beers` → `throws_ok '42501'`; `update beers` afecta 0 files; `insert into beer_barcodes` → `42501`
  - com a `anon`: `select count(*) from beers` → `42501`
  - `normalize_gtin('012345678905')` = `'0012345678905'`; `normalize_gtin('00012345678905')` = `'0012345678905'`; `normalize_gtin('96385074')` = `'96385074'`; `normalize_gtin('0012345678906')` (control dolent) → null; `normalize_gtin('abc')` → null; `normalize_gtin(' 0012-3456-78905 ')` = `'0012345678905'`
  - amb una cervesa i el codi `'0012345678905'`: `beer_by_barcode('012345678905')` = el seu id (Review Focus 1)
  - cervesa B amb `merged_into = A` i codi propi: `beer_by_barcode(<codi de B>)` = A; `resolve_beer(B)` = A (Review Focus 5)
  - `status = 'pending'` → `beer_by_barcode` retorna null
  - `has_schema('catalog_import')`; com a `authenticated`, `select` a qualsevol taula de `catalog_import` → `42501`
- [ ] **Step 2:** `npm run db:reset && npm run db:test` → FAIL.
- [ ] **Step 3:** Migració + seed.
- [ ] **Step 4:** `npm run db:reset && npm run db:test && npm run db:lint` → PASS; `npm run db:types`.
- [ ] **Step 5:** Commit `feat(db): add beer catalog tables and barcode lookup`.

### Task 2 (US-201-T4, part 1): Mòdul de normalització i agrupació

**Files:**

- Create: `supabase/functions/_shared/catalog/{gtin,keys,countries,styles,off,group,types}.ts`
- Test: `scripts/catalog/normalize.test.ts` (importa del mòdul compartit; s'executa amb `npm run test:scripts`)

**Interfaces — Produces** (a `types.ts` i els fitxers corresponents):

```ts
export type OffRow = {
  code: string;
  productName: string;
  brands: string;
  categoriesTags: string[];
  countriesTags: string[];
  originsTags: string[];
  alcohol100g: string;
  imageUrl: string;
  imageSmallUrl: string;
  uniqueScans: number;
  lastModified: number; // epoch s
};
export type BeerGroup = {
  name: string;
  nameKey: string;
  brand: string;
  brandKey: string;
  abv: number | null;
  styleCode: string | null;
  country: string | null;
  imageUrl: string | null;
  imageThumbUrl: string | null;
  barcodes: { code: string; offLastModified: string | null }[]; // ISO
};
export function normalizeGtin(raw: string): string | null;
export function brandKey(brand: string): string; // també per a breweries.name_key
export function beerNameKey(name: string, brand: string): string;
export function displayName(names: string[]): string;
export function parseAbv(raw: string | number | null | undefined): number | null;
export function styleFromTags(categoriesTags: string[]): string | null;
export function countryFromOffTag(tag: string): string | null; // 'en:belgium' → 'BE'
export function countryFromName(name: string): string | null; // OBDB: 'England' → 'GB'
export function isInScope(countriesTags: string[]): boolean; // Europa + US
export function isBeer(categoriesTags: string[]): boolean;
export function acceptRow(row: OffRow): boolean; // isBeer && isInScope && nom (o marca)
export function groupRows(rows: OffRow[]): BeerGroup[];
```

- [ ] **Step 1: Tests que fallen** (`node:test` + `node:assert/strict`):
  - `normalizeGtin`: mateixos casos que Task 1 (Review Focus 1), més `'5410228142249'` vàlid
  - `beerNameKey('Heineken Beer','Heineken Bier')` === `beerNameKey('Heineken Lager Beer','Heineken')` === `beerNameKey('HEINEKEN','Heineken')`; `brandKey('Heineken Bier')` === `brandKey('Heineken')`
  - `beerNameKey('bud','Bud')` === `'bud'`; `beerNameKey('Beer','Coors Light')` === `'coors light'`
  - `beerNameKey('Cheschire Chocolate Porter 500 ml','Marks & Spencer')` !== `beerNameKey('London Porter','Marks & Spencer')`
  - `beerNameKey('Estrella Damm 6x33cl','Estrella Damm')` === `beerNameKey('Estrella Damm lata','Estrella Damm')`
  - `brandKey('Sierra Nevada')` === `brandKey('Sierra Nevada Brewing Co.')`; `brandKey('Brasserie Dupont')` === `brandKey('Dupont')`
  - `displayName(['bud','bud','Bud'])` → `'Bud'`; `displayName(['London Porter'])` → `'London Porter'`
  - `parseAbv('4,5')` → 4.5; `parseAbv('500')` → null; `parseAbv('')` → null; `parseAbv('3.6350110741035047')` → 3.64 (Review Focus 4)
  - `styleFromTags(['en:beers','en:lagers','en:non-alcoholic-beers'])` → `'non_alcoholic'`; `['en:beers','en:stouts']` → `'stout'`; `['en:beers']` → null
  - `isInScope(['en:japan'])` → false; `['en:japan','en:spain']` → true; `['en:united-states']` → true
  - `acceptRow` amb `productName: ''` i `brands: ''` → false
  - `groupRows` amb 3 files Heineken (2 codis diferents + 1 repetit): 1 grup, 2 codis, ABV = moda, imatge de la fila amb més `uniqueScans`
- [ ] **Step 2:** `npm run test:scripts` → FAIL.
- [ ] **Step 3:** Implementar. `beerNameKey`: minúscules, sense accents ni puntuació → treure les paraules de `brandKey(brand)` → treure paraules genèriques (`beer`, `cerveza`, `cervesa`, `bière`, `bier`, `birra`…) i formats/volums (`33cl`, `500 ml`, `6x`, `can`, `lata`, `pack`…) → si només queden paraules d'estil (`lager`, `pils`, `pilsner`…) o res, la clau és `brandKey(brand)`. La llista exacta de paraules: decisió de qui ho construeix, mentre passin els tests.
- [ ] **Step 4:** `npm run test:scripts && npm run format:check` → PASS.
- [ ] **Step 5:** Commit `feat(catalog): add shared beer normalization and grouping`.

### Task 3 (US-201-T4, part 2): Política d'upsert a SQL

**Files:**

- Create: `supabase/migrations/<ts>_catalog_upsert.sql`, `supabase/tests/database/050_catalog_upsert.test.sql`

**Interfaces:**

- Consumes: Task 1; la forma JSON de `BeerGroup` (Task 2), amb les claus en camelCase.
- Produces:
  - `catalog_import.upsert_beer(g jsonb) returns uuid` — resol la cervesa existent en aquest ordre: (1) algun dels seus codis ja és a `beer_barcodes` → la cervesa final (seguint `merged_into`) del codi **més antic** (`beers.created_at`); (2) (`brand_key`, `name_key`) amb `merged_into is null`; (3) si no, la crea. Aplica la política de reimportació de les Global Constraints. Afegeix els codis que falten (`on conflict (barcode) do update set off_last_modified`, sense moure codis que ja són d'una altra cervesa). `brewery_id` = la cervesera amb `name_key = brand_key` si n'hi ha **exactament una**; `country` = el de la cervesera si n'hi ha, si no `g.country`.
  - `catalog_import.staged_groups(payload jsonb)` (taula) i `catalog_import.merge() returns table(created int, updated int, barcodes_added int, conflicts int)` — crida `upsert_beer` per a cada fila i buida la taula.
  - `catalog_import.merge_beers(from_id uuid, into_id uuid) returns void` — mou els codis i posa `merged_into`.
  - `public.catalog_upsert_beer(g jsonb) returns uuid` — embolcall `security definer`, `execute` només per a `service_role`.
  - `catalog_import.lookups(user_id uuid, created_at timestamptz)` i `public.catalog_register_lookup(uid uuid) returns boolean` — compta les de l'última hora; si < 30 insereix i retorna true; si no, false. Només `service_role`.

- [ ] **Step 1: Test que falla** — `050_catalog_upsert.test.sql`:
  - primer `upsert_beer` d'un grup Heineken amb 2 codis → crea 1 cervesa i 2 codis; el segon idèntic → mateix id, 0 files noves
  - el mateix grup amb `name: 'Heineken Premium'` i `nameKey` diferent però un codi existent → mateix id i `name` sense canviar (Review Focus 2)
  - grup amb `abv` nou → s'actualitza; amb `abv: null` → es conserva l'anterior
  - un codi nou en un grup existent s'afegeix a la mateixa cervesa
  - cervesa `source = 'user'` amb un codi del grup → no se'n canvia cap camp
  - codis del grup repartits entre dues cerveses existents → els nous van a la més antiga; `merge()` compta 1 conflicte
  - `brand_key` amb una sola cervesera coincident → `brewery_id` i `country` de la cervesera; amb dues → `brewery_id` null
  - `merge_beers(B, A)` → els codis de B apunten a A i `B.merged_into = A`
  - `catalog_register_lookup`: 30 trucades → true; la 31a → false; una de fa 61 min no compta
  - com a `authenticated`: `select public.catalog_upsert_beer('{}')` → `42501`
- [ ] **Step 2:** FAIL. **Step 3:** Migració. **Step 4:** `db:reset`, `db:test`, `db:lint` → PASS; `db:types`.
- [ ] **Step 5:** Commit `feat(db): add catalog upsert policy and merge`.

### Task 4 (US-201-T3): Importador d'Open Brewery DB

**Files:**

- Create: `scripts/catalog/import.ts` (CLI), `scripts/catalog/db.ts`, `scripts/catalog/obdb.ts`
- Test: `scripts/catalog/obdb.test.ts`
- Modify: `package.json` (devDependency `postgres` exacta; script `"catalog:import": "node scripts/catalog/import.ts"`)

**Interfaces — Produces:**

- `connect(url = process.env.CATALOG_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres')` a `db.ts`.
- `fetchBreweries(fetchImpl = fetch): AsyncGenerator<ObdbBrewery>` (pàgines de 200 fins a una pàgina buida) i `toBreweryRow(b): BreweryRow | null` (null si el país no és d'Europa/EUA; `name_key = brandKey(name)`; `location` a partir de `latitude`/`longitude` si hi són).
- `upsertBreweries(sql, rows)` per `obdb_id`, en lots de 1000.
- CLI: `npm run catalog:import -- --source obdb|off|all [--dry-run] [--off-file <ruta>]`.

- [ ] **Step 1: Tests que fallen:** `toBreweryRow` amb el JSON real de la mostra (Kronach, Germany) → `country: 'DE'`, `name_key` correcte; `country: 'Japan'` → null; `country: 'England'`/`'Scotland'` → `'GB'`; `fetchBreweries` amb `fetch` falsa de 2 pàgines + una buida → 3 crides i totes les cerveseres.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** `npm run test:scripts` → PASS; manual: `npm run db:reset && npm run catalog:import -- --source obdb` → ~11.000 cerveseres a la BD local.
- [ ] **Step 5:** Commit `feat(catalog): import breweries from Open Brewery DB`.

### Task 5 (US-201-T2): Importador d'Open Food Facts i GitHub Action

**Files:**

- Create: `scripts/catalog/off.ts`, `scripts/catalog/report.ts`, `.github/workflows/catalog-import.yml`
- Test: `scripts/catalog/off.test.ts` (fixture `scripts/catalog/fixtures/off-sample.tsv`: capçalera real + ~30 files reals de la mostra, incloent-hi no cerveses i països fora d'abast)
- Modify: `scripts/catalog/import.ts`, `docs/DEVELOPMENT.md` (secció "Catàleg")

**Interfaces:**

- Consumes: Task 2 (`acceptRow`, `groupRows`), Task 3 (`catalog_import.staged_groups`, `merge()`), Task 4 (`connect`, CLI).
- Produces: `OFF_CSV_URL`; `readOffRows(stream: ReadableStream<Uint8Array>): AsyncGenerator<OffRow>` (descomprimeix gzip si cal, llegeix per línies, columnes per nom de capçalera); `importOff(sql, opts: { file?: string; dryRun: boolean }): Promise<ImportReport>`; `ImportReport = { read, accepted, groups, barcodes, created, updated, barcodesAdded, conflicts, samples: BeerGroup[] }` (50 grups amb més d'un codi).

- [ ] **Step 1: Tests que fallen:** `readOffRows` sobre la fixture → només les columnes de `OffRow`, `categoriesTags` com a array; el pipeline `readOffRows → acceptRow → groupRows` sobre la fixture dona el recompte esperat (fixat a la fixture) i descarta les files fora d'abast; un `.tsv.gz` de la fixture dona el mateix resultat.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. Càrrega: inserir els grups a `staged_groups` en lots de 1000 i `select * from catalog_import.merge()` dins una transacció. Amb `--dry-run`, sense connexió: només imprimir l'informe.
- [ ] **Step 4:** `npm run test:scripts` → PASS. Manual: `npm run catalog:import -- --source off --dry-run` contra el bolcat real → revisar els 50 grups i ajustar paraules genèriques si hi ha fusions errònies; després `--source all` a la BD local; repetir-lo i comprovar `created = 0`.
- [ ] **Step 5:** Workflow `catalog-import.yml`: `schedule` mensual (`'23 4 3 * *'`) + `workflow_dispatch` (input `project: dev|prod|both`); matriu DEV/PROD amb `CATALOG_DB_URL` de `SUPABASE_DB_URL_*`; salta amb `::notice::` si el secret no hi és (com `maintenance.yml`); Node 26, `npm ci`, `npm run catalog:import -- --source all`; l'informe al `GITHUB_STEP_SUMMARY`.
- [ ] **Step 6:** Commit `feat(catalog): import beers from Open Food Facts monthly`.

### Task 6 (US-201-T5): Sobre l'app

**Files:**

- Create: `app/src/features/about/{index.ts,screens/about-screen.tsx}`, `app/src/app/about.tsx`
- Modify: `app/src/app/_layout.tsx` (pantalla `about` al grup `ready`), `app/src/features/profile/screens/my-profile-screen.tsx` (enllaç "Sobre l'app"), locales
- Test: `app/src/features/about/__tests__/about-screen.test.tsx`

**Interfaces — Produces:** `AboutScreen` (versió amb `expo-constants`; atribucions: "Dades de cerveses: Open Food Facts (ODbL), imatges CC BY-SA", "Cerveseres: Open Brewery DB" amb la llicència que tingui (comprovar-la al seu repositori); cada una amb enllaç obert amb `expo-web-browser`).

- [ ] **Step 1: Test que falla:** renderitza la versió i els dos textos d'atribució; prémer "Open Food Facts" crida `openBrowserAsync('https://world.openfoodfacts.org')`; el perfil té un enllaç que navega a `/about`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** `npm test && npm run typecheck && npm run lint` → PASS.
- [ ] **Step 5:** Commit `feat(about): add about screen with data attributions`.
- [ ] **Step 6:** PR `feature/us-201-cataleg-inicial` → `main` (`Closes #31`).

---

## Fase B · `feature/us-202-fitxa-de-cervesa`

### Task 7 (US-202-T1): Fitxa de cervesa

**Files:**

- Create: `app/src/features/beers/{index.ts,types.ts,api/beer.ts,screens/beer-screen.tsx}`, `app/src/app/beer/[id].tsx`
- Modify: `app/src/app/_layout.tsx`, locales (`beers.*`, inclòs `beers.styles.<code>` per als 18 codis)
- Test: `app/src/features/beers/__tests__/beer-screen.test.tsx`, `…/beer.test.tsx`

**Interfaces:**

- Consumes: `resolve_beer`, taules de Task 1; `findCountry` de `@/features/profile`.
- Produces: `type Beer = { id; name; brand; abv: number | null; country: string | null; imageUrl: string | null; styleCode: string | null; brewery: { name: string; city: string | null } | null }`; `beerKey(id) = ['beer', id]`; `useBeer(id): UseQueryResult<Beer | null>` (primer `rpc('resolve_beer')`, després `select` amb `breweries(name, city)`); `BeerScreen({ id })`.

- [ ] **Step 1: Tests que fallen:** cervesa completa → nom, marca, "Cervesera: … · Ciutat", estil traduït, "5,0 %" (format de l'idioma), bandera + nom del país, "Dades: Open Food Facts"; sense ABV/estil/cervesera/imatge → "—" per a l'ABV, sense línies de cervesera ni estil, placeholder 🍺; `resolve_beer` retorna un altre id → es carrega aquell (Review Focus 5); `null` → estat buit "No hem trobat aquesta cervesa"; error de xarxa → missatge i botó de tornar-ho a provar.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar; imatge amb `expo-image`. **Step 4:** Tests + typecheck + lint → PASS. Manual: a la web local (`app-web`), entrar amb Mailpit i obrir `/beer/<id del seed>`; captura per a la PR.
- [ ] **Step 5:** Commit `feat(beers): add beer detail screen`.
- [ ] **Step 6:** PR `feature/us-202-fitxa-de-cervesa` → `main` (`Closes #32`).

---

## Fase C · `feature/us-204-identificar-cervesa-per-codi-de-barres`

### Task 8 (US-204-T2): Edge Function `beer-lookup` i `findBeerByBarcode`

**Files:**

- Create: `supabase/functions/_shared/catalog/lookup.ts`, `supabase/functions/beer-lookup/index.ts`, `supabase/functions/beer-lookup/deno.json`
- Modify: `supabase/config.toml` (`[functions.beer-lookup] verify_jwt = true`), `docs/DEVELOPMENT.md` (desplegament: `supabase functions deploy beer-lookup`)
- Create: `app/src/features/beers/api/find-by-barcode.ts`, `app/src/features/beers/lib/upc-e.ts`
- Test: `scripts/catalog/lookup.test.ts`, `app/src/features/beers/__tests__/find-by-barcode.test.ts`

**Interfaces:**

- Consumes: Task 2 (`normalizeGtin`, `isBeer`, `groupRows`), Task 3 (`catalog_upsert_beer`, `catalog_register_lookup`), Task 1 (`beer_by_barcode`).
- Produces:
  - `type LookupResult = { status: 'found' | 'imported'; beerId: string } | { status: 'not_found' | 'not_beer' | 'unavailable' | 'rate_limited' | 'invalid' }` (a `_shared/catalog/types.ts`; l'app en té una còpia a `features/beers/types.ts`)
  - `lookupBarcode(raw: string, userId: string, deps: { findByBarcode(code): Promise<string | null>; registerLookup(uid): Promise<boolean>; fetchOff(code): Promise<Response>; upsert(g: BeerGroup): Promise<string> }): Promise<LookupResult>`
  - `index.ts`: `Deno.serve` que agafa l'usuari del JWT, construeix les `deps` amb un client `service_role` i retorna el `LookupResult` en JSON (200).
  - App: `expandUpcE(code: string): string`; `findBeerByBarcode(code: string, type: string): Promise<LookupResult>` (UPC-E → `expandUpcE`; `rpc('beer_by_barcode')` → si hi és, `found` sense cridar la funció; si no, `functions.invoke('beer-lookup')`; error de xarxa → `unavailable`).

- [ ] **Step 1: Tests que fallen:**
  - `lookupBarcode('abc', …)` → `invalid` sense cap crida; codi existent → `found` sense `registerLookup` ni `fetchOff`
  - `registerLookup` false → `rate_limited` sense `fetchOff`
  - OFF `status: 1` amb `en:beers` i país `en:japan` → `imported` (sense filtre de país); amb `alcohol_value: '500'` → `upsert` rep `abv: null` (Review Focus 4)
  - OFF producte que no és cervesa → `not_beer`; `status: 0` → `not_found`; `fetchOff` rebutja o tarda > 5 s → `unavailable`
  - `fetchOff` envia el User-Agent de les Global Constraints
  - app: `expandUpcE('04252614')` → `'042100005264'`; `findBeerByBarcode('5410228142249','ean13')` amb la RPC retornant un id → `{ status: 'found' }` i `functions.invoke` no es crida
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** `npm run test:scripts`, i a `app/`: tests + typecheck + lint → PASS. Manual: `supabase functions serve beer-lookup` i `curl` amb el JWT d'un usuari local i el codi de Heineken `8712000900045` → `imported`, i un segon cop → `found`.
- [ ] **Step 5:** Commit `feat(beers): look up unknown barcodes on Open Food Facts`.

### Task 9 (US-204-T1 + T3): Escàner

**Files:**

- Create: `app/src/features/beers/screens/scan-screen.tsx`, `app/src/features/beers/lib/scan-state.ts`, `app/src/app/scan.tsx`
- Modify: `app/src/app/(tabs)/search.tsx` (botó "Escaneja una cervesa"), `app/src/app/_layout.tsx` (`scan` com a `fullScreenModal`), `app/app.json` (plugin `expo-camera` amb `cameraPermission` en anglès; textos ca/es a `locales` de l'app si el plugin ho permet), locales
- Test: `app/src/features/beers/__tests__/scan-state.test.ts`, `…/scan-screen.test.tsx`

**Interfaces:**

- Consumes: `findBeerByBarcode` (Task 8), ruta `/beer/[id]` (Task 7).
- Produces: `type ScanState = { kind: 'scanning' } | { kind: 'looking'; code: string } | { kind: 'result'; code: string; result: LookupResult }`; `scanReducer(state, event: { type: 'detected'; code: string } | { type: 'resolved'; result: LookupResult } | { type: 'retry' }): ScanState` — `detected` només té efecte en `scanning`.

- [ ] **Step 1: Tests que fallen:**
  - `scanReducer`: `detected` en `looking` → mateix estat (Review Focus 3); `retry` des de `result` → `scanning`
  - pantalla (`expo-camera` mockejat): 10 `onBarcodeScanned` seguits amb el mateix codi → `findBeerByBarcode` una sola vegada (Review Focus 3); `found`/`imported` → `router.replace('/beer/<id>')`
  - `not_found` → text "Encara no tenim aquesta cervesa" + el codi + "Aviat la podràs afegir"; `not_beer`, `unavailable` (amb botó de tornar-ho a provar), `rate_limited` i `invalid` → cadascun el seu text
  - permís denegat → missatge i botó que crida `Linking.openSettings()`
  - la pestanya Cerca té el botó que navega a `/scan`
- [ ] **Step 2:** FAIL. **Step 3:** `npx expo install expo-camera`; `CameraView` amb `barcodeScannerSettings: { barcodeTypes: ['ean13','ean8','upc_a','upc_e'] }`. **Step 4:** Tests + typecheck + lint → PASS; `npx expo-doctor` net.
- [ ] **Step 5:** Commit `feat(beers): add barcode scanner with lookup states`.
- [ ] **Step 6 (manual, quan hi hagi build de desenvolupament a Android):** escanejar 5 cerveses de casa, almenys una que no sigui al catàleg; captures a la PR.
- [ ] **Step 7:** PR `feature/us-204-identificar-cervesa-per-codi-de-barres` → `main` (`Closes #34` quan el Step 6 estigui fet; si no, `Refs`).

---

## Pendent fora de codi

- Secrets `SUPABASE_DB_URL_DEV/PROD` (ja previstos) per a la importació mensual; primera execució manual amb `workflow_dispatch`.
- `supabase functions deploy beer-lookup` a dev i prod.
- Build de desenvolupament a Android per provar l'escàner.
