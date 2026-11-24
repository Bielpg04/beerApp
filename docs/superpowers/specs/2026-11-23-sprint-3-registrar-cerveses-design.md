# Sprint 3 · Registrar cerveses — disseny

- **Data:** 2026-11-23
- **US:** US-301 (crear un post bàsic), US-302 (registre retroactiu), US-303 (editar i esborrar un post)
- **Estat:** aprovat
- **Decidit amb tu:** foto **opcional**; disseny proposat el 2026-11-22 aprovat sense canvis ("Endavant, opcional")

## Intenció

Que es pugui **registrar una cervesa**: la que beus ara o una que vas beure fa temps, amb foto si vols, i després corregir-la o esborrar-la. És el nucli de l'app: el feed (S5), les estadístiques (S10) i els logros (S11) es construeixen sobre aquests posts. Al final de l'sprint, amb una build de desenvolupament, s'ha de poder fer tot el cicle: triar cervesa (pel nom o escanejant-la) → foto → detalls → publicar → veure el post → editar-lo → esborrar-lo.

## Objectius

- Taules `posts` i `post_photos` amb RLS i un bucket privat `post-photos`.
- Crear posts només a través d'una funció del servidor que calcula els camps que el client no ha de poder triar (`is_retroactive`, `verification_level`).
- Flux de creació en passos: cervesa → foto → detalls → publicar, amb esborrany local que sobreviu si es tanca l'app.
- Triar la cervesa **pel nom** (cerca al catàleg) o **escanejant-la**, i les últimes que has registrat a mà.
- Foto feta amb la càmera o de la galeria, comprimida, amb miniatura i **sense les metadades GPS** de l'original.
- Registre retroactiu: data/hora passada, data suggerida per l'EXIF de la foto de galeria, i "publicar al feed" apagat per defecte si fa més de 48 h.
- Pantalla de detall del post; editar els camps permesos; esborrar amb confirmació (també les fotos).
- "Els meus últims registres" al perfil, perquè els posts siguin accessibles abans del feed (S5) i de l'historial (S8).

## No objectius (aquest sprint)

- Feed, reaccions, comentaris (S5), etiquetar amics (S6), bar del post (S7), historial complet amb filtres (US-304, S8), puntuació (US-305).
- **Calcular la verificació** (S9). La columna `verification_level` existeix i sempre val `unverified`; la regla d'edició que en depèn ja s'aplica.
- Diverses fotos per post: la taula ho permetria més endavant, ara n'hi ha com a màxim una.
- Afegir una cervesa que no és al catàleg (US-203, S6): si no la trobes, el flux ho diu i ofereix escanejar-la.
- Arreglar la qualitat del catàleg (duplicats, `&quot;`): la cerca els ordena perquè no molestin, però no els fusiona.
- Mode sense connexió per publicar (cua de pujades). L'esborrany es conserva; publicar necessita xarxa.

## Anti-objectius

- Que algú vegi un post que l'autor no ha publicat al feed, o el d'un perfil privat.
- Que les fotos publiquin la ubicació de casa d'algú (GPS de l'EXIF).
- Que el client pugui marcar un post com a verificat, o com a no retroactiu si no ho és.
- Perdre el que has escrit perquè l'app s'ha tancat a mig flux.
- Fitxers orfes a Storage (gratuït: 1 GB) per cada flux abandonat.
- Que triar la cervesa sigui més lent que escriure-la en un paper: si la cerca no posa la bona a dalt, ningú no registrarà res.

## Restriccions

- **Sense amistats fins a l'S4.** "Perfil privat" vol dir, de moment, "només jo". Els perfils són públics per defecte (`is_private = false`).
- `profiles` només és llegible pel seu propietari; la visibilitat d'un post depèn del perfil de l'autor → cal una funció `security definer` per consultar-ho.
- **Storage no deixa esborrar fitxers des d'SQL** (trigger `storage.protect_objects_delete`, comprovat a la BD local). Les fotos s'han d'esborrar amb l'API de Storage des del client.
- **Re-codificar la imatge treu l'EXIF:** `expo-image-manipulator` desa amb `UIImage.jpegData` (iOS) i `Bitmap.compress` (Android), que no copien metadades (llegit al codi font; cal confirmar-ho en un dispositiu).
- `expo-image-picker` retorna l'EXIF (inclosa `DateTimeOriginal`) si se li demana `exif: true`.
- El selector de data ja és a l'app: `@expo/ui/community/datetime-picker` (paquet natiu ja instal·lat). Zustand és JavaScript pur. **No cal cap mòdul natiu nou**, però el text dels permisos de fotos/càmera canvia (Info.plist) → cal una build nova igualment (ja calia per `expo-camera` de l'S2).
- Catàleg real: 8.911 cerveses amb duplicats ("estrella damm" → 10 resultats). Provat a la BD local: filtrant per totes les paraules (marca + nom, sense accents) i ordenant per coincidència exacta, nombre de codis de barres i llargada del nom, la bona surt primera en 5 de 6 cerques (≈20 ms per cerca).
- Aquest Mac no té simulador ni Android: càmera, EXIF i selector de data natiu només es poden provar en un mòbil. La resta es prova a la web local i amb tests.
- Branques encadenades sobre l'S2 (encara no és a `main`).

## Enfocaments

|          | Enfocament                                                                                                                                | Pros                                                                                 | Contres                                                                                     |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| **A ✅** | **Funció SQL** `create_post` / `update_post` (`security definer`): el client puja la foto a Storage i després crida la funció amb el camí | Els camps sensibles es calculen al servidor; una sola transacció; es prova amb pgTAP | La foto es puja abans de crear el post: si la funció falla, el client l'ha d'esborrar       |
| B        | Edge Function que rep la foto i crea el post                                                                                              | Tot al servidor, preparat per a la verificació                                       | Més codi i invocacions; Deno per a una cosa que SQL ja fa; la verificació és a l'S9         |
| C        | `insert`/`update` directes amb RLS i triggers                                                                                             | El mínim de codi                                                                     | El client podria escriure `is_retroactive` o `verification_level` si un trigger se n'escapa |

**Triat: A** (aprovat amb el disseny).

## Disseny

### Dades

**`posts`**

| Camp                        | Notes                                                                    |
| --------------------------- | ------------------------------------------------------------------------ |
| `id` uuid PK                |                                                                          |
| `author_id` uuid → profiles | `on delete cascade` (esborrar el compte, US-1402, s'endú els posts)      |
| `beer_id` uuid → beers      | la cervesa **final** (seguint `merged_into`) en el moment de crear-lo    |
| `serving` text              | `tap` \| `bottle` \| `can`                                               |
| `volume_ml` smallint null   | 50–5000                                                                  |
| `caption` text null         | 1–500 caràcters (buit → null)                                            |
| `consumed_at` timestamptz   | quan es va beure                                                         |
| `is_retroactive` boolean    | calculat al servidor                                                     |
| `publish_to_feed` boolean   |                                                                          |
| `verification_level` text   | `verified` \| `partial` \| `unverified`; sempre `unverified` fins a l'S9 |
| `created_at`, `updated_at`  |                                                                          |

Índexs: `(author_id, consumed_at desc)`, `(beer_id)`.

**`post_photos`** — `id`, `post_id` (cascade, **únic** de moment: una foto per post), `path` i `thumb_path` (únics), `source` (`camera` | `library`, declarat pel client, no és prova de res fins a l'S9), `exif_taken_at` timestamptz null, `width`, `height`, `created_at`. No es guarden coordenades.

**Bucket `post-photos`** — privat, només JPEG, 2 MB màxim. Camins `<user id>/<uuid>.jpg` i `<user id>/<uuid>_thumb.jpg`. Cadascú puja i esborra només a la seva carpeta; es poden llegir (URL signada) els fitxers propis i els de posts que l'usuari pot veure.

**Qui veu un post:** l'autor, sempre. Ningú més si `publish_to_feed = false`. Si `publish_to_feed = true`: qualsevol usuari autenticat si el perfil de l'autor és públic i ha acabat l'onboarding; ningú si és privat (a l'S4 hi entraran els amics). Funció `public.can_see_post(author_id, publish_to_feed)` (`security definer`), reutilitzada per la RLS de `posts`, `post_photos` i `storage.objects`.

**Escriptura:** cap `insert`/`update` directe per a `authenticated`. Sí `delete` directe del propi post (RLS); les fotos se'n van per cascada.

- **`create_post(beer_id, serving, volume_ml, caption, consumed_at = null, publish_to_feed = null, photo = null) → uuid`**
  - Cal sessió i onboarding fet.
  - La cervesa ha d'existir, ser `approved` (o creada per l'usuari) i es guarda la final.
  - `consumed_at` null → `now()`. Més de 5 min en el futur → error `consumed_in_future`. Abans de l'any 2000 → `consumed_too_old`.
  - `is_retroactive = consumed_at < now() - 1 h`.
  - `publish_to_feed` null → `consumed_at >= now() - 48 h`.
  - `photo` (jsonb `{ path, thumbPath, source, exifTakenAt, width, height }`): tots dos fitxers han d'existir al bucket, a la carpeta de l'usuari i ser seus; un camí ja usat → error.
  - Errors amb codis `P0001` i missatges estables (`beer_not_found`, `invalid_serving`, `invalid_volume`, `invalid_caption`, `photo_not_found`…).
- **`update_post(post_id, serving, volume_ml, caption, consumed_at, publish_to_feed)`** — només l'autor. No es pot canviar ni la cervesa ni la foto. Si el post és `verified`, la data tampoc (`locked_by_verification`). `is_retroactive` passa a `true` si la nova data és més d'1 h abans de `created_at`; **mai torna a `false`**.
- **Esborrar:** el client esborra primer els fitxers (API de Storage) i després la fila. Si falla l'esborrat dels fitxers, no es toca res; si falla la fila, tornar-ho a provar acaba la feina (esborrar un fitxer que ja no hi és no falla).

**`search_beers(q, max = 20)`** — cerveses aprovades i no fusionades on **cada paraula** de `q` (mínim 2 caràcters en total) apareix a "marca + nom" (minúscules, sense accents); ordre: coincidència exacta de marca o nom, més codis de barres, nom més curt. Retorna id, nom, marca, miniatura, % alcohol i estil. A la feature `beers`.

### App

Nova feature **`posts`** (i ampliacions de `beers` i `profile`):

- **Flux de creació** a la pestanya ➕ (passos dins la mateixa pantalla, amb botó Enrere):
  1. **Cervesa:** cercador (debounce 300 ms) + "Escaneja" + "Les teves últimes" (5 cerveses diferents dels teus posts recents) quan el cercador és buit. Sense resultats → "No la trobem" + escanejar-la (US-203 vindrà a l'S6).
  2. **Foto:** "Fes una foto" · "Tria de la galeria" · "Sense foto". Vista prèvia i "Canvia-la".
  3. **Detalls:** format (Tirador / Ampolla / Llauna, obligatori), volum (fitxes 200/330/500/568 ml + "Un altre", opcional), text (500), **Quan** ("Ara" o data i hora passades; si la foto de galeria té data EXIF a més d'1 h de l'ara, es proposa "Fer servir la data de la foto"), **Publicar al feed** (interruptor; per defecte segueix la regla de 48 h fins que el toques). Retroactiu → avís "Es marcarà com a registre retroactiu".
  4. **Publicar:** puja la foto (si n'hi ha), crida `create_post`, buida l'esborrany i obre el post. Error → missatge i l'esborrany queda.
- **Escàner com a selector:** `/scan?for=post`; quan troba la cervesa, la posa a l'esborrany i torna al flux en lloc d'obrir la fitxa.
- **Esborrany (Zustand + AsyncStorage):** cervesa, foto local (URI, EXIF, origen), format, volum, text, data, feed i pas. "Descarta" l'esborra. Si el fitxer local de la foto ja no existeix en publicar → es demana tornar a afegir-la.
- **Foto:** costat llarg 1080 px a JPEG 0,7 i miniatura de 320 px a JPEG 0,6. Es puja només en publicar, així un flux abandonat no deixa fitxers.
- **Detall del post** `/post/[id]`: foto (URL signada), cervesa (enllaç a la fitxa), format i volum, text, data, "Retroactiu" i "Només al teu registre" si toca; per a l'autor, **Edita** i **Esborra** (amb confirmació).
- **Edició** `/post/[id]/edit` (modal): format, volum, text, data, feed; cervesa i foto només lectura.
- **Perfil:** "Els meus últims registres" (els 20 més recents per data de consum) sota la capçalera; cada fila obre el post. La ruta del perfil compon `profile` i `posts` perquè cap feature no depengui de l'altra.
- Tots els textos a ca/es/en; textos de permisos d'`app.json` ampliats a les fotos de cerveses.

### GitHub

- `docs/PLAN.md`: US-301-T2 diu també "cerca de cervesa pel nom"; US-303 guanya **T3 · "Els meus últims registres" al perfil**.
- Subtasques amb `npm run backlog -- --tasks S3`; board amb `setup-project.ts --current S3`.
- Branques: `docs/sprint-3-design` (spec, pla, backlog) → `feature/us-301…` → `feature/us-302…` → `feature/us-303…`, cada una des de l'anterior. Tasques → la seva US amb _squash_ quan la CI és verda; les US → `main` queden obertes per a tu.

## Com es provarà

- **pgTAP** (BD temporal, no la local): RLS de `posts` (autor, desconegut amb perfil públic/privat, post no publicat, anònim), de `post_photos` i de `storage.objects`; `create_post` (camps calculats, cervesa fusionada → final, cervesa pendent d'un altre → error, data futura, foto d'un altre o inexistent, 48 h); `update_post` (només l'autor, retroactiu no torna enrere, `verified` bloqueja la data); cap `insert`/`update` directe; `search_beers` (totes les paraules, accents, ordre).
- **Jest:** reducer/estat del flux i regles de data (retroactiu, 48 h, EXIF → data local); esborrany persistent; compressió i pujada (mocks); pantalles: cercador, foto, detalls, publicar (crida i navegació), detall, edició, esborrar (ordre fitxers → fila), últims registres.
- **Web local** contra una Supabase temporal amb una còpia del catàleg: tot el flux sense càmera (galeria del navegador), captures per a les PRs.
- **Manual en mòbil (queda per a tu):** càmera, EXIF de galeria, que la foto pujada no té GPS, selector de data natiu.

## Decisions meves (revisa-les)

1. Retroactiu = consumida més d'**1 h** abans (de publicar o, en editar, de crear el post).
2. Una sola foto per post (restricció única que es pot treure).
3. `source` de la foto declarat pel client i sense valor de prova fins a l'S9.
4. Esborrar: primer fitxers, després fila.
5. Volums proposats: 200, 330, 500 i 568 ml (pinta).
6. Text del post: màxim 500 caràcters.
7. No es pot canviar la cervesa d'un post (més endavant la verificació en depèn); si t'equivoques, l'esborres i en fas un altre.
8. "Les teves últimes" i "Els meus últims registres" en comptes d'esperar l'historial de l'S8.
9. La cerca no fa servir l'índex trigram (amb 9.000 cerveses no cal); l'S6 farà el cercador unificat.

## Què queda en mans de qui ho construeixi

Noms de fitxers i components, com es divideixen les migracions, el disseny visual dins del tema actual, el format exacte de les dates a la UI, i els detalls del reducer del flux.
