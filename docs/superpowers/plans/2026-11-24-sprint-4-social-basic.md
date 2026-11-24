# Sprint 4 · Social bàsic — pla d'implementació

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trobar algú per @usuari, fer-s'hi amic, veure el seu perfil i les seves cerveses segons la privacitat, i poder-lo bloquejar.

**Architecture:** Les escriptures socials passen per funcions SQL `security definer` (`send/accept/decline_friend_request`, `remove_friend`, `block_user`, `unblock_user`); les lectures d'altres usuaris per `get_profile`, `find_people` i llistes `my_*`. `can_see_post` incorpora amistats i bloquejos, i així la RLS de posts, fotos i fitxers ho respecta tot. A l'app, `profile` dona la pantalla reutilitzable, `posts` la graella i una feature nova `social` els botons i pantalles; les rutes ho composen.

**Tech Stack:** Postgres 17 + pgTAP · Expo SDK 58 / Expo Router · TanStack Query 5 · Jest + RNTL 14

**Spec:** `docs/superpowers/specs/2026-11-24-sprint-4-social-basic-design.md`

## Global Constraints

- Cap dependència nova.
- Textos visibles a `app/src/shared/i18n/locales/{ca,es,en}.json` (test de paritat). Espais `profile.*` i `social.*`.
- Imports entre features només via `@/features/<feature>`; les rutes de `src/app/` composen features (`profile` no importa `posts` ni `social`, i a l'inrevés).
- `relationship` ∈ `self | none | outgoing | incoming | friends | blocked`.
- Visibilitat: autor sempre; altres si `publish_to_feed` **i** sense bloqueig en cap sentit **i** (perfil públic **o** amics); perfil amb onboarding fet.
- `get_profile` no retorna res si l'altre t'ha bloquejat (igual que un usuari inexistent).
- `find_people`: prefix de `username`, mínim 2 caràcters, màxim 20, sense comodins (`%`, `_` literals).
- Graella: 30 per pàgina, ordre `consumed_at desc, id desc`.
- Errors SQL amb `errcode = 'P0001'` i missatge estable; sense sessió `42501`. Cap `insert`/`update`/`delete` directe a `friendships` ni `blocks`.
- Cada migració → `npm run db:types` i commit del fitxer de tipus. pgTAP en una **BD temporal** (còpia de `supabase/` amb `project_id` i ports propis), mai a la local.
- Git: branca `task/…` (nom exacte al cos de l'issue) → PR _squash_ a la `feature/…`; les US → `main` (_merge commit_) queden obertes.

## Review Focus

1. **Acceptar una sol·licitud que l'altre ja ha cancel·lat** → `request_not_found`, l'app ho diu i refresca la llista sense petar. _Test a Task 6._
2. **Bloquejar un amic** → deixa de veure els meus posts, les files de `post_photos` i els fitxers a Storage, encara que en conegui el camí. _Test a Task 9._
3. **Perfil privat, ens fem amics i després elimino l'amistat** → els seus posts tornen a quedar amagats i el resum torna a null. _Test a Task 4._
4. **Obrir `/user/<id>` d'algú que m'ha bloquejat** → mateixa pantalla "Aquest usuari no existeix" que un id inventat. _Test a Task 3 (UI) i Task 9 (SQL)._
5. **Escriure `%` o `_` a la cerca de persones** → es cerquen literalment, no tornen tothom. _Test a Task 8._

---

## Fase 0 · `docs/sprint-4-design` (des de `feature/us-303…`)

### Task 0: Pla, backlog i subtasques

- [ ] **Step 1:** `docs/PLAN.md`: afegir a US-401 **T5 · Cerca de persones per @usuari a la pantalla d'amics**.
- [ ] **Step 2:** `npm run test:scripts` → PASS; `npm run backlog -- --dry-run --tasks S4` → 10 subtasques noves (US-104 T1–T3, US-401 T1–T5, US-402 T1–T2) i cap issue més.
- [ ] **Step 3:** Commit `docs: plan sprint 4 (design, plan, backlog)`, push, `npm run backlog -- --tasks S4`, `node scripts/github/setup-project.ts --current S4`; PR a `main` (queda oberta).

## Fase A · `feature/us-104-veure-el-perfil-d-algu` (des de `docs/sprint-4-design`)

### Task 1 (US-104-T1): `get_profile` i pantalla de perfil reutilitzable

**Files:** Create `supabase/migrations/<ts>_get_profile.sql`, `supabase/tests/database/100_get_profile.test.sql`, `app/src/features/profile/{api/profile.ts,screens/profile-screen.tsx,components/author-row.tsx}`, `app/src/app/user/[id].tsx`; Modify `app/src/types/database.ts`, `app/src/app/(tabs)/profile.tsx`, `app/src/app/post/[id]/index.tsx`, `app/src/features/posts/screens/post-screen.tsx`, `app/src/app/_layout.tsx`, `profile/index.ts`, locales. Tests: `profile/__tests__/profile-screen.test.tsx`, `profile/__tests__/author-row.test.tsx`, `posts/__tests__/post-screen.test.tsx`.

**Interfaces — Produces:**

- `public.get_profile(user_id uuid) returns table(id uuid, username text, display_name text, avatar_path text, bio text, is_private boolean, relationship text, can_see_posts boolean, posts_count int, beers_count int, friends_count int)` — en aquesta tasca `relationship` ∈ `self | none`, `friends_count` = 0, `can_see_posts` = és teu o perfil públic.
- `type Relationship = 'self' | 'none' | 'outgoing' | 'incoming' | 'friends' | 'blocked'`; `type Profile = { id; username; displayName; avatarPath; bio; isPrivate; relationship; canSeePosts; stats: { posts; beers; friends } | null }`.
- `profileKey(id) = ['profile', id]`; `useProfile(id: string): UseQueryResult<Profile | null>`.
- `ProfileScreen({ id, renderActions?: (p: Profile) => ReactNode, renderContent?: (p: Profile) => ReactNode })`.
- `AuthorRow({ userId })` (avatar + nom, enllaç a `/user/[id]`; via `public_profiles`).
- `PostScreen` prop `renderHeader?: (post: Post) => ReactNode`.

- [ ] **Step 1: Test que falla** — `100_get_profile.test.sql`: A (públic, 2 posts publicats d'1 cervesa diferent + 1 no publicat), C (privat amb 1 post), D sense onboarding:
  - A demana el seu → `relationship = 'self'`, `posts_count = 3`, `beers_count`, `can_see_posts`
  - B demana A → `none`, `posts_count = 2` (només els que veu), `can_see_posts = true`
  - B demana C → `can_see_posts = false`, comptadors null, capçalera present
  - B demana D o un uuid inventat → 0 files; sense sessió → `42501`
- [ ] **Step 2:** BD temporal: `supabase db reset` + `supabase test db` → FAIL.
- [ ] **Step 3:** Migració (`security definer`, `stable`, reutilitza `can_see_post` per comptar).
- [ ] **Step 4:** `supabase test db`, `db lint` → PASS; `db:types`.
- [ ] **Step 5: Tests de l'app que fallen** — `profile-screen.test.tsx`: mostra nom, @usuari, bio i "3 registres · 2 cerveses · 0 amics"; crida `renderActions` i `renderContent` amb el perfil; error → "Torna-ho a provar" refà la consulta. `author-row.test.tsx`: mostra el nom i en prémer fa `router.push('/user/<id>')`. `post-screen.test.tsx`: `renderHeader` es pinta.
- [ ] **Step 6:** Implementar; ruta `/user/[id]` (si `id` = la meva sessió → `<Redirect href="/(tabs)/profile" />`); la pestanya de perfil fa servir `ProfileScreen` amb el meu id i les accions d'abans (Edita, Sobre l'app) + `MyRecentPosts` com a contingut fins a Task 2; el detall del post pinta `AuthorRow`.
- [ ] **Step 7:** `npm test`, `lint`, `typecheck` → PASS. Commit `feat(profile): add a reusable profile screen and get_profile`.

### Task 2 (US-104-T2): Graella de posts paginada

**Files:** Create `app/src/features/posts/{api/user-posts.ts,api/thumbs.ts,components/profile-posts-grid.tsx}`; Delete `components/my-recent-posts.tsx`, `api/my-posts.ts` i el seu test (si `useMyRecentPosts` no es fa servir enlloc més); Modify `posts/index.ts`, rutes de perfil, locales. Test: `posts/__tests__/profile-posts-grid.test.tsx`.

**Interfaces — Produces:**

- `userPostsKey(userId) = ['posts', 'user', userId]`; `useUserPosts(userId)` — `useInfiniteQuery`, pàgines de 30, cursor `{ consumedAt, id }` (`or(consumed_at.lt.X, and(consumed_at.eq.X, id.lt.Y))`).
- `useThumbUrls(paths: string[])` — `createSignedUrls` en bloc, retorna `Record<path, url>`.
- `ProfilePostsGrid({ userId, isMe })`.
- Invalidar `['posts']` en crear/editar/esborrar ja cobreix la graella (comprovar que les mutacions existents invaliden aquest prefix; si no, afegir-ho).

- [ ] **Step 1: Test que falla:** 3 columnes; post amb foto → imatge amb URL signada; sense foto → nom de la cervesa; 30 posts i n'hi ha més → "Mostra'n més" carrega la pàgina 2 amb el cursor correcte; menys de 30 → sense botó; buit i `isMe` → "Registra la primera" porta a `/new-post`; tocar → `/post/<id>`.
- [ ] **Step 2:** `npx jest profile-posts-grid` → FAIL. **Step 3:** Implementar. **Step 4:** PASS.
- [ ] **Step 5:** Les dues rutes de perfil fan servir la graella com a contingut (`canSeePosts`); `npm test`, `lint`, `typecheck` → PASS. Commit `feat(posts): show a paginated posts grid on profiles`.

### Task 3 (US-104-T3): Estats de privacitat

**Files:** Modify `profile-screen.tsx`, locales. Test: `profile-screen.test.tsx`.

- [ ] **Step 1: Test que falla:** `get_profile` buit → "Aquest usuari no existeix" sense accions (Review Focus 4); perfil privat amb `canSeePosts = false` → capçalera, accions i "Aquest perfil és privat…" amb el @usuari, **sense** `renderContent` ni resum; públic → sense avís.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS i suite verda. Commit `feat(profile): show private and missing profile states`.

## Fase B · `feature/us-401-enviar-i-acceptar-sol-licituds` (des de `feature/us-104…`)

### Task 4 (US-401-T1): `friendships` i funcions

**Files:** Create `supabase/migrations/<ts>_friendships.sql`, `supabase/tests/database/110_friendships.test.sql`; Modify `database.ts`.

**Interfaces — Produces:** taula `friendships` (spec); `are_friends(a uuid, b uuid) returns boolean`; `send_friend_request(user_id uuid) returns text`; `accept_friend_request(user_id uuid)`; `decline_friend_request(user_id uuid)`; `remove_friend(user_id uuid)`; `my_friends()`; `my_friend_requests()`; `can_see_post` i `get_profile` actualitzats (`outgoing | incoming | friends`, `friends_count`).

- [ ] **Step 1: Test que falla** — `110_friendships.test.sql`:
  - A envia a B → `pending`, fila amb `requested_by = A`; repetir → `pending`, 1 fila; B la veu a `my_friend_requests`, A no
  - `get_profile` A→B `outgoing`, B→A `incoming`
  - B accepta → `friends`; `my_friends` de tots dos; `friends_count = 1`
  - A accepta la seva pròpia → `request_not_found`; declinar sense sol·licitud → `request_not_found`
  - B envia a A mentre A→B pendent → `accepted`
  - a tu mateix → `cannot_befriend_self`; a D sense onboarding → `user_not_found`
  - C privat: B no veu els seus posts; amics → els veu (no els no publicats), també `post_photos`; `remove_friend` → tornen a amagar-se i comptadors null (Review Focus 3)
  - `remove_friend` cancel·la una pendent enviada; sense fila no falla
  - `insert`/`update`/`delete` directe a `friendships` → `42501` o 0 files
- [ ] **Step 2–4:** FAIL → migració → PASS, `db lint`, `db:types`. Commit `feat(db): add friendships with requests`.

### Task 5 (US-401-T2): Botó d'amistat al perfil

**Files:** Create `app/src/features/social/{index.ts,types.ts,api/friendships.ts,components/friendship-button.tsx}`; Modify `app/src/app/user/[id].tsx`, locales. Test: `social/__tests__/friendship-button.test.tsx`.

**Interfaces — Produces:** `useFriendshipActions(userId)` → `{ send, accept, decline, remove }` (mutacions; en acabar invaliden `['profile']`, `['posts']`, `['social']`); `FriendshipButton({ userId, relationship, username })`.

- [ ] **Step 1: Test que falla:** `none` → "Afegeix" crida `send_friend_request`; `outgoing` → "Sol·licitud enviada" i "Cancel·la" crida `remove_friend`; `incoming` → "Accepta" i "Rebutja"; `friends` → "Amics" i "Elimina l'amistat" demana confirmació i després crida `remove_friend`; error → missatge; després d'èxit s'invalida `['profile', id]`.
- [ ] **Step 2–4:** FAIL → implementar → PASS; la ruta `/user/[id]` pinta el botó (no per a `self`). Suite, `lint`, `typecheck`. Commit `feat(social): add the friendship button to profiles`.

### Task 6 (US-401-T3): Sol·licituds rebudes

**Files:** Create `social/{api/requests.ts,screens/friend-requests-screen.tsx}`, `app/src/app/friend-requests.tsx`; Modify `(tabs)/profile.tsx`, `_layout.tsx`, locales. Test: `social/__tests__/friend-requests-screen.test.tsx`.

**Interfaces — Produces:** `useFriendRequests()` (`['social', 'requests']`); `FriendRequestsScreen`; `FriendRequestsLink` (fila "Sol·licituds" amb el nombre, oculta si 0).

- [ ] **Step 1: Test que falla:** llista amb avatar, nom i @usuari; Accepta / Rebutja criden la funció i treuen la fila; tocar el nom → `/user/<id>`; buit → "No tens sol·licituds pendents"; acceptar falla amb `request_not_found` → avís "Aquesta sol·licitud ja no existeix" i es refà la llista (Review Focus 1); `FriendRequestsLink` mostra "Sol·licituds · 2".
- [ ] **Step 2–4:** FAIL → implementar → PASS, suite verda. Commit `feat(social): add the friend requests screen`.

### Task 7 (US-401-T4): Llista d'amics

**Files:** Create `social/{api/friends.ts,screens/friends-screen.tsx,components/person-row.tsx}`, `app/src/app/friends.tsx`; Modify `(tabs)/profile.tsx`, `_layout.tsx`, locales. Test: `social/__tests__/friends-screen.test.tsx`.

**Interfaces — Produces:** `useFriends()` (`['social', 'friends']`); `PersonRow({ person, right? })` (reutilitzat a T3, T5, US-402); `FriendsScreen`.

- [ ] **Step 1: Test que falla:** llista ordenada pel servidor; tocar → `/user/<id>`; buit → "Encara no tens amics" + pista de buscar per @usuari.
- [ ] **Step 2–4:** FAIL → implementar → PASS; al meu perfil "Amics · N" obre `/friends`. Commit `feat(social): list my friends`.

### Task 8 (US-401-T5): Cerca de persones per @usuari

**Files:** Create `supabase/migrations/<ts>_find_people.sql`, `supabase/tests/database/120_find_people.test.sql`, `social/api/find-people.ts`; Modify `friends-screen.tsx`, `database.ts`, locales. Test: `friends-screen.test.tsx`.

**Interfaces — Produces:** `find_people(q text, max int default 20)`; `useFindPeople(q)` (debounce 300 ms, desactivat per sota de 2 caràcters; treu `@` i espais).

- [ ] **Step 1: Test SQL que falla:** prefix sense majúscules (`"BI"` troba `biel`); exacta primer; 1 caràcter → 0 files; no em retorna a mi ni a qui no té onboarding; `relationship` correcte; `q = '%'` i `'_'` → 0 files (Review Focus 5); `max` > 20 → 20.
- [ ] **Step 2–4:** FAIL → migració → PASS, `db:types`.
- [ ] **Step 5: Test de l'app que falla:** escriure "@bi" → crida amb "bi" després del debounce; resultats amb `FriendshipButton` compacte o estat; text buit → llista d'amics; sense resultats → "Ningú amb aquest nom d'usuari".
- [ ] **Step 6–7:** FAIL → implementar → PASS, suite verda. Commit `feat(social): find people by username`.

## Fase C · `feature/us-402-bloquejar-usuaris` (des de `feature/us-401…`)

### Task 9 (US-402-T1): `blocks`, efecte a la RLS i botó de bloquejar

**Files:** Create `supabase/migrations/<ts>_blocks.sql`, `supabase/tests/database/130_blocks.test.sql`, `social/{api/blocks.ts,components/block-button.tsx}`; Modify `database.ts`, `user/[id].tsx`, `profile-screen.tsx` (estat `blocked`), locales. Tests: `social/__tests__/block-button.test.tsx`, `profile-screen.test.tsx`.

**Interfaces — Produces:** taula `blocks`; `is_blocked_between(a uuid, b uuid) returns boolean`; `block_user(user_id uuid)`; `unblock_user(user_id uuid)`; `my_blocked_users()`; `can_see_post`, `get_profile` (`blocked`, res si t'ha bloquejat), `send_friend_request`, `find_people` i `public_profiles` respecten bloquejos; `useBlockActions(userId)` → `{ block, unblock }`; `BlockButton({ userId, username, blocked })`.

- [ ] **Step 1: Test SQL que falla** — `130_blocks.test.sql`:
  - A amic de B; A bloqueja B → fila a `blocks`, cap fila a `friendships`
  - B: `get_profile(A)` → 0 files; no veu posts d'A ni `post_photos` ni `storage.objects` dels fitxers (Review Focus 2); `find_people` no troba A; `public_profiles` no mostra A; `send_friend_request(A)` → `user_not_found`
  - A: `get_profile(B)` → `relationship = 'blocked'`, `avatar_path`/`bio` null; tampoc veu posts de B; `send_friend_request(B)` → `user_not_found`
  - repetir `block_user` → sense error; `cannot_block_self`; `unblock_user` → tot torna menys l'amistat
  - `my_blocked_users` d'A llista B; B no veu la fila d'A a `blocks`; escriptura directa → `42501`
- [ ] **Step 2–4:** FAIL → migració → PASS, `db lint`, `db:types`.
- [ ] **Step 5: Test de l'app que falla:** `BlockButton` → confirmació amb l'explicació → `block_user` i invalida; perfil `blocked` → "Has bloquejat @x" + "Desbloqueja" (crida `unblock_user`), sense botó d'amistat ni contingut.
- [ ] **Step 6–7:** FAIL → implementar → PASS, suite verda. Commit `feat(social): block users`.

### Task 10 (US-402-T2): Usuaris bloquejats

**Files:** Create `social/screens/blocked-users-screen.tsx`, `app/src/app/blocked.tsx`; Modify `(tabs)/profile.tsx`, `_layout.tsx`, locales. Test: `social/__tests__/blocked-users-screen.test.tsx`.

**Interfaces — Produces:** `useBlockedUsers()` (`['social', 'blocked']`); `BlockedUsersScreen`.

- [ ] **Step 1: Test que falla:** llista amb "Desbloqueja" (confirmació → `unblock_user`, la fila desapareix); buit → "No has bloquejat ningú".
- [ ] **Step 2–4:** FAIL → implementar → PASS; "Usuaris bloquejats" al meu perfil. Suite, `lint`, `typecheck`. Commit `feat(social): list and unblock blocked users`.

## Final

- Web local contra BD temporal amb dos usuaris: cerca → sol·licitud → acceptar → perfil privat visible → bloquejar → "no existeix" → desbloquejar.
- Revisió de tota la branca; PRs de les US a `main` obertes.
