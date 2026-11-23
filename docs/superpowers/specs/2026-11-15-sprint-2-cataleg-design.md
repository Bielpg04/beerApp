# Sprint 2 · Catàleg de cerveses — disseny

- **Data:** 2026-11-15
- **US:** US-201 (catàleg inicial), US-202 (fitxa de cervesa, només T1), US-204 (identificar per codi de barres)
- **Estat:** pendent d'aprovació
- **Decidit amb tu:** enfocament A (importació des del bolcat); marca separada de la cervesera (B)

## Intenció

Deixar l'app amb un **catàleg real de cerveses** (Europa + EUA) perquè l'S3 (crear posts) tingui sobre què triar. L'S2 no es fa per ensenyar-lo a ningú: és fonament. Al final de l'sprint, des d'una build de desenvolupament, s'ha de poder escanejar el codi de barres d'una cervesa i arribar a la seva fitxa, i si la cervesa no era al catàleg però sí a Open Food Facts, importar-la en aquell moment.

## Objectius

- Taules `breweries`, `beer_styles`, `beers` i `beer_barcodes` amb RLS (només lectura per a usuaris autenticats).
- Importador d'**Open Food Facts** (cerveses venudes a Europa o als EUA) i d'**Open Brewery DB** (cerveseres), idempotent, que es pot executar a mà i cada mes amb una GitHub Action.
- Normalització i deduplicació: la mateixa cervesa amb diversos codis (llauna, ampolla, pack) és **una sola fitxa**.
- Fitxa de cervesa a la ruta `/beer/[id]` (imatge, nom, cervesera, estil, % alcohol, país).
- Escàner de codis de barres → fitxa; si no és al catàleg, cerca en viu a Open Food Facts i importació.
- Pantalla "Sobre l'app" amb les atribucions de llicència.

## No objectius (aquest sprint)

- **Cercador de cerveses per nom** (US-1001, S6). L'S3 decidirà què necessita per triar cervesa al flux de crear post.
- **US-202 T2** ("l'has begut X vegades", amics que l'han begut) → es mou a l'**S5** (necessita posts i amistats).
- **US-202 T3** (on la serveixen) → es mou a l'**S7** (necessita bars).
- **Afegir una cervesa a mà** (US-203, S6). Si un codi no existeix enlloc, només es diu "no la tenim" i es mostra el codi.
- Revisió/moderació del catàleg, edició de fitxes, cervesa a partir d'una foto de l'etiqueta.
- Copiar les imatges al nostre Storage.

## Anti-objectius

- Un catàleg ple de duplicats evidents ("Heineken", "Heineken Beer", "HEINEKEN lager") que faci impossible triar la cervesa correcta a l'S3.
- Que un usuari pugui escriure al catàleg des del client (a l'S2 només s'hi escriu des de l'importador i des de la Edge Function).
- Que una reimportació canviï els `id` de cerveses existents (a l'S3 hi penjaran posts).
- Que l'app faci servir Open Food Facts d'una manera que ens faci bloquejar (massa peticions, sense User-Agent identificable).
- Omplir la BD gratuïta (500 MB) amb dades que no farem servir.

## Restriccions

- **Open Food Facts:** la seva cerca (`/api/v2/search`) està tancada a usuaris anònims (retorna una pàgina d'error); la consulta d'un producte (`/api/v2/product/<codi>`) sí que funciona (límit ~100 peticions/min, cal un User-Agent propi). El bolcat Parquet de Hugging Face (8 GB) retorna 429 a les peticions anònimes per rangs. El bolcat **CSV** (`en.openfoodfacts.org.products.csv.gz`, **1,5 GB** comprimit, separat per tabuladors) és el que es pot llegir en streaming sense baixar-lo sencer al disc.
- **Qualitat de les dades d'OFF** (mostra real): `brands` sovint és una marca o un supermercat, no la cervesera ("Marks & Spencer", "Bud"); el % d'alcohol (`alcohol_100g`) falta en ~la meitat; noms en minúscules o genèrics ("bud", "Beer" amb marca "Coors Light"); `countries_tags` diu on es **ven**, no d'on és; l'estil només es pot deduir de `categories_tags`. Quasi totes tenen imatge.
- **Open Brewery DB:** ~12.700 cerveseres (8.300 als EUA; Alemanya, Països Baixos i Bèlgica en tenen centenars), amb país, ciutat, coordenades i web. API paginada sense clau.
- **Llicències:** OFF és ODbL (base de dades) i CC BY-SA (imatges) → cal atribució visible. Open Brewery DB → comprovar la llicència de les dades i atribuir-la.
- **Proves:** en aquest Mac no hi ha simulador i la càmera no funciona a la web; l'escàner només es pot provar amb una build de desenvolupament en un mòbil Android real.
- Supabase gratuït: 500 MB de BD, 1 GB de Storage, Edge Functions 500k invocacions/mes.

## Enfocaments

|          | Enfocament                                                                                                                                                                                                                                   | Pros                                                                 | Contres                                                                  |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **A ✅** | **Importació des del bolcat**: un script llegeix en streaming el CSV d'OFF, filtra cerveses d'Europa + EUA, normalitza i deduplica, i ho carrega a Supabase. GitHub Action mensual. A més, cerca en viu de codis nous amb una Edge Function. | Catàleg ple des del primer dia → a l'S3 es pot triar cervesa pel nom | L'script de neteja és la part més feixuga de l'sprint                    |
| B        | Sense importació: el catàleg només creix quan algú escaneja (cerca en viu)                                                                                                                                                                   | Molt menys codi                                                      | A l'S3 no es podria triar una cervesa pel nom si ningú no l'ha escanejat |
| C        | Recórrer la cerca d'OFF pàgina a pàgina                                                                                                                                                                                                      | —                                                                    | Tancada a anònims i limitada a 10 peticions/min                          |

**Triat: A** (decisió teva).

## Disseny

### Dades

Totes les taules: RLS activat, `select` per a `authenticated`, cap `insert`/`update`/`delete` per a `authenticated` ni `anon`. Escriuen l'importador (connexió directa a Postgres) i la Edge Function (`service_role`).

**`beer_styles`** — llista tancada i petita (~20 estils), sembrada per migració.

| Camp                  | Notes                                                                                                |
| --------------------- | ---------------------------------------------------------------------------------------------------- |
| `code` text PK        | `lager`, `pilsner`, `ipa`, `pale_ale`, `stout`, `porter`, `wheat`, `sour`, `abbey`, `non_alcoholic`… |
| `off_tags` text[]     | etiquetes de `categories_tags` d'OFF que hi corresponen (`en:lagers`, `en:pilsners`…)                |
| `sort_order` smallint |                                                                                                      |

Els noms dels estils viuen a l'i18n de l'app (`beers.styles.<code>`), no a la BD (decisió meva: és una llista tancada i així queda traduïda a ca/es/en com la resta de textos).

**`breweries`**

| Camp                                  | Notes                                                                               |
| ------------------------------------- | ----------------------------------------------------------------------------------- |
| `id` uuid PK                          |                                                                                     |
| `name` text                           |                                                                                     |
| `name_key` text                       | nom normalitzat (veure Normalització); índex                                        |
| `country` char(2) null                | ISO 3166-1                                                                          |
| `city` text null, `website` text null |                                                                                     |
| `location` geography(Point) null      | d'Open Brewery DB (servirà a l'S7)                                                  |
| `source` text                         | `obdb` \| `user` (només es creen cerveseres d'Open Brewery DB; `user` per al futur) |
| `obdb_id` text unique null            |                                                                                     |
| `created_at`, `updated_at`            |                                                                                     |

**`beers`**

| Camp                                     | Notes                                                                                                                                                                                                                                             |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id` uuid PK                             | **estable entre reimportacions**                                                                                                                                                                                                                  |
| `name` text                              | nom net per mostrar                                                                                                                                                                                                                               |
| `name_key` text                          | clau de deduplicació; `unique (brand_key, name_key) where merged_into is null`                                                                                                                                                                    |
| `brand` text                             | marca tal com la dona OFF (primer element de `brands`): "Coors Light", "Marks & Spencer"…                                                                                                                                                         |
| `brand_key` text                         | marca normalitzada                                                                                                                                                                                                                                |
| `brewery_id` uuid null → breweries       | **només** si la marca casa de debò amb una cervesera d'Open Brewery DB (veure Normalització)                                                                                                                                                      |
| `style_code` text null → beer_styles     |                                                                                                                                                                                                                                                   |
| `abv` numeric(4,2) null                  | 0–70                                                                                                                                                                                                                                              |
| `country` char(2) null                   | **d'origen**: país de la cervesera si se sap, si no `origins_tags` d'OFF; mai on es ven                                                                                                                                                           |
| `image_url`, `image_thumb_url` text null | URLs d'OFF (enllaçades, no copiades)                                                                                                                                                                                                              |
| `source` text                            | `off` \| `user` (`user` el farà servir la US-203)                                                                                                                                                                                                 |
| `status` text                            | `approved` \| `pending` (tot l'importat és `approved`)                                                                                                                                                                                            |
| `created_by` uuid null                   | per a la US-203                                                                                                                                                                                                                                   |
| `merged_into` uuid null → beers          | si no és null, aquesta fitxa és un duplicat fusionat a una altra; tot el que la busca (RPC, fitxa) segueix la redirecció. No es fa servir a l'S2 més que per seguir-la; la fusió manual (`catalog_import.merge_beers(from, into)`) sí que es crea |
| `created_at`, `updated_at`               |                                                                                                                                                                                                                                                   |

Índex trigram (`pg_trgm` + `unaccent`) sobre el nom per a l'S3/S6.

**`beer_barcodes`** (decisió meva, en lloc del `barcodes[]` del pla: un codi només pot ser d'una cervesa, i la cerca per codi és una clau primària)

| Camp                                     | Notes                                      |
| ---------------------------------------- | ------------------------------------------ |
| `barcode` text PK                        | normalitzat a GTIN (veure Codis de barres) |
| `beer_id` uuid → beers on delete cascade |                                            |
| `off_last_modified` timestamptz null     | per saber si cal actualitzar               |

**RPC `beer_by_barcode(code text) → uuid | null`** — normalitza el codi i retorna la cervesa aprovada, seguint `merged_into` fins a la fitxa final.

### Normalització i deduplicació

Mòdul TypeScript pur, **compartit** entre l'importador (Node) i la Edge Function (Deno), a `supabase/functions/_shared/catalog/`. Testat amb `node --test`.

- **Codis de barres:** només dígits; UPC-A (12) → GTIN-13 amb un 0 al davant; GTIN-14 amb 0 inicial → 13; EAN-8 es queda en 8; UPC-E → s'expandeix a UPC-A → GTIN-13; dígit de control invàlid → descartat.
- **Marca i cervesera d'una fila d'OFF:** la marca és el primer element de `brands` (decisió teva: marca i cervesera són coses diferents). La cervesera només s'omple quan el `brand_key` coincideix **exactament** amb el `name_key` d'**una sola** cervesera d'Open Brewery DB (normalitzant i traient sufixos com `brewery`, `brewing co`, `brauerei`, `brasserie`, `brouwerij`, `cervecera`, `birrificio`). Si no coincideix, o en coincideix més d'una, `brewery_id` queda buit. No s'inventen cerveseres a partir de marques.
- **`name_key` de la cervesa:** minúscules, sense accents ni puntuació, sense el nom de la marca, sense paraules genèriques en ca/es/en/fr/de/nl (`beer`, `cerveza`, `cervesa`, `bière`, `bier`, `bierre`…) i sense volums/formats (`33cl`, `500 ml`, `can`, `pack`, `6x`). Si en treure-ho tot queda buit, el nom és el de la marca (cas "Bud" → "bud"). Mateixa (`brand_key`, `name_key`) = mateixa cervesa → els codis s'afegeixen a la mateixa fila.
- **Nom per mostrar:** el més freqüent entre les files agrupades, amb majúscules de títol si venia tot en minúscules o majúscules.
- **ABV / estil / imatge** quan les files agrupades no coincideixen: ABV = la moda (ignorant valors fora de 0–70); estil = el de la fila més escanejada (`unique_scans_n`) que en tingui; imatge = la de la fila més escanejada que en tingui.
- **Filtre d'entrada:** `categories_tags` conté `en:beers`; `countries_tags` conté algun país d'Europa o `en:united-states`; té `product_name`; no està marcat com a obsolet.

### Importador (`scripts/catalog/`)

1. **Open Brewery DB:** pàgines de 200 → cerveseres d'Europa + EUA → upsert per `obdb_id`.
2. **OFF:** descarrega el CSV en streaming (`fetch` + `DecompressionStream` + lectura per línies), filtra, normalitza i agrupa en memòria (la part filtrada és petita: milers o desenes de milers de files, no milions).
3. **Càrrega:** escriu un fitxer TSV i el carrega amb `psql \copy` a taules de _staging_ (esquema `catalog_import`, no exposat a l'API); una funció SQL `catalog_import.merge()` fa l'upsert dins una transacció. L'upsert busca primer per **codi de barres** existent (així una cervesa ja importada conserva el seu `id` encara que en canviï el nom) i després per (cervesera, `name_key`).
4. **Què canvia d'una cervesa que ja existeix:** mai el nom, la marca ni les claus (`name_key`, `brand_key`), perquè una reimportació no pugui xocar amb una altra fila ni moure una cervesa de lloc. Sí que omple camps buits i actualitza `abv`, `style_code`, imatge, `country` i `brewery_id` quan OFF/OBDB tenen un valor diferent i no buit. Les cerveses `source = 'user'` no es toquen mai.
5. **Conflictes:** si els codis d'un grup ja apunten a dues o més cerveses existents, no es fusiona res automàticament: els codis nous van a la més antiga i el conflicte surt a l'informe (per fusionar-les a mà amb `merge_beers`).
6. **No esborra res:** un codi que desapareix d'OFF es queda. Evitar perdre `id` amb posts penjats és més important que la puresa.
7. Mode `--dry-run` que mostra recomptes (files llegides, filtrades, cerveses, codis, cerveseres noves) i 50 exemples de grups fusionats per revisar-los a ull.
8. **GitHub Action** `catalog-import.yml`: mensual + `workflow_dispatch`, contra dev i prod amb els secrets `SUPABASE_DB_URL_*` que ja existeixen (salta si no hi són, com `maintenance.yml`).

### Cerca en viu (Edge Function `beer-lookup`)

- Entrada: `{ barcode }`, amb el JWT de l'usuari (només usuaris autenticats).
- Normalitza; si ja existeix → retorna `{ status: 'found', beerId }`.
- Si no, `GET /api/v2/product/<codi>` a OFF amb User-Agent `BeerApp/<versió> (<URL del repo>)`, timeout 5 s.
  - Producte trobat i és cervesa (`categories_tags` conté `en:beers`; **sense** filtre de país: si algú l'escaneja és que la beu aquí) → mateixa normalització i mateixa política d'upsert que l'importador → `{ status: 'imported', beerId }`.
  - Trobat però no és cervesa → `{ status: 'not_beer' }`. No trobat → `{ status: 'not_found' }`. OFF caigut/timeout → `{ status: 'unavailable' }`.
- **Límit:** 30 cerques en viu per usuari i hora (taula `catalog_import.lookups` amb `user_id`, `created_at`); passat el límit → `{ status: 'rate_limited' }`.

### App

Nova feature `features/beers`:

- `api/`: `useBeer(id)` (fitxa amb cervesera i estil), `findBeerByBarcode(code)` (RPC i, si no hi és, Edge Function).
- `screens/beer-screen.tsx` a `/beer/[id]`: imatge (o un placeholder 🍺), nom, marca, cervesera (i ciutat) només si se sap, estil traduït, % alcohol ("—" si no se sap), bandera i nom del país, i una línia "Dades: Open Food Facts".
- `screens/scan-screen.tsx` a `/scan` (modal a pantalla completa): `expo-camera` `CameraView` amb EAN-13, EAN-8, UPC-A i UPC-E; marc guia; ignora lectures repetides mentre consulta; estats: demanant permís, permís denegat (botó a Ajustos), cercant, "no la tenim" (amb el codi, i el text "aviat podràs afegir-la"), "no és una cervesa", "Open Food Facts no respon", "massa cerques, torna-ho a provar més tard".
- **Entrada a l'escàner:** la pestanya Cerca (ara buida) mostra un botó "Escaneja una cervesa" (decisió meva: és l'únic lloc que té sentit fins al cercador de l'S6, que el mantindrà).
- **Sobre l'app** a `/about`, enllaçada des de "El meu perfil": versió de l'app i atribucions (OFF: ODbL + CC BY-SA; Open Brewery DB; més endavant OpenStreetMap).
- Tots els textos a ca/es/en.

### GitHub

- Les subtasques de l'S2 es creen amb `npm run backlog -- --tasks S2`. Abans, al pla (`docs/PLAN.md`) s'actualitza: US-202 T2 → S5, US-202 T3 → S7, i la T3 de US-204 queda com "missatge 'no la tenim' amb el codi; el formulari arriba amb la US-203".
- Ordre de branques com a l'S1: `feature/us-201…`, `feature/us-204…`, `feature/us-202…`.

## Com es provarà

- **`node --test`** (mòdul de normalització): casos reals de la mostra d'OFF (Heineken "Heineken Beer"/"Heineken Lager Beer" → mateixa clau; "bud" de marca "Bud"; "Beer" de marca "Coors Light"; "Marks & Spencer" amb dues cerveses diferents que **no** s'han de fusionar; "Sierra Nevada" casa amb "Sierra Nevada Brewing Co." d'OBDB; una marca que casa amb dues cerveseres d'OBDB queda sense cervesera); codis UPC-A/EAN-13/EAN-8/UPC-E i dígits de control; filtre de països.
- **pgTAP:** RLS (un usuari autenticat llegeix però no pot inserir ni modificar; anònim no llegeix); `beer_by_barcode` amb codi UPC-A troba la mateixa cervesa que amb EAN-13; `catalog_import.merge()` executat dos cops no duplica res ni canvia `id`; una reimportació amb un nom diferent no canvia el nom; una cervesa `user` no es toca; `beer_by_barcode` segueix `merged_into`; codis que apunten a dues cerveses → van a la més antiga; un codi nou d'una cervesa existent s'hi afegeix; `catalog_import` no és accessible per a `authenticated`.
- **Jest:** fitxa (amb i sense ABV/imatge/estil), estats de l'escàner amb la càmera mockejada, `findBeerByBarcode` (trobada a la BD → no crida la Edge Function).
- **Edge Function:** tests de Deno amb `fetch` d'OFF mockejat (cervesa, no cervesa, 404, timeout, límit per usuari).
- **Manual:** `--dry-run` contra el bolcat real i revisar els 50 grups fusionats; importació a la BD local i a dev; escàner amb build de desenvolupament en un Android real amb 5 cerveses de casa (almenys una que no sigui al catàleg).

## Decisions meves (revisa-les)

1. Taula `beer_barcodes` en lloc d'una columna `barcodes[]`.
2. Reimportació: mai canvia nom, marca ni claus; omple i actualitza la resta.
3. Columna `merged_into` des d'ara, sense fusions automàtiques.
4. La cerca en viu no filtra per país.
5. País de la cervesa = **país d'origen** (cervesera o `origins` d'OFF), no on es ven; si no se sap, buit.
6. Estils: llista tancada d'~20, traduïda a l'app, deduïda de les categories d'OFF.
7. Imatges enllaçades d'OFF, no copiades.
8. L'importador no esborra mai cerveses ni codis.
9. Límit de 30 cerques en viu per usuari i hora.
10. Escàner accessible des de la pestanya Cerca.
11. Pantalla "Sobre l'app" enllaçada des del perfil.

## Ordre de feina proposat

1. **US-201 T1** — migracions (`beer_styles` + seed, `breweries`, `beers`, `beer_barcodes`, `beer_by_barcode`, `catalog_import`).
2. **US-201 T4** — mòdul de normalització i deduplicació (amb tests).
3. **US-201 T3** — importador d'Open Brewery DB.
4. **US-201 T2** — importador d'OFF + `merge()` + GitHub Action.
5. **US-201 T5** — pantalla "Sobre l'app".
6. **US-202 T1** — fitxa de cervesa.
7. **US-204 T2** — Edge Function `beer-lookup` + `findBeerByBarcode`.
8. **US-204 T1 + T3** — escàner i estats.

## Què queda en mans de qui ho construeixi

Estructura interna de l'script i dels components, llista exacta de paraules genèriques i d'estils (mentre compleixin els tests de la mostra), noms de fitxers, disseny visual dins del tema existent, com es divideixen les migracions i els detalls del parser del CSV.
