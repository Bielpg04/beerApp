# Sprint 3 · Registrar cerveses — pla d'implementació

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar una cervesa (ara o en el passat, amb foto opcional), veure el post, editar-lo i esborrar-lo.

**Architecture:** Les escriptures passen per funcions SQL `security definer` (`create_post`, `update_post`) que calculen els camps sensibles; la lectura i l'esborrat van per RLS. Les fotos es pugen a un bucket privat abans de crear el post i es llegeixen amb URL signades. A l'app, una feature `posts` amb un flux en passos sobre un esborrany Zustand persistent.

**Tech Stack:** Postgres 17 + pgTAP · Supabase Storage · Expo SDK 58 (expo-image-picker, expo-image-manipulator, `@expo/ui/community/datetime-picker`) · TanStack Query 5 · Zustand 5

**Spec:** `docs/superpowers/specs/2026-11-23-sprint-3-registrar-cerveses-design.md`

## Global Constraints

- Paquets d'Expo amb `npx expo install`; la resta amb versió exacta (`--save-exact`). Única dependència nova: `zustand`.
- Textos visibles a `app/src/shared/i18n/locales/{ca,es,en}.json` (el test de paritat ha de passar). Espai de noms `posts.*`.
- Imports entre features només via `@/features/<feature>`; les rutes de `src/app/` composen features.
- `serving` ∈ `tap | bottle | can`; `volume_ml` 50–5000; `caption` 1–500 (buit → null); una foto per post.
- Retroactiu = `consumed_at` més d'**1 h** abans de `now()` (crear) o de `created_at` (editar); mai torna a `false`.
- `publish_to_feed` per defecte = `consumed_at >= now() - 48 h`.
- `consumed_at` > `now() + 5 min` → `consumed_in_future`; < `2000-01-01` → `consumed_too_old`.
- `verification_level` sempre `unverified` (S9); si és `verified`, `update_post` no deixa canviar la data.
- Bucket `post-photos`: privat, `image/jpeg`, 2 MB; camins `<uid>/<uuid>.jpg` i `<uid>/<uuid>_thumb.jpg`.
- Foto: costat llarg 1080 px JPEG 0,7; miniatura 320 px JPEG 0,6; es puja només en publicar.
- Visibilitat: autor sempre; altres només si `publish_to_feed` i perfil públic i onboarding fet.
- Errors SQL amb `errcode = 'P0001'` i missatge estable; sense sessió `42501`.
- Cada migració → `npm run db:types` i commit del fitxer de tipus. pgTAP es prova en una **BD temporal** (no la local, que té dades): còpia de `supabase/` amb `project_id` i ports propis.
- Git: branca `task/…` (nom exacte al cos de l'issue) → PR _squash_ a la `feature/…`; les US → `main` (_merge commit_) queden obertes.

## Review Focus

1. **L'app es tanca entre pujar la foto i crear el post** (o `create_post` falla) → no queda cap post a mitges i els fitxers pujats s'esborren (best effort). _Test a Task 4._
2. **Un usuari amb perfil públic marca un post "només per a mi"** → cap altre usuari el veu ni pot obtenir-ne la foto, ni coneixent el camí. _Test a Task 1 (RLS de `storage.objects`)._
3. **L'esborrany es restaura després que el sistema hagi netejat la memòria cau** (la foto local ja no existeix) → el flux ho diu i deixa continuar sense foto o triar-ne una altra, sense petar en publicar. _Test a Task 5._
4. **La data EXIF de la galeria és en hora local sense zona** (`2026:11:20 21:15:00`) o falta → es proposa 21:15 hora local del mòbil; sense EXIF no es proposa res. _Test a Task 8._
5. **Esborrar un post quan els fitxers ja no hi són** (segon intent després d'un error) → acaba esborrant la fila sense error. _Test a Task 11._

---

## Fase 0 · `docs/sprint-3-design` (des de `feature/us-204…`)

### Task 0: Pla, backlog i subtasques

**Files:** Modify `docs/PLAN.md`; Create la spec i aquest pla.

- [ ] **Step 1:** `docs/PLAN.md`: US-301-T2 → "Flux de creació multi-pas (cervesa → foto → detalls → publicar) i cerca de cervesa pel nom"; afegir a US-303 **T3 · "Els meus últims registres" al perfil**.
- [ ] **Step 2:** `npm run test:scripts` → PASS.
- [ ] **Step 3:** `npm run backlog -- --dry-run --tasks S3` → 11 subtasques noves (US-301 T1–T5, US-302 T1–T3, US-303 T1–T3) i cap issue més.
- [ ] **Step 4:** Commit `docs: plan sprint 3 (design, plan, backlog)`, push, `npm run backlog -- --tasks S3`, `node scripts/github/setup-project.ts --current S3`; PR a `main` (queda oberta).

## Fase A · `feature/us-301-crear-un-post-basic` (des de `docs/sprint-3-design`)

### Task 1 (US-301-T1): Taules, bucket, RLS i `create_post`

**Files:** Create `supabase/migrations/<ts>_posts.sql`, `supabase/tests/database/060_posts.test.sql`; Modify `app/src/types/database.ts`.

**Interfaces — Produces:**

- Taules `public.posts`, `public.post_photos` (columnes de la spec; `is_retroactive default false`, `publish_to_feed default true`, `verification_level default 'unverified'`).
- `public.can_see_post(author uuid, published boolean) returns boolean` (`security definer`, `stable`).
- `public.create_post(beer_id uuid, serving text, volume_ml int default null, caption text default null, photo jsonb default null) returns uuid` — en aquesta tasca `consumed_at = now()`, no retroactiu, publicat. `photo = { path, thumbPath, source, exifTakenAt, width, height }`.
- Grants: `select` a `authenticated` a les dues taules, `delete` a `posts`; cap `insert`/`update`.

- [ ] **Step 1: Test que falla** — `060_posts.test.sql` (usuaris A i B onboarded, C amb perfil privat; cerveses aprovada, fusionada i pendent d'un altre):
  - `create_post` d'A → fila amb `author_id = A`, `verification_level = 'unverified'`, `is_retroactive = false`, `publish_to_feed = true`
  - cervesa fusionada → es guarda la final; cervesa `pending` de B → `beer_not_found`; `serving = 'glass'` → `invalid_serving`; `volume_ml = 10` → `invalid_volume`; text de 501 → `invalid_caption`; text `'  '` → `caption` null
  - sense sessió → `42501`; usuari sense onboarding → `not_onboarded`
  - `photo` amb fitxers inexistents → `photo_not_found`; amb fitxers d'un altre usuari → `photo_not_found`; amb fitxers propis → 1 fila a `post_photos`; mateix camí dos cops → error
  - B veu el post publicat d'A; no veu el de C (privat) ni un d'A amb `publish_to_feed = false`; A veu tots els seus; `anon` no veu res
  - B no pot `insert`/`update` a `posts` ni `post_photos` (`42501`); B no pot esborrar el post d'A (0 files); A sí
  - Storage: B pot llegir (`select` a `storage.objects`) la foto del post publicat d'A però no la d'un post no publicat ni la d'un fitxer sense post (Review Focus 2); B no pot pujar a la carpeta d'A
- [ ] **Step 2:** BD temporal: `supabase db reset` + `supabase test db` → FAIL.
- [ ] **Step 3:** Migració. Restriccions: `check` als camps, `unique (post_id)` i `unique (path)`/`unique (thumb_path)` a `post_photos`. Comprovar fitxers amb `storage.objects` (`bucket_id`, `name`, `owner_id = auth.uid()::text`).
- [ ] **Step 4:** `supabase test db` i `db lint` → PASS; `db:types`.
- [ ] **Step 5:** Commit `feat(db): add posts and photos with RLS and create_post`.

### Task 2 (US-301-T5): Detall del post

**Files:** Create `app/src/features/posts/{index.ts,types.ts,api/post.ts,api/photos.ts,lib/format.ts,screens/post-screen.tsx}`, `app/src/app/post/[id]/index.tsx`; Modify `app/src/app/_layout.tsx`, locales, `app/package.json` (cap dependència nova aquí). Test: `app/src/features/posts/__tests__/post-screen.test.tsx`.

**Interfaces — Produces:**

- `type Post = { id; authorId; beer: { id; name; brand; imageThumbUrl: string | null }; serving: Serving; volumeMl: number | null; caption: string | null; consumedAt: string; isRetroactive: boolean; publishToFeed: boolean; verificationLevel: 'verified' | 'partial' | 'unverified'; createdAt: string; photo: { path: string; thumbPath: string; width: number; height: number } | null }`; `type Serving = 'tap' | 'bottle' | 'can'`.
- `postKey(id) = ['post', id]`; `usePost(id): UseQueryResult<Post | null>`; `photoUrls(paths: string[]): Promise<Record<string, string>>` (signades 1 h); `usePhotoUrl(path | null)`.
- `formatServing(serving, volumeMl, t)` → "Ampolla · 330 ml"; `formatConsumedAt(iso, language, now)`.
- `PostScreen({ id, currentUserId, actions?: ReactNode })` — `actions` el posa la ruta (Edita/Esborra arriben a US-303).

- [ ] **Step 1: Tests que fallen:** post complet → foto (etiqueta accessible), nom i marca de la cervesa (prémer → `/beer/<id>`), "Ampolla · 330 ml", text, data; `isRetroactive` → "Retroactiu"; `publishToFeed = false` → "Només al teu registre"; sense foto → sense imatge; `null` → "No hem trobat aquest post"; error → reintentar.
- [ ] **Step 2:** `npm test -- post-screen` → FAIL. **Step 3:** Implementar. **Step 4:** tests + typecheck + lint → PASS.
- [ ] **Step 5:** Commit `feat(posts): add post detail screen`.

### Task 3 (US-301-T2, part 1): Cerca de cerveses

**Files:** Create `supabase/migrations/<ts>_search_beers.sql`, `supabase/tests/database/070_search_beers.test.sql`, `app/src/features/beers/api/search.ts`; Modify `app/src/features/beers/{index.ts,types.ts}`, tipus. Test: `app/src/features/beers/__tests__/search.test.tsx`.

**Interfaces — Produces:**

- `public.search_beers(q text, max_results int default 20) returns table(id uuid, name text, brand text, image_thumb_url text, abv numeric, style_code text)` (`stable`, `security invoker`; ordre de la spec).
- `type BeerSummary = { id; name; brand; imageThumbUrl: string | null; abv: number | null; styleCode: string | null }`; `useBeerSearch(query: string): UseQueryResult<BeerSummary[]>` (desactivada amb < 2 caràcters després de `trim`; `placeholderData` = resultats anteriors).

- [ ] **Step 1: Tests que fallen** — pgTAP: `'estrella damm'` troba "Damm / Estrella Damm" i no "Damm / Voll-Damm"; `'cervesa'` sense accent troba "Cervèsa"; coincidència exacta de marca primer; amb més codis abans que amb menys; fusionades i `pending` d'altres fora; `'a'` → 0 files; límit respectat. Jest: el hook no crida l'RPC amb `' e '`; mapeja a `BeerSummary`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS; `db:types`.
- [ ] **Step 5:** Commit `feat(beers): search beers by brand and name`.

### Task 4 (US-301-T2, part 2): Flux de creació i publicar

**Files:** Create `app/src/features/posts/{lib/draft.ts,api/create-post.ts,api/recent-beers.ts,screens/new-post-screen.tsx,components/beer-step.tsx,components/details-step.tsx,components/serving-picker.tsx}`; Modify `app/src/app/(tabs)/new-post.tsx`, `app/src/app/scan.tsx`, `app/src/features/beers/screens/scan-screen.tsx` (prop `onFound`), locales, `app/package.json` (`zustand` exacta). Test: `app/src/features/posts/__tests__/{draft.test.ts,new-post-screen.test.tsx,create-post.test.ts}`.

**Interfaces:**

- Consumes: `useBeerSearch`, `BeerSummary`, `ScanButton` (Task 3 / S2); `create_post` (Task 1); `postKey` (Task 2).
- Produces:
  - `usePostDraft` (Zustand) amb estat `PostDraft = { step: 'beer' | 'photo' | 'details'; beer: BeerSummary | null; photo: DraftPhoto | null; serving: Serving | null; volumeMl: number | null; caption: string; consumedAt: string | null; publishToFeed: boolean | null }` i accions `setBeer, setPhoto, setServing, setVolume, setCaption, setConsumedAt, setPublishToFeed, goTo, reset`. `DraftPhoto = { uri: string; width: number; height: number; source: 'camera' | 'library'; exifTakenAt: string | null }`.
  - `publishPost(draft: PostDraft, userId: string): Promise<string>` — puja la foto si n'hi ha (Task 6 la implementa; aquí s'injecta `uploadPhoto` per paràmetre per poder-la provar), crida `create_post`, i si falla esborra els fitxers pujats.
  - `useRecentBeers(): UseQueryResult<BeerSummary[]>` (5 cerveses diferents dels últims posts propis).
  - `ScanScreen({ onFound?: (beerId: string) => void })`; ruta `/scan?for=post` → posa la cervesa a l'esborrany (llegint-la amb `useBeer`/RPC) i `router.back()`.
  - `NewPostScreen()` a la pestanya ➕.
- [ ] **Step 1: Tests que fallen:**
  - `draft`: `setBeer` passa a `photo`; `reset` torna a l'estat inicial; `goTo('beer')` conserva les dades.
  - `publishPost`: sense foto → `create_post` amb `photo: null`; amb foto → puja i després crida amb els camins; `create_post` falla → esborra els dos camins pujats i rellança (Review Focus 1).
  - Pantalla: escriure "estrella" mostra resultats i triar-ne un passa al pas de foto; cercador buit → "Les teves últimes"; sense resultats → "No la trobem" + botó d'escanejar; "Sense foto" → detalls; sense format "Publica" desactivat; publicar → `router.replace('/post/<id>')` i esborrany buidat; error → missatge i esborrany intacte.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar (pas de foto provisional amb només "Sense foto"; Task 5 hi posa càmera i galeria). **Step 4:** PASS + typecheck + lint.
- [ ] **Step 5:** Commit `feat(posts): add create post flow with beer search`.

### Task 5 (US-301-T3): Foto: càmera, galeria, compressió i pujada

**Files:** Create `app/src/features/posts/{api/upload-photo.ts,lib/photo.ts,components/photo-step.tsx}`; Modify `new-post-screen.tsx`, `app/app.json` (textos de permisos), locales. Test: `__tests__/{upload-photo.test.ts,photo-step.test.tsx}`.

**Interfaces — Produces:** `pickPhoto(source: 'camera' | 'library'): Promise<DraftPhoto | null>` (picker amb `exif: true` només a galeria; `PhotoPermissionError`); `uploadPhoto(photo: DraftPhoto, userId: string): Promise<{ path; thumbPath; width; height }>` (redimensiona a 1080/320 px, puja tots dos amb `contentType: 'image/jpeg'`); `removePhotos(paths: string[])`; `photoFileExists(uri): Promise<boolean>`.

- [ ] **Step 1: Tests que fallen:** imatge 4032×3024 → `resize({ width: 1080 })` i `resize({ width: 320 })`; vertical 3024×4032 → `resize({ height: 1080 })`; més petita de 1080 → no s'amplia; JPEG 0,7 i 0,6; camins `user-1/uuid-1.jpg` i `user-1/uuid-1_thumb.jpg`; si la segona pujada falla s'esborra la primera; cancel·lar → null; sense permís → `PhotoPermissionError`. Pas de foto: "Fes una foto" / "Tria de la galeria" / "Sense foto"; amb foto, vista prèvia i "Canvia-la"; esborrany restaurat amb foto inexistent → avís "La foto ja no hi és" i opcions per triar-ne una altra o continuar sense (Review Focus 3).
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. Textos d'`app.json`: fotos "…to choose a profile picture or add a photo of your beer", càmera "…to take your profile picture, photograph your beers and scan barcodes".
- [ ] **Step 4:** PASS. **Step 5:** Commit `feat(posts): take or pick a photo and upload it compressed`.

### Task 6 (US-301-T4): Esborrany persistent

**Files:** Modify `app/src/features/posts/lib/draft.ts`, `new-post-screen.tsx`. Test: `__tests__/draft.test.ts`.

**Interfaces — Produces:** `usePostDraft` amb `persist` (`createJSONStorage(() => AsyncStorage)`, nom `post-draft`, `version: 1`); `useDraftHydrated(): boolean`; `hasDraftContent(draft): boolean`.

- [ ] **Step 1: Tests que fallen:** l'estat es desa a AsyncStorage i un store nou el recupera; mentre no està hidratat la pantalla mostra "Carregant…"; un esborrany amb contingut mostra "Descarta" i confirmar-ho el buida; `version` diferent → estat inicial.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS. **Step 5:** Commit `feat(posts): keep the post draft across app restarts`.
- [ ] **Step 6:** Proves a la web local (BD temporal amb catàleg copiat); PR `feature/us-301…` → `main` (`Closes #36`), amb captures.

## Fase B · `feature/us-302-registre-retroactiu` (des de `feature/us-301…`)

### Task 7 (US-302-T3): Lògica `is_retroactive` + `publish_to_feed`

**Files:** Create `supabase/migrations/<ts>_retroactive_posts.sql`, `app/src/features/posts/lib/timing.ts`; Modify `060_posts.test.sql`, `create-post.ts`, tipus. Test: `__tests__/timing.test.ts`.

**Interfaces — Produces:** `create_post(beer_id, serving, volume_ml, caption, consumed_at timestamptz default null, publish_to_feed boolean default null, photo jsonb default null)` (substitueix l'anterior; `drop function` de la signatura vella). `RETRO_AFTER_MS = 3_600_000`, `FEED_DEFAULT_MAX_AGE_MS = 48 * 3_600_000`; `isRetroactive(consumedAt: Date, now: Date): boolean`; `defaultPublishToFeed(consumedAt: Date, now: Date): boolean`; `publishPost` envia `consumed_at` i `publish_to_feed` (null = automàtic).

- [ ] **Step 1: Tests que fallen** — pgTAP: sense data → ara, no retroactiu, publicat; fa 2 h → retroactiu i publicat; fa 3 dies → retroactiu i no publicat; fa 3 dies amb `publish_to_feed = true` → publicat; d'aquí 10 min → `consumed_in_future`; d'aquí 2 min → acceptat; 1999 → `consumed_too_old`. Jest: límits exactes d'1 h i 48 h.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS; `db:types`. **Step 5:** Commit `feat(posts): mark past posts as retroactive and default them off the feed`.

### Task 8 (US-302-T1): Selector de data/hora i toggle

**Files:** Create `app/src/features/posts/components/{when-field.tsx,feed-toggle.tsx}`; Modify `details-step.tsx`, locales. Test: `__tests__/details-step.test.tsx`.

**Interfaces — Produces:** `WhenField({ value: string | null, onChange, suggestion?: string | null })` ("Ara" / data i hora triades; `DateTimePicker` de `@expo/ui/community/datetime-picker` amb `maximumDate = now`); `FeedToggle({ consumedAt, value, onChange })` (mostra el valor automàtic mentre `value` és null).

- [ ] **Step 1: Tests que fallen:** per defecte "Ara" i feed activat; triar fa 3 dies → avís "Es marcarà com a registre retroactiu" i feed apagat; tocar el toggle → es manté el valor triat encara que canviï la data; "Torna a ara" → data null.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS. **Step 5:** Commit `feat(posts): pick when you drank it and whether it goes to the feed`.

### Task 9 (US-302-T2): Data de l'EXIF

**Files:** Create `app/src/features/posts/lib/exif.ts`; Modify `api/upload-photo.ts` (`pickPhoto` omple `exifTakenAt`), `details-step.tsx`. Test: `__tests__/exif.test.ts`, `details-step.test.tsx`.

**Interfaces — Produces:** `exifDate(exif: Record<string, unknown> | null | undefined): string | null` (ISO; `DateTimeOriginal` → `DateTimeDigitized` → `DateTime`; amb `OffsetTimeOriginal` es respecta la zona, sense, hora local del mòbil; invàlida → null).

- [ ] **Step 1: Tests que fallen:** `'2026:11:20 21:15:00'` → mateix instant que `new Date(2026, 10, 20, 21, 15)` (Review Focus 4); amb `OffsetTimeOriginal: '+01:00'` → `2026-11-20T20:15:00.000Z`; `'0000:00:00 00:00:00'` → null; sense EXIF → null. Detalls: foto amb `exifTakenAt` de fa 2 dies → botó "Fes servir la data de la foto (…)" que posa aquesta data; a menys d'1 h de l'ara → no es mostra.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS. **Step 5:** Commit `feat(posts): suggest the date a gallery photo was taken`.
- [ ] **Step 6:** PR `feature/us-302…` → `main` (`Closes #37`).

## Fase C · `feature/us-303-editar-i-esborrar-un-post` (des de `feature/us-302…`)

### Task 10 (US-303-T3): Els meus últims registres

**Files:** Create `app/src/features/posts/{api/my-posts.ts,components/my-recent-posts.tsx}`; Modify `app/src/features/profile/screens/my-profile-screen.tsx` (prop `children` sota la capçalera), `app/src/app/(tabs)/profile.tsx`, locales. Test: `__tests__/my-recent-posts.test.tsx`.

**Interfaces — Produces:** `myPostsKey = ['posts', 'mine']`; `useMyRecentPosts(limit = 20)`; `MyRecentPosts()` (miniatura o 🍺, cervesa, data; prémer → `/post/<id>`; buit → "Encara no has registrat cap cervesa" + botó a ➕). `create_post`/edició/esborrat invaliden `myPostsKey`.

- [ ] **Step 1–5:** tests (llista ordenada com arriba, fila → navegació, estat buit), FAIL, implementar, PASS, commit `feat(posts): list my latest posts on my profile`.

### Task 11 (US-303-T1 + T2): Editar i esborrar

US-303-T1 i T2 són dues subtasques (dues PRs), però comparteixen la pantalla de detall:

**T1 — Files:** Create `supabase/migrations/<ts>_update_post.sql`, `app/src/features/posts/{api/update-post.ts,screens/edit-post-screen.tsx}`, `app/src/app/post/[id]/edit.tsx`; Modify `060_posts.test.sql`, `_layout.tsx`, ruta del detall (botó Edita), locales, tipus.

**Interfaces — Produces:** `public.update_post(post_id uuid, serving text, volume_ml int, caption text, consumed_at timestamptz, publish_to_feed boolean) returns void`; `useUpdatePost()`; `EditPostScreen({ id })`.

- [ ] **T1 Step 1: Tests que fallen** — pgTAP: l'autor canvia format/volum/text/feed; B → `post_not_found`; data a fa 3 dies d'un post d'ara → retroactiu; un retroactiu amb data tornada a ara → segueix retroactiu; post `verified` (posat amb `update` de `postgres`) amb data nova → `locked_by_verification`, sense canviar la data → OK; validacions com `create_post`. Jest: formulari carregat amb els valors; desar crida l'RPC i torna enrere; cervesa i foto no editables.
- [ ] **T1 Steps 2–5:** FAIL, implementar, PASS + `db:types`, commit `feat(posts): edit a post's details`.

**T2 — Files:** Create `app/src/features/posts/api/delete-post.ts`; Modify ruta del detall (botó Esborra + `Sheet` de confirmació), locales. Test: `__tests__/delete-post.test.ts`, `post-screen.test.tsx`.

**Interfaces — Produces:** `deletePost(post: Pick<Post, 'id' | 'photo'>): Promise<void>` (primer `storage.remove([path, thumbPath])`, després `from('posts').delete().eq('id', id)`; 0 files esborrades → error `post_not_found`); `useDeletePost()` (invalida `myPostsKey`, treu `postKey(id)`, torna enrere).

- [ ] **T2 Step 1: Tests que fallen:** ordre fitxers → fila; si `remove` falla no s'esborra la fila; `remove` sense fitxers (ja esborrats) → esborra la fila igualment (Review Focus 5); sense foto → només la fila; la confirmació diu que no es pot desfer; cancel·lar no fa res.
- [ ] **T2 Steps 2–5:** FAIL, implementar, PASS, commit `feat(posts): delete a post and its photos`.
- [ ] **Step final:** revisió de l'sprint sencer; PR `feature/us-303…` → `main` (`Closes #38`).
