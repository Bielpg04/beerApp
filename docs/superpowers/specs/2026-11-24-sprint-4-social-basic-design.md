# Sprint 4 · Social bàsic — disseny

- **Data:** 2026-11-24
- **US:** US-104 (veure el perfil d'algú), US-401 (enviar i acceptar sol·licituds), US-402 (bloquejar usuaris)
- **Estat:** aprovat
- **Decidit amb tu:** disseny proposat el 2026-11-23 aprovat triant l'opció **A** per trobar gent: un camp "Busca per @usuari" a la pantalla d'Amics (nova subtasca US-401-T5)

## Intenció

Que l'app deixi de ser un diari personal: poder **trobar algú, fer-se amics i veure les seves cerveses**, i poder **apartar** qui no vols veure. És la base del feed d'amics (S5), de les etiquetes (S6) i dels rànquings entre amics. Al final de l'sprint, amb dos usuaris, s'ha de poder fer: buscar @algú → obrir el seu perfil → enviar sol·licitud → l'altre l'accepta → cadascú veu els posts publicats de l'altre encara que el perfil sigui privat → eliminar l'amistat o bloquejar → ja no es veuen.

## Objectius

- Perfil reutilitzable (el meu i el d'algú altre): capçalera, resum (registres, cerveses diferents, amics), botó d'amistat i graella de posts paginada.
- Estats de privacitat: perfil privat i no amic → només capçalera i botó; bloquejat → "no trobat".
- Amistat mútua amb sol·licituds: enviar, cancel·lar, acceptar, rebutjar, eliminar.
- Pantalles: sol·licituds rebudes, amics (amb "Busca per @usuari"), usuaris bloquejats.
- Bloquejar i desbloquejar des del perfil d'algú; el bloqueig talla tota relació en tots dos sentits.
- L'autor al detall d'un post, amb enllaç al seu perfil.

## No objectius (aquest sprint)

- Cercador unificat (US-1001, S6): la cerca per @usuari és mínima i l'S6 l'absorbirà.
- Feed (S5), etiquetes (S6; el bloqueig hi haurà d'impedir etiquetar), suggeriments d'amics (US-403).
- Notificacions de sol·licituds (S11): de moment es veuen al perfil.
- Denunciar usuaris (`reports`): no és en cap US encara; caldrà abans de la beta (App Store 1.2 demana bloquejar **i** denunciar).
- Veure la llista d'amics d'una altra persona: només se'n mostra el nombre.
- Límits anti-spam de sol·licituds.

## Anti-objectius

- Que algú vegi els posts o el resum d'un perfil privat sense ser-ne amic.
- Que un usuari bloquejat pugui veure res de qui l'ha bloquejat (perfil, posts, fotos, resultats de cerca) o enviar-li una sol·licitud.
- Que algú sàpiga que l'han bloquejat o que li han rebutjat la sol·licitud (cap missatge ho diu).
- Que el client pugui crear una amistat acceptada sense que l'altre l'accepti.
- Que la cerca de persones serveixi per descarregar tota la llista d'usuaris (mínim 2 caràcters, màxim 20 resultats).

## Restriccions

- `profiles` només és llegible pel propietari; la resta llegeix `public_profiles` (vista amb drets del propietari, només usuaris amb onboarding fet). Qualsevol dada d'un altre usuari passa per funcions `security definer` o per aquesta vista.
- `can_see_post(author, published)` ja governa la RLS de `posts`, `post_photos` i les fotos de `storage.objects`: ampliar-la fa que tot respecti amistats i bloquejos alhora.
- El bucket `avatars` és **públic**: un avatar es pot descarregar si se'n sap l'URL. El bloqueig amaga el camí (no es retorna), no el fitxer.
- `main` encara no té l'S2 ni l'S3 → branques encadenades sobre `feature/us-303…`.
- Aquest Mac no té simulador: tot es prova amb tests i a la web local amb dos usuaris.

## Enfocaments

|          | Enfocament                                                                                                                                   | Pros                                                                         | Contres                                                                       |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **A ✅** | **Funcions SQL** (`security definer`) per escriure amistats i bloquejos i per llegir un perfil (`get_profile`); `can_see_post` amplia la RLS | Mateix patró que l'S3; una sola regla de visibilitat; es prova tot amb pgTAP | Més funcions SQL                                                              |
| B        | `insert`/`update` directes amb RLS i triggers a `friendships`                                                                                | Menys codi                                                                   | Difícil impedir que el client es posi `accepted` o escrigui en nom d'un altre |
| C        | Seguir (unidireccional) en lloc d'amistat mútua                                                                                              | Sense sol·licituds                                                           | El PLAN.md ja va decidir amistat mútua                                        |

**Triat: A** (aprovat amb el disseny).

## Disseny

### Dades

**`friendships`** — una fila per parella: `user_low`, `user_high` (`user_low < user_high`, PK de tots dos, `on delete cascade`), `requested_by` (un dels dos), `status` `pending` | `accepted`, `created_at`, `accepted_at`. RLS: cadascú llegeix les files on surt; **cap escriptura directa**.

**`blocks`** — `blocker_id`, `blocked_id` (PK de tots dos, diferents, `on delete cascade`), `created_at`. RLS: llegeixes només els teus bloquejos; cap escriptura directa.

**Funcions auxiliars** (`security definer`, `stable`): `are_friends(a, b)`, `is_blocked_between(a, b)` (en qualsevol sentit).

**Visibilitat d'un post** — `can_see_post(author, published)`:
autor sempre; si no, `published` **i** cap bloqueig entre tots dos **i** (perfil de l'autor públic **o** amics). Perfil amb onboarding fet, com fins ara.

**`public_profiles`** — a més de l'onboarding, amaga els perfils amb bloqueig entre tu i ells.

**Funcions** (errors `P0001` amb missatge estable; sense sessió `42501`):

- `get_profile(user_id) → fila o res`: `id, username, display_name, avatar_path, bio, is_private, relationship, can_see_posts, posts_count, beers_count, friends_count`.
  - Res si no existeix, no ha acabat l'onboarding o hi ha un bloqueig **d'ell cap a tu**.
  - `relationship`: `self` | `none` | `outgoing` | `incoming` | `friends` | `blocked` (l'has bloquejat tu).
  - Si l'has bloquejat tu: només `id`, `username`, `display_name` i `relationship` (per poder desbloquejar); la resta null.
  - `can_see_posts` = és teu, o perfil públic, o amics (i cap bloqueig). Si és fals, els tres comptadors són null.
  - `posts_count` i `beers_count` = posts que **tu** pots veure d'ell (al teu, tots); `friends_count` = amistats acceptades.
- `send_friend_request(user_id) → text` (`pending` | `accepted`): no a tu mateix (`cannot_befriend_self`); usuari inexistent, sense onboarding o amb bloqueig en qualsevol sentit → `user_not_found`; si ja sou amics o ja l'has enviat, no fa res i retorna l'estat; si ell te n'havia enviat una → l'accepta.
- `accept_friend_request(user_id)`: cal una sol·licitud pendent **d'ell cap a tu** (`request_not_found`).
- `decline_friend_request(user_id)`: esborra la pendent d'ell cap a tu (`request_not_found` si no n'hi ha). Ell no en rep cap avís i pot tornar-ho a provar.
- `remove_friend(user_id)`: esborra la fila en qualsevol estat on sigui teva (cancel·lar la que has enviat o eliminar l'amistat). Sense fila → no fa res.
- `my_friends() → setof (id, username, display_name, avatar_path, since)`, per nom.
- `my_friend_requests() → setof (id, username, display_name, avatar_path, requested_at)`, les rebudes pendents, més noves primer.
- `find_people(q, max = 20) → setof (id, username, display_name, avatar_path, relationship)`: `q` sense `@` ni espais, mínim 2 caràcters; `username` que **comença** per `q` (sense distingir majúscules); exclou-te a tu i qualsevol bloqueig; ordre: coincidència exacta, després per `username`.
- `block_user(user_id)`: no a tu mateix (`cannot_block_self`); inexistent → `user_not_found`; esborra la fila de `friendships` entre tots dos; repetir-lo no fa res.
- `unblock_user(user_id)`: esborra el teu bloqueig (no restaura l'amistat).
- `my_blocked_users() → setof (id, username, display_name, avatar_path, blocked_at)`.

### App

- **Feature `profile`:** `useProfile(id)` (via `get_profile`) i `ProfileScreen` reutilitzable: avatar, nom, @usuari, bio, resum ("N registres · N cerveses · N amics"), i dos espais que omple la ruta: les **accions** (segons la relació) i el **contingut** (la graella). Estats: carregant, error amb "Torna-ho a provar", "Aquest usuari no existeix" (inclou el bloquejat per ell), privat ("Aquest perfil és privat. Fes-te amic de @x per veure les seves cerveses.") i "L'has bloquejat" (només nom i Desbloqueja).
- **Feature `posts`:** `ProfilePostsGrid({ userId })`: 3 columnes de miniatures quadrades (URL signades en bloc per pàgina), paginació de 30 per data de consum (cursor `consumed_at, id`) amb "Mostra'n més"; post sense foto → la imatge de la cervesa o 🍺 amb el nom. Toca → `/post/[id]`. Buit → "Encara no hi ha registres" (al meu: botó "Registra la primera"). Substitueix "Els meus últims registres" (`MyRecentPosts` desapareix). `PostScreen` guanya un espai `renderHeader(post)` per a l'autor.
- **Feature `social` (nova):** API de sol·licituds, amics, bloquejos i cerca; `FriendshipButton` (Afegir · Sol·licitud enviada ▸ Cancel·la · Accepta / Rebutja · Amics ▸ Elimina l'amistat, amb confirmació per eliminar); `BlockButton` (al menú del perfil aliè, amb confirmació que explica l'efecte); pantalles `FriendsScreen` (cerca per @usuari a dalt; amb text cerca, si no llista d'amics), `FriendRequestsScreen`, `BlockedUsersScreen`.
- **Rutes:** `/user/[id]` (perfil aliè; si és el meu id → la pestanya de perfil), `/friends`, `/friend-requests`, `/blocked`. A la pestanya de perfil: "Amics (N)", "Sol·licituds" amb el nombre de pendents (si n'hi ha), "Usuaris bloquejats", Edita, Sobre l'app. Al detall del post: fila d'autor (avatar + nom) que obre el perfil.
- **Caché:** qualsevol acció d'amistat o bloqueig invalida `['profile', id]`, les llistes socials i els posts (la visibilitat canvia).
- Tots els textos a ca/es/en (espais `profile.*` i `social.*`).

### GitHub

- `docs/PLAN.md`: US-401 guanya **T5 · Cerca de persones per @usuari a la pantalla d'amics**.
- Subtasques amb `npm run backlog -- --tasks S4`; board amb `setup-project.ts --current S4`.
- Branques: `docs/sprint-4-design` (des de `feature/us-303…`) → `feature/us-104…` → `feature/us-401…` → `feature/us-402…`, cada una des de l'anterior. Tasques → la seva US amb _squash_ quan la CI és verda; les US → `main` queden obertes per a tu.

## Com es provarà

- **pgTAP** (BD temporal): `get_profile` en cada relació i privacitat (comptadors null quan toca, res si t'ha bloquejat); cada funció d'amistat (estats, errors, acceptació creuada, cap escriptura directa); visibilitat de posts, fotos i fitxers per a amic / no amic / privat / bloquejat; `find_people` (prefix, mínim, exclusions); bloqueig esborra l'amistat i impedeix sol·licituds; `public_profiles` amaga bloquejats.
- **Jest:** perfil (estats), graella (paginació, sense foto, buit), botó d'amistat (cada estat → crida correcta i invalidació), sol·licituds, amics + cerca (debounce), bloquejats, fila d'autor.
- **Web local** amb dos usuaris contra una Supabase temporal: cerca → sol·licitud → acceptar → veure posts d'un perfil privat → bloquejar → "no trobat".

## Decisions meves (revisa-les)

1. Ordre de les US: US-104 primer (el perfil és on viu el botó), després US-401 i US-402. Fins a US-401, un perfil privat aliè només mostra la capçalera.
2. Els amics només veuen posts **publicats al feed**; "només al meu registre" segueix sent només teu.
3. Rebutjar és silenciós i no impedeix tornar a enviar-la; si tots dos s'envien sol·licitud, s'accepta.
4. Bloquejar esborra l'amistat i desbloquejar no la recupera.
5. Comptadors del resum = el que **tu** pots veure (no revelen posts amagats).
6. Cerca per prefix de `username` (no pel nom visible), 2 caràcters mínim, 20 resultats.
7. Graella amb botó "Mostra'n més" (30 per pàgina) en comptes de scroll infinit: dins de la pantalla del perfil és més simple i accessible.
8. Ruta per id (`/user/[id]`), no per nom d'usuari.
9. La llista d'amics d'altres no es mostra, només el nombre.

## Què queda en mans de qui ho construeixi

Noms de fitxers i components, com es divideixen les migracions, el disseny visual dins del tema actual, la forma exacta dels menús (full inferior o botons) i els textos concrets.
