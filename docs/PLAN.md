# 🍺 BeerApp — Pla complet del projecte

> Nom provisional: **BeerApp** (el canviem quan vulguis; cal comprovar disponibilitat a les stores).
> Directori: `/Users/biel/Documents/PROJECTS/beerApp` (ara buit).

---

## 0. Context

Xarxa social per registrar **quines cerveses beus, on, quan i amb qui**. Cada usuari té perfil, amics, un feed estil LinkedIn (posts dels amics amb reaccions i comentaris), estadístiques i logros. Peça diferencial: **verificació** que la cervesa s'ha begut de debò (foto del tirador o de l'ampolla). A més: cercador unificat (persones + cerveses) i un **mapa de bars** (Europa + USA) amb quines cerveses tenen i a quin preu, alimentat pels mateixos usuaris (model Waze).

Restriccions: un sol codi per iOS i Android, cost de servidor ~0 €, desenvolupament en solitari però amb bones pràctiques (sprints, user stories, subtasques → branques, PRs, CI).

Costos fixos inevitables: **Apple Developer 99 $/any**, **Google Play 25 $ (un sol cop)**. Tota la resta del pla és gratuït.

---

## 1. Stack tecnològic (decisió)

| Capa | Tria | Per què |
|---|---|---|
| Llenguatge | **TypeScript** | Tipus compartits amb la BD (generats automàticament des de Supabase). |
| Framework mòbil | **React Native + Expo (SDK actual) + Expo Router** | Un sol codi, builds al núvol (EAS) sense necessitat de gestionar Xcode/Gradle a mà, actualitzacions OTA, camera/barcode/location/notificacions ja resolts amb mòduls oficials. |
| Estat servidor | **TanStack Query** | Cache, paginació infinita (feed), optimistic updates (reaccions). |
| Estat local | **Zustand** | Mínim (draft del post, preferències). |
| Formularis | **react-hook-form + zod** | Validació tipada i reutilitzable. |
| Mapa | **MapLibre React Native + tiles d'OpenFreeMap** | Gratuït, sense API key ni compte de facturació (Google Maps exigeix targeta encara que sigui free). |
| Càmera / codi de barres | **expo-camera** (escaneig EAN/UPC integrat) + **expo-image-manipulator** | Foto in-app + compressió abans de pujar. |
| Ubicació | **expo-location** | Per verificació i bars propers. |
| i18n | **i18next** (ca, es, en) | Europa + USA. |
| Tests | **Jest + React Native Testing Library**, **Maestro** (E2E), **pgTAP** (BD i RLS) | Tots gratuïts. |
| Qualitat | ESLint, Prettier, TypeScript strict, **lefthook + commitlint** | Bones pràctiques git. |
| CI/CD | **GitHub Actions** + **EAS Build/Submit/Update** (pla free) | |

> Alternativa considerada: Flutter. És igual de vàlid, però amb Supabase + Expo tens l'ecosistema més rodó per a un dev sol i els tipus de la BD arriben directament al client.

---

## 2. Backend gratuït — opcions per valorar

| | **Supabase** ⭐ (recomanat) | Firebase | PocketBase a VM gratuïta (Oracle Always Free) | Appwrite Cloud |
|---|---|---|---|---|
| Base de dades | **Postgres** (SQL, joins, agregacions) + **PostGIS** | Firestore (NoSQL) | SQLite | MariaDB (abstreta) |
| Free tier (aprox., verificar abans d'arrencar) | 500 MB BD, 1 GB storage, 5 GB egress, 50k MAU, 2 projectes | 1 GB Firestore, 50k lectures/dia; **Storage i Functions exigeixen pla Blaze (targeta)** | Il·limitat dins la VM (4 cores ARM, 24 GB RAM) | Limitat, similar a Supabase |
| Auth | ✅ email, Apple, Google | ✅ | ✅ | ✅ |
| Storage fotos | ✅ | ⚠️ cal Blaze | ✅ disc VM | ✅ |
| Geo-consultes (bars a prop) | ✅ PostGIS natiu | ⚠️ geohash manual | ⚠️ manual | ⚠️ manual |
| Stats (%, rànquings) | ✅ SQL/vistes | ❌ costós en lectures | ✅ SQL | ⚠️ |
| Seguretat | Row Level Security a la BD | Security rules | Rules | Permisos |
| Funcions servidor | Edge Functions (Deno), 500k/mes | Cloud Functions (Blaze) | Hooks JS/Go | Functions |
| Contres | El projecte free **es pausa després de 7 dies sense activitat**; sense backups descarregables | Model NoSQL dolent per a stats; risc de factura | Tu fas d'administrador (updates, backups, seguretat) | Comunitat menor |

**Recomanació: Supabase.** El domini (xarxa social + estadístiques + mapa) és molt relacional i geogràfic; Postgres + PostGIS + RLS és exactament el que cal i no et cobra res.

Mitigacions del free tier:
- **Pausa per inactivitat** → GitHub Action cron que fa un ping diari a la BD.
- **Backups** → GitHub Action setmanal amb `pg_dump` desat com a artifact privat.
- **1 GB d'storage** → compressió al client (1080 px, JPEG ~70 % ≈ 150–250 KB) + miniatura; ~5.000 fotos. Capa `storage` abstreta perquè, si cal, migrem fotos a **Cloudflare R2** (10 GB free, egress gratuït) sense tocar l'app.
- **Entorns**: 2 projectes free → `beerapp-dev` i `beerapp-prod`. Desenvolupament local amb **Supabase CLI** (Docker) i migracions versionades al repo.

---

## 3. Fonts de dades externes (gratuïtes)

| Necessitat | Font | Notes |
|---|---|---|
| Catàleg de cerveses | **Open Food Facts** (categoria *beers*, amb codi de barres, marca, % alcohol, imatge) + **Open Brewery DB** (cerveseres) | Llicència ODbL → atribució. Seed inicial + importació incremental. Untappd/BreweryDB no són opció (API tancada/morta). |
| Cerveses que falten | **Crowdsourcing**: l'usuari la crea; queda "pendent de revisió" i es deduplica per nom normalitzat + cervesera + codi de barres | |
| Bars / pubs | **OpenStreetMap via Overpass API** (`amenity=bar|pub|biergarten`, `craft=brewery`, `microbrewery=yes`) | **Càrrega mandrosa per cel·les geohash** (veure US-701). Atribució "© OpenStreetMap contributors". Només bbox Europa + USA. |
| Cerca de bars per nom/adreça | Taula pròpia (pg_trgm) + **Photon (komoot)** com a fallback | Ús just, sense key. |
| Cerveses i preus de cada bar | **Usuaris (model Waze)** | Pregunta després de cada post en un bar. |

---

## 4. Arquitectura

```
beerApp/
├─ app/                      # Expo (React Native)
│  ├─ src/app/               # Expo Router: (auth), (tabs)/feed, search, map, profile, post/new...
│  ├─ src/features/<feature>/{api,components,hooks,screens,types}.ts
│  │     auth · profile · beers · venues · posts · verification · social
│  │     feed · tags · search · stats · achievements · notifications · moderation
│  ├─ src/shared/{ui,lib,i18n,theme,storage}
│  └─ src/types/database.ts  # generat amb `supabase gen types`
├─ supabase/
│  ├─ migrations/            # SQL versionat (taules, RLS, funcions, triggers)
│  ├─ functions/             # Edge Functions (venues-sync, push-dispatch, beer-import...)
│  ├─ tests/                 # pgTAP (RLS i funcions)
│  └─ seed.sql
├─ scripts/                  # importadors (Open Food Facts), utilitats
├─ docs/                     # ADRs, privacy policy (GitHub Pages), backlog
└─ .github/                  # workflows, plantilles d'issue i PR, CODEOWNERS
```

### Model de dades (Postgres)

- `profiles` (id = auth.users, username únic, display_name, avatar, bio, birthdate, country, is_private)
- `friendships` (user_low, user_high, status `pending|accepted`, requested_by) — amistat mútua
- `blocks`, `reports`
- `breweries`, `beer_styles`, `beers` (name, brewery_id, style_id, abv, country, barcodes[], image, source `off|user`, status `approved|pending`)
- `venues` (osm_id, name, type, `location geography(Point)`, address, country, source) + `venue_tiles` (geohash, synced_at)
- `venue_beers` (venue_id, beer_id, serving `tap|bottle|can`, confirmations, last_confirmed_at)
- `venue_beer_prices` (venue_id, beer_id, serving, volume_ml, price, currency, reported_by, reported_at)
- `posts` (author_id, beer_id, venue_id?, serving, volume_ml?, consumed_at, is_retroactive, publish_to_feed, caption, rating?, verification_level, created_at)
- `post_photos` (post_id, path, thumb_path, taken_in_app, exif_taken_at, lat, lng)
- `post_tags` (post_id, tagged_user_id, status `active|removed`)
- `reactions` (post_id, user_id, type) — una per usuari i post
- `comments` (post_id, author_id, body, parent_id?)
- `achievements` (code, name, description, icon, tier, `criteria jsonb`) + `user_achievements`
- `notifications`, `push_tokens`
- Vistes/funcions: `get_feed(cursor)`, `get_user_stats(user_id)`, `search(q, kind)`, `venues_in_bbox(...)`, `evaluate_achievements(user_id)`

Tota la seguretat via **RLS**: només veus posts teus, d'amics, o de perfils públics; ningú no pot escriure en nom d'un altre.

---

## 5. Sistema de verificació (la gràcia de l'app)

Cada post té un **nivell de verificació** calculat al servidor (Edge Function/trigger), no al client:

| Nivell | Requisits |
|---|---|
| 🟢 **Verificada** | Foto feta **amb la càmera de l'app** (no galeria) + `consumed_at` ≈ ara + si hi ha bar, GPS a ≤ 150 m del bar + **evidència del format**: ampolla/llauna → codi de barres escanejat que coincideix amb la cervesa; tirador → foto del tirador (amb validació on-device, veure fase 2) |
| 🟡 **Parcial** | Foto in-app però falta algun requisit (sense GPS, codi de barres que no coincideix, etc.) |
| ⚪ **No verificada / Retroactiva** | Foto de galeria, sense foto, o registre del passat |

Regles:
- Les stats personals compten **totes** (és el teu registre); els **logros "de prestigi" i rànquings entre amics** només compten 🟢.
- Retroactius: es pot triar data/hora passada; si la foto de galeria té EXIF es proposa aquesta data. Toggle "**Publicar al feed**" (per defecte OFF si és de fa més de 48 h) → si no, només va al registre.
- **Fase 2 de verificació** (backlog): ML Kit on-device (gratuït) per *image labeling* ("bottle", "beer", "tap") i **OCR de l'etiqueta** per comparar amb el nom de la cervesa; **confirmació social** (un amic etiquetat pot "confirmar").
- Honestedat: GPS falsejable, etc. És un joc, no un banc → objectiu = fer que fer trampes sigui més pesat que no fer-ne.

---

## 6. Workflow de Git i GitHub

**Jerarquia a GitHub (Issues + Projects v2):**
- **Epic** → issue amb label `epic` (ex. `EPIC-07 · Feed`)
- **User Story** → issue `US-701 · Veure el feed d'amics` (sub-issue de l'epic), amb criteris d'acceptació i story points
- **Subtasca** → sub-issue `US-701-T2 · RPC get_feed amb paginació`
- **Sprint** = camp *Iteration* del Project (2 setmanes) + Milestone
- Board: `Backlog → Sprint backlog → In progress → In review → Done`

**Branques:**
```
main                                   ← sempre publicable, protegida
 └─ feature/us-701-feed                ← branca de la US (des de main)
     ├─ task/us-701-t1-feed-schema     ← una branca per subtasca (des de la US)
     └─ task/us-701-t2-feed-rpc
fix/<issue>-descripcio                 ← bugs (des de main)
chore/<descripcio>                     ← manteniment
```
- PR **task → feature**: *squash merge* (1 commit net per subtasca, `Closes #<subissue>`).
- PR **feature → main**: *merge commit* (a l'historial es veu cada US com un bloc amb les seves subtasques). `Closes #<US>`.
- **Conventional Commits**: `feat(feed): add infinite scroll (#123)`; validat amb commitlint via lefthook.
- **Protecció de `main`**: PR obligatòria, CI en verd, historial lineal dins les features, 0 aprovacions (ets sol) però sempre auto-revisió amb checklist.
- **Releases**: tag semver `vX.Y.Z` a `main` → workflow EAS build + submit; *release notes* automàtiques des dels PRs. Hotfix JS → EAS Update (OTA).
- **Definition of Done** (a la plantilla de PR): tests passen · tipus OK · migració + test RLS si toca BD · i18n (ca/es/en) · provat a iOS i Android · captura si és UI · docs/ADR si hi ha decisió.
- **Script** `scripts/create-backlog.ts` que crea epics/US/subtasques a GitHub amb `gh` a partir d'aquest pla (així no ho fas a mà).

---

## 7. Backlog: Epics, User Stories i subtasques

Format: **US-XYY** (X = epic). Punts orientatius (Fibonacci). Cada subtasca = una branca `task/...`.

### EPIC 0 — Fonaments (Sprint 0)

**US-001 · Repositori i convencions** (3)
Com a dev vull un repo amb convencions clares per treballar ordenat.
- T1 Crear repo GitHub, README, LICENSE, `.gitignore`, `.editorconfig`
- T2 Plantilles d'issue (epic, US, task, bug) i de PR amb DoD
- T3 lefthook + commitlint + Prettier + ESLint
- T4 Protecció de `main`, labels, GitHub Project amb iteracions
- T5 Script `create-backlog` per importar aquest backlog

**US-002 · Projecte Expo base** (3)
- T1 `create-expo-app` amb TypeScript strict i Expo Router
- T2 Estructura per features + alias de paths
- T3 Theme (colors, tipografia, dark mode) i components UI base (Button, Input, Avatar, Card, Sheet)
- T4 i18next amb ca/es/en
- T5 Navegació per tabs: Feed · Cerca · ➕ · Mapa · Perfil (pantalles buides)

**US-003 · Backend Supabase** (3)
- T1 Supabase CLI local + estructura `supabase/`
- T2 Crear projectes `dev` i `prod`; variables d'entorn per perfil EAS
- T3 Client Supabase a l'app + generació de tipus (`npm run db:types`)
- T4 pgTAP configurat amb un primer test

**US-004 · CI/CD** (3)
- T1 Workflow PR: lint, typecheck, tests Jest
- T2 Workflow BD: `supabase db reset` + pgTAP
- T3 EAS: perfils `development`, `preview`, `production`
- T4 Workflow de release per tag + EAS Update
- T5 Cron keep-alive i backup setmanal (`pg_dump`)

### EPIC 1 — Autenticació i perfil

**US-101 · Registre i login** (5)
Com a usuari vull registrar-me amb email, Apple o Google.
- AC: Sign in with Apple obligatori a iOS si hi ha login social; sessió persistent; logout.
- T1 Pantalles login/registre/recuperar contrasenya
- T2 Email + magic link/OTP
- T3 Sign in with Apple
- T4 Sign in with Google
- T5 Guard de rutes i persistència de sessió

**US-102 · Verificació d'edat** (2)
Com a plataforma he d'assegurar que l'usuari té l'edat legal.
- AC: data de naixement obligatòria; 18+ (21+ si país = US); bloqueig si no compleix.
- T1 Pas d'onboarding amb data i país
- T2 Validació al servidor (constraint/trigger)

**US-103 · Crear i editar el meu perfil** (3)
- T1 Taula `profiles` + RLS + trigger de creació
- T2 Onboarding: username únic (comprovació en viu), nom, avatar
- T3 Pujada d'avatar comprimit a Storage
- T4 Pantalla d'edició (bio, país, perfil privat/públic)

**US-104 · Veure el perfil d'algú** (3)
- AC: capçalera, botó d'amistat, resum stats, grid de posts; si és privat i no ets amic → només capçalera.
- T1 Pantalla perfil reutilitzable (meu / aliè)
- T2 Grid de posts paginat
- T3 Estats de privacitat

### EPIC 2 — Catàleg de cerveses

**US-201 · Catàleg inicial** (5)
- T1 Migracions `breweries`, `beer_styles`, `beers` (+ pg_trgm, índexs)
- T2 Script d'importació Open Food Facts (filtre beers, Europa+USA)
- T3 Import d'Open Brewery DB
- T4 Normalització i deduplicació (nom + cervesera)
- T5 Atribucions de llicència a "Sobre l'app"

**US-202 · Fitxa de cervesa** (3)
Com a usuari vull veure la info d'una cervesa i qui dels meus amics l'ha begut.
- T1 Pantalla fitxa (imatge, cervesera, estil, % alcohol, país)
- T2 "L'has begut X vegades" + amics que l'han begut
- T3 On la serveixen (bars propers, enllaç al mapa)

**US-203 · Afegir una cervesa que no existeix** (3)
- AC: formulari mínim; queda `pending`; avís de possibles duplicats mentre escrius.
- T1 Formulari + suggeriments de duplicats
- T2 Estat `pending` visible només per a qui la crea fins revisió
- T3 Cua de revisió (vista d'admin simple)

**US-204 · Identificar cervesa per codi de barres** (3)
- T1 Escàner amb expo-camera
- T2 Cerca per barcode a la BD; si no hi és, consulta en viu a Open Food Facts i importa
- T3 Si no existeix enlloc → flux US-203 amb el codi pre-omplert

### EPIC 3 — Posts (registre de cerveses)

**US-301 · Crear un post bàsic** (8)
Com a usuari vull publicar quina cervesa estic bevent.
- AC: cervesa obligatòria; format (tirador/ampolla/llauna); volum opcional; foto; text opcional; data = ara.
- T1 Migracions `posts`, `post_photos` + RLS
- T2 Flux de creació multi-pas (cervesa → foto → detalls → publicar)
- T3 Càmera in-app + compressió + miniatura + pujada
- T4 Draft local (Zustand) per no perdre dades
- T5 Pantalla de detall del post

**US-302 · Registre retroactiu** (3)
Com a usuari vull afegir una cervesa que vaig beure fa temps.
- AC: data/hora passada; foto de galeria opcional (EXIF suggereix data); marcada com a retroactiva; toggle "publicar al feed".
- T1 Selector de data/hora i toggle
- T2 Lectura EXIF de la foto de galeria
- T3 Lògica `is_retroactive` + `publish_to_feed`

**US-303 · Editar i esborrar un post** (2)
- T1 Edició de camps permesos (no la foto ni la data si està 🟢 → perdria verificació)
- T2 Esborrat amb confirmació (i fotos de Storage)

**US-304 · El meu historial** (3)
- T1 Llista/calendari dels meus registres (incloent no publicats al feed)
- T2 Filtres per cervesa, bar, data, amic

**US-305 · Puntuació opcional** (2) *(opcional)*
- T1 Rating 0–5 amb mitges al post
- T2 Mitjana a la fitxa de cervesa

### EPIC 4 — Amistats

**US-401 · Enviar i acceptar sol·licituds** (5)
- T1 Taula `friendships` + RLS + funcions `send/accept/decline/remove`
- T2 Botó d'estat al perfil (Afegir / Pendent / Amics)
- T3 Pantalla de sol·licituds rebudes
- T4 Llista d'amics al perfil

**US-402 · Bloquejar usuaris** (2) *(obligatori per App Store, guideline 1.2)*
- T1 Taula `blocks` + efecte a RLS (no et veuen ni t'etiqueten)
- T2 Pantalla de bloquejats

**US-403 · Suggeriments d'amics** (2) *(backlog)*
- T1 "Amics d'amics" i gent amb qui has coincidit en bars

### EPIC 5 — Feed, reaccions i comentaris

**US-501 · Feed d'amics** (5)
- AC: posts propis + d'amics amb `publish_to_feed`; ordenat per data de publicació; scroll infinit; pull-to-refresh.
- T1 RPC `get_feed(cursor)` amb paginació per cursor
- T2 Component `PostCard` (autor, foto, cervesa, bar, data, etiquetats, badge de verificació)
- T3 Llista infinita amb TanStack Query
- T4 Estats buit/error/càrrega (empty state: "afegeix amics")

**US-502 · Reaccionar a un post** (3)
- AC: diverses reaccions (🍺 Salut, 🔥, 😂, 🤤…); una per usuari; canviable; comptador i llista de qui ha reaccionat.
- T1 Taula `reactions` + RLS
- T2 Selector de reacció (long-press) amb optimistic update
- T3 Full inferior amb qui ha reaccionat

**US-503 · Comentar un post** (3)
- T1 Taula `comments` + RLS (respostes d'un nivell)
- T2 Pantalla de comentaris amb input
- T3 Esborrar comentari propi / del meu post

### EPIC 6 — Etiquetar persones

**US-601 · Etiquetar amics en un post** (3)
- AC: només amics; l'etiqueta no implica que hagin begut el mateix; apareixen al post.
- T1 Taula `post_tags` + RLS
- T2 Selector d'amics al flux de creació
- T3 Visualització al `PostCard`

**US-602 · Gestionar on m'han etiquetat** (3)
- T1 Notificació "X t'ha etiquetat"
- T2 Treure'm l'etiqueta
- T3 Botó "**Jo també hi era → registra la meva**": nou post pre-omplert amb bar, data i persones (cervesa a triar)

### EPIC 7 — Bars i mapa

**US-701 · Model de bars i sincronització OSM** (8)
- T1 Migracions `venues`, `venue_tiles` + PostGIS + índex GIST
- T2 Edge Function `venues-sync`: donada una bbox, calcula cel·les geohash (precisió 5 ≈ 5 km), les que no estan sincronitzades o tenen > 30 dies → Overpass → upsert
- T3 Limitació a Europa + USA i rate limiting
- T4 RPC `venues_in_bbox` / `venues_near(point, radius)`

**US-702 · Mapa de bars** (5)
- T1 MapLibre + OpenFreeMap + atribució OSM
- T2 Càrrega de bars per viewport (amb zoom mínim) + clustering
- T3 Ubicació actual i botó "centrar"
- T4 Fitxa de bar (bottom sheet): nom, adreça, cerveses, preus, posts recents d'amics

**US-703 · Etiquetar el bar al post** (3)
- T1 Suggeriment de bars propers via GPS al flux de creació
- T2 Cerca de bar per nom (pg_trgm + Photon)
- T3 Crear bar manualment si no existeix (pin al mapa)

**US-704 · Filtrar el mapa** (3)
- T1 Filtre "bars que tenen la cervesa X"
- T2 Filtre per format (tirador) i "on han begut els meus amics"

### EPIC 8 — Crowdsourcing de cartes i preus (model Waze)

**US-801 · Preguntar quines cerveses té el bar** (5)
Com a usuari, després de publicar en un bar, vull indicar quines altres cerveses hi ha.
- AC: prompt post-publicació, saltable; selecció ràpida de les ja conegudes ("Encara la tenen?" Sí/No) + afegir-ne.
- T1 Taula `venue_beers` + funcions de confirmació/negació
- T2 Bottom sheet post-publicació
- T3 Lògica de frescor: confiança decau amb el temps; s'amaga si fa > 6 mesos sense confirmar o hi ha més "No" que "Sí"

**US-802 · Informar del preu** (3)
- T1 Taula `venue_beer_prices` (preu, moneda per país, volum)
- T2 Input de preu al mateix prompt
- T3 Mostrar preu mediana recent i data de l'última actualització

**US-803 · Reconeixement als col·laboradors** (2)
- T1 Comptador de contribucions al perfil (alimenta logros)

### EPIC 9 — Verificació

**US-901 · Nivells de verificació** (5)
- T1 Camp `verification_level` + funció de càlcul al servidor
- T2 Marcar `taken_in_app` (pujada signada des del flux de càmera; la galeria no ho pot falsejar)
- T3 Comprovació de distància GPS ↔ bar (PostGIS)
- T4 Badge 🟢🟡⚪ al `PostCard` amb explicació

**US-902 · Evidència per format** (5)
- AC: ampolla/llauna → escanejar codi de barres (ha de coincidir); tirador → foto del tirador amb guia visual a la càmera.
- T1 Flux de càmera adaptat al format triat (overlay de guia)
- T2 Validació barcode ↔ cervesa
- T3 Regles de comptatge (logros de prestigi i rànquings només 🟢)

**US-903 · Verificació intel·ligent** (8) *(fase 2, backlog)*
- T1 ML Kit image labeling on-device
- T2 OCR de l'etiqueta i matching amb el nom
- T3 Confirmació social d'un amic etiquetat

### EPIC 10 — Cercador

**US-1001 · Cercador unificat** (5)
- AC: un sol input; pestanyes **Tot · Persones · Cerveses** (i Bars en el futur); resultats mentre escrius (debounce); cerca tolerant a errors.
- T1 RPC `search(q, kind, limit)` amb pg_trgm + unaccent
- T2 Pantalla amb pestanyes i resultats mixtos
- T3 Cerques recents (local)
- T4 Accions directes: afegir amic / obrir fitxa de cervesa

### EPIC 11 — Estadístiques

**US-1101 · Stats bàsiques al perfil** (5)
- Total de cerveses, **cerveses úniques**, litres estimats, països, estils, cerveseres, bars visitats.
- T1 RPC `get_user_stats` (o vista materialitzada refrescada per trigger)
- T2 Components de targetes de stats

**US-1102 · Percentatges** (5)
- **% del catàleg** begut (global, per país, per cervesera — "has provat el 40 % de les cerveses de Damm" —, per estil).
- T1 Consultes de percentatge amb índexs
- T2 UI amb barres de progrés i drill-down

**US-1103 · Stats avançades** (5)
- Heatmap tipus calendari, ratxes, dia/hora preferits, top cerveses, top bars, **company habitual** (amic més etiquetat), mapa personal de bars visitats.
- T1 Consultes
- T2 Gràfics (victory-native o react-native-gifted-charts)
- T3 Mapa personal

**US-1104 · Comparar-me amb un amic** (3) *(backlog)*

### EPIC 12 — Logros

**US-1201 · Motor de logros** (5)
- T1 Taules `achievements` (criteris en `jsonb`) + `user_achievements`
- T2 Funció `evaluate_achievements(user_id)` disparada en crear post/contribució
- T3 Seed amb ~30 logros inicials, per exemple:
  - Primera cervesa · 10/50/100/500 úniques · 5/10/25 països · 10 estils
  - Explorador de bars (10/50 bars) · Fidel (10 cops al mateix bar)
  - Social (10 posts amb amics) · Waze cerveser (25 aportacions de carta/preu)
  - Verificat (50 posts 🟢) · Ratxa de 4 caps de setmana
  - Completista (100 % d'una cervesera)

**US-1202 · Mostrar logros** (3)
- T1 Vitrina al perfil (bloquejats en gris amb progrés)
- T2 Animació/toast en desbloquejar + post automàtic opcional al feed

### EPIC 13 — Notificacions

**US-1301 · Notificacions in-app** (3)
- T1 Taula `notifications` + triggers (sol·licitud, acceptació, reacció, comentari, etiqueta, logro)
- T2 Pantalla de notificacions amb marcar com a llegides

**US-1302 · Push** (3)
- T1 Registre de tokens amb expo-notifications
- T2 Edge Function `push-dispatch` (Expo Push Service, gratuït) via Database Webhooks
- T3 Preferències de notificació per tipus

### EPIC 14 — Moderació, privacitat i compliment de les stores

**US-1401 · Reportar contingut i usuaris** (3) *(obligatori App Store 1.2 per contingut generat per usuaris)*
- T1 Taula `reports` + botó reportar a post/comentari/perfil
- T2 Panell d'admin mínim (rol `admin` + pantalla oculta) per amagar/esborrar

**US-1402 · Esborrar el compte des de l'app** (2) *(obligatori Apple i Google)*
- T1 Edge Function que esborra dades + fotos + usuari auth

**US-1403 · RGPD** (3)
- T1 Política de privacitat i termes a GitHub Pages
- T2 Exportació de les meves dades (JSON)
- T3 Consentiments (ubicació, notificacions) amb textos clars

**US-1404 · Missatges de consum responsable** (1)
- T1 Avís a l'onboarding i a "Sobre l'app"

### EPIC 15 — Llançament

**US-1501 · Fitxes de les stores** (3)
- T1 Icona, splash, captures, descripcions ca/es/en
- T2 Classificació d'edat (alcohol: 17+ App Store / qüestionari IARC Google Play)
- T3 Textos de permisos (càmera, ubicació, fotos)

**US-1502 · Beta tancada** (3)
- T1 TestFlight + Google Play Internal Testing amb amics
- T2 Recollida de feedback (issues amb label `beta-feedback`)
- T3 Sentry (free tier) per errors

**US-1503 · Release 1.0** (2)
- T1 Tag `v1.0.0` → EAS build + submit
- T2 Revisió App Review / Play review i correccions

---

## 8. Planificació per sprints (2 setmanes, dev en solitari)

| Sprint | Objectiu | US |
|---|---|---|
| S0 | Fonaments | US-001 → US-004 |
| S1 | Entrar i tenir perfil | US-101, US-102, US-103 |
| S2 | Catàleg de cerveses | US-201, US-202, US-204 |
| S3 | Registrar cerveses | US-301, US-302, US-303 |
| S4 | Social bàsic | US-401, US-402, US-104 |
| S5 | Feed | US-501, US-502, US-503 |
| S6 | Etiquetes + cercador | US-601, US-602, US-1001, US-203 |
| S7 | Bars i mapa | US-701, US-702, US-703 |
| S8 | Crowdsourcing | US-801, US-802, US-704, US-304 |
| S9 | Verificació | US-901, US-902 |
| S10 | Stats | US-1101, US-1102, US-1103 |
| S11 | Logros + notificacions | US-1201, US-1202, US-1301, US-1302 |
| S12 | Compliment + beta | US-1401 → US-1404, US-1501, US-1502 |
| S13 | Release 1.0 | US-1503 + bugs de la beta |
| Backlog | Fase 2 | US-305, US-403, US-803, US-903, US-1104, migració fotos a R2 |

Fites: **MVP intern** (amics de proves a TestFlight) al final de S5; **beta pública** a S12; **1.0** a S13 (~7 mesos a ritme de side-project).

---

## 9. Verificació (com sabrem que funciona)

- **Cada PR**: lint + typecheck + Jest (lògica i components) + pgTAP (RLS: "un usuari no pot veure posts privats d'un no-amic", "no pot reaccionar en nom d'un altre", etc.).
- **Cada US**: provat en simulador iOS i emulador Android amb build `development`; captures al PR.
- **Fluxos crítics E2E amb Maestro** (a partir de S5): registre → crear post amb foto → l'amic el veu al feed i hi reacciona.
- **Abans de cada release**: build `preview` instal·lada en dispositius reals (càmera, GPS i codi de barres no es poden provar bé en simulador).
- Monitoritzar ús del free tier de Supabase (BD, storage, egress) al dashboard un cop al mes.

---

## 10. Decisions obertes (podem canviar-les)

1. **Nom de l'app** i bundle id (`com.<tu>.beerapp`).
2. **Durada dels sprints**: proposo 2 setmanes.
3. **Amistat mútua vs. seguir** (tipus Instagram): proposo mútua, com has descrit.
4. **Idiomes inicials**: ca/es/en.
5. **Edat mínima USA 21**: proposo aplicar-la segons el país del perfil.

**Primer pas un cop aprovat:** Sprint 0 → crear el repo, l'estructura base i importar aquest backlog a GitHub Issues/Projects amb el script.
