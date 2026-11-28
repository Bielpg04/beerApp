# Sprint 5 · Feed — disseny

- **Data:** 2026-11-28
- **US:** US-501 (feed d'amics), US-502 (reaccionar), US-503 (comentar), US-205 (historial i amics a la fitxa de cervesa)
- **Estat:** decidit per mi. El 2026-11-28 em vas demanar que fes tots els sprints que pogués sense aturar-me; les decisions són a "Decisions meves".

## Intenció

Que obrir l'app ensenyi **què beuen els amics** i que s'hi pugui reaccionar i comentar. És la pantalla principal de l'app i el que fa tornar-hi. També, a la fitxa d'una cervesa, saber quantes vegades l'has begut i quins amics l'han provada.

## Objectius

- Pestanya Feed: els meus posts i els dels amics publicats al feed, els més nous primer, amb scroll infinit i "estira per refrescar".
- `PostCard`: autor, foto, cervesa, format, data, reaccions i nombre de comentaris. Tocar-la obre el post.
- Reaccions: 🍺 Salut, 🔥, 😂, 🤤. Una per persona i post; es pot canviar o treure. Comptador i llista de qui ha reaccionat.
- Comentaris d'un nivell de respostes; esborrar el meu o qualsevol del meu post.
- Fitxa de cervesa: "L'has begut N vegades" i els amics que l'han begut.

## No objectius

- Bar del post (S7), etiquetats (S6), badge de verificació (S9): la `PostCard` els deixa per a aquells sprints.
- Notificacions de reaccions i comentaris (S11).
- Editar comentaris; mencions; reaccions als comentaris.
- Posts de perfils públics de no amics al feed (el feed és d'amics).

## Anti-objectius

- Veure al feed, a les reaccions o als comentaris res d'un post que no puc veure.
- Reaccionar o comentar en nom d'un altre, o en un post que no puc veure.
- Que algú bloquejat aparegui als comentaris o a la llista de reaccions.
- Un feed que salta o repeteix posts en carregar la pàgina següent.

## Restriccions

- La visibilitat d'un post ja és `can_see_post` (amistats i bloquejos inclosos): reaccions i comentaris la reutilitzen.
- `profiles` només és llegible pel propietari: autors de posts, de reaccions i de comentaris surten de funcions `security definer`.
- Cap mòdul natiu nou.

## Enfocaments

|          | Enfocament                                                                                                                                        | Pros                                                        | Contres                                                                                |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **A ✅** | `get_feed(before_created_at, before_id, max)` `security definer` que torna cada post ja "pla" (autor, cervesa, foto, comptadors, la meva reacció) | Una petició per pàgina; autor inclòs sense obrir `profiles` | Funció llarga                                                                          |
| B        | `select` de `posts` amb _embeds_ de PostgREST                                                                                                     | Menys SQL                                                   | No pot portar l'autor (`profiles` és privat) ni comptadors agregats sense vistes extra |

## Disseny

### Dades

- **`get_feed(before_created_at timestamptz = null, before_id uuid = null, max int = 20)`**: posts on l'autor sóc jo o un amic, `publish_to_feed`, sense bloqueig; ordre `created_at desc, id desc`; cursor estricte. Columnes: les del post, `author_username`, `author_display_name`, `author_avatar_path`, `beer_name`, `beer_brand`, `beer_image_thumb_url`, `photo_path`, `photo_thumb_path`, `photo_width`, `photo_height`, `reaction_counts jsonb` (`{"cheers": 2}`), `my_reaction text`, `comment_count int`. Màxim 50 per pàgina.
- **`reactions`** (`post_id`, `user_id`, `type` ∈ `cheers | fire | laugh | drool`, `created_at`; PK post+usuari, cascades). RLS: llegeixo les reaccions dels posts que puc veure; cap escriptura directa.
  - `react(post_id, type)`: crea o canvia la meva; `type` null → la treu. Post no visible → `post_not_found`; tipus dolent → `invalid_reaction`.
  - `post_reactions(post_id)`: qui ha reaccionat (id, username, display_name, avatar_path, type), sense bloquejats, més recents primer.
  - `post_reaction_summary(post_id)`: `reaction_counts`, `my_reaction` (per al detall del post).
- **`comments`** (`id`, `post_id`, `author_id`, `parent_id` null, `body` 1–500, `created_at`; cascades). Una resposta no pot tenir resposta (`parent_id` d'un comentari arrel del mateix post).
  - RLS: llegeixo els comentaris de posts que puc veure, excepte els d'autors amb bloqueig amb mi. `delete` directe: autor del comentari o autor del post. Cap `insert`/`update` directe.
  - `add_comment(post_id, body, parent_id = null) → uuid`: post visible (`post_not_found`), text 1–500 (`invalid_comment`), pare vàlid (`invalid_parent`).
  - `post_comments(post_id)`: comentaris amb autor, ordre cronològic (respostes sota el pare a l'app).
- **`beer_history(beer_id)`**: `my_count` (els meus posts d'aquesta cervesa, o de les fusionades cap a ella) i `friends` (id, username, display_name, avatar_path, count) amb posts que jo puc veure, els que més l'han begut primer, màxim 20.

### App (feature nova `feed`)

- `useFeed()` (`useInfiniteQuery`, 20 per pàgina), `FeedScreen` amb `FlatList`, `onEndReached`, `RefreshControl`; estats: carregant, error amb reintentar, buit ("Encara no hi ha res. Afegeix amics…" → `/friends`).
- `PostCard`: capçalera d'autor (enllaç al perfil), foto (URL signada de la miniatura gran: la foto, no la miniatura), cervesa i format, "fa 2 h", `ReactionBar` i "💬 N".
- `ReactionBar`: botó 🍺 (tocar = Salut o treure-la; mantenir premut = selector de les quatre) amb actualització optimista; comptador total que obre el full "Reaccions" (qui i què).
- Detall del post: `ReactionBar` i els comentaris a sota (llista + camp per escriure + "Respon" + "Esborra" amb confirmació).
- La fitxa de cervesa rep de la ruta un bloc `BeerHistory` (feature `feed`, perquè parla d'amics i posts).
- Textos a ca/es/en.

## Decisions meves

1. Feed per `created_at` (quan es publica), no per `consumed_at`: un retroactiu publicat avui surt a dalt.
2. Les quatre reaccions de la US; la principal és 🍺 Salut.
3. Comentaris amb un sol nivell de respostes; esborrar un comentari s'endú les respostes.
4. Sense paginar comentaris ni reaccions (màxim 200 de cada en la consulta).
5. `beer_history` compta les fusionades cap a la cervesa i només posts que puc veure.

## Com es provarà

- pgTAP: `get_feed` (amics sí, no amics públics no, no publicats no, bloquejats no, cursor sense repetits); `react` (crear, canviar, treure, post invisible, tipus dolent, cap escriptura directa); comentaris (afegir, resposta de resposta prohibida, esborrar propi / del meu post / d'un altre no, bloquejats amagats); `beer_history`.
- Jest: feed (pàgines, refrescar, buit, error), `PostCard`, `ReactionBar` (optimista i revertir si falla, selector), full de reaccions, comentaris (afegir, respondre, esborrar), `BeerHistory`.
- Web local amb dos usuaris contra una Supabase temporal.
