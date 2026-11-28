# Sprint 5 · Feed — pla d'implementació

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Feed d'amics amb reaccions i comentaris, i historial de la cervesa a la seva fitxa.

**Architecture:** Lectures amb funcions `security definer` que tornen files planes (autor inclòs); reaccions i comentaris escrits amb funcions que comproven `can_see_post`; esborrar comentaris per RLS. Feature nova `feed` a l'app; les rutes la composen amb `posts`, `beers` i `profile`.

**Spec:** `docs/superpowers/specs/2026-11-28-sprint-5-feed-design.md`

## Global Constraints

- Cap dependència nova. Textos a ca/es/en (espai `feed.*`).
- `feed` pot importar `@/features/posts` (formatadors, `usePhotoUrl`); `posts`, `profile`, `beers` i `social` no importen `feed`.
- Reaccions: `cheers | fire | laugh | drool`. Comentaris: 1–500 caràcters, un nivell de respostes.
- Feed: `created_at desc, id desc`, 20 per pàgina a l'app, màxim 50 al servidor.
- Errors `P0001` amb missatge estable; sense sessió `42501`. pgTAP en BD temporal.
- Git: `task/…` → _squash_ a `feature/…`; US → `main` obertes.

## Review Focus

1. **Algú publica mentre baixo pel feed** → la pàgina següent no repeteix ni salta posts (cursor estricte). _Task 1._
2. **Toco 🍺 sense connexió** → l'app la marca a l'instant i la desfà quan falla. _Task 6._
3. **Esborro un comentari amb respostes** → desapareixen totes. _Task 8._
4. **Un amic em bloqueja després d'haver comentat el meu post** → el seu comentari ja no surt (ni jo als seus). _Task 8._
5. **Cervesa fusionada** → l'historial compta els posts de la vella i de la nova. _Task 11._

---

## Fase 0 · `docs/sprint-5-design` (des de `feature/us-402…`)

### Task 0: spec, pla i subtasques (`npm run backlog -- --tasks S5`, 11 subtasques)

## Fase A · `feature/us-501-feed-d-amics`

### Task 1 (US-501-T1): `get_feed`

pgTAP `150_feed`: A amic de B, C públic no amic, D amic que bloqueja/és bloquejat. A veu els seus i els de B publicats; no els de C ni els no publicats de B; ordre i cursor (3 pàgines d'1 sense repetits encara que s'hi afegeixi un post nou); comptadors i `my_reaction` (amb files de prova a `reactions`/`comments` quan existeixin → en aquesta tasca, 0 i null); `max` limitat a 50; sense sessió `42501`.

### Task 2 (US-501-T2): `PostCard`

Jest: autor (nom, @, enllaç al perfil), foto signada, cervesa i format, temps relatiu ("fa 2 h"), "💬 3"; tocar → `/post/<id>`; sense foto → imatge de la cervesa.

### Task 3 (US-501-T3): llista infinita

`useFeed` (`useInfiniteQuery`, cursor `{ createdAt, id }` de l'últim) i `FeedScreen` a la pestanya Feed. Jest: primera pàgina, `onEndReached` demana la següent amb el cursor, refrescar torna a la primera.

### Task 4 (US-501-T4): estats

Jest: carregant, error amb "Torna-ho a provar", buit → "Afegeix amics" porta a `/friends`.

## Fase B · `feature/us-502-reaccionar-a-un-post`

### Task 5 (US-502-T1): `reactions` + `react` + `post_reactions` + `post_reaction_summary`

pgTAP `160_reactions`: crear, canviar, treure (null), post invisible `post_not_found`, tipus dolent `invalid_reaction`, cap escriptura directa, B no veu reaccions de posts que no veu, bloquejats fora de `post_reactions`, `get_feed` porta comptadors i `my_reaction`.

### Task 6 (US-502-T2): `ReactionBar` amb actualització optimista

Jest: tocar 🍺 crida `react(…,'cheers')` i suma 1 abans de la resposta; tornar a tocar la treu; mantenir premut obre el selector i triar 🔥 canvia; error → torna a l'estat anterior i avisa.

### Task 7 (US-502-T3): full de qui ha reaccionat

Jest: tocar el comptador obre el full amb persones i emoji; tocar una persona obre el perfil.

## Fase C · `feature/us-503-comentar-un-post`

### Task 8 (US-503-T1): `comments` + `add_comment` + `post_comments`

pgTAP `170_comments`: afegir, text buit/llarg `invalid_comment`, resposta, resposta de resposta `invalid_parent`, pare d'un altre post `invalid_parent`, post invisible, esborrar propi, esborrar el d'un altre al meu post, no esborrar el d'un altre al post d'un altre, esborrar pare s'endú respostes, bloquejats amagats, `get_feed.comment_count`.

### Task 9 (US-503-T2): comentaris al detall del post

Jest: llista amb autors i respostes sagnades; escriure i enviar crida `add_comment` i neteja el camp; "Respon" posa el pare; enviar buit desactivat.

### Task 10 (US-503-T3): esborrar

Jest: "Esborra" visible per al meu comentari i per a tots al meu post; confirmació → `delete` i desapareix.

## Fase D · `feature/us-205-historial-i-amics-a-la-fitxa-de-cervesa`

### Task 11 (US-205-T1): `beer_history` + `BeerHistory`

pgTAP `180_beer_history`: el meu recompte (inclou fusionades), amics amb recompte, no amics fora, posts no visibles fora. Jest: "L'has begut 3 vegades", "Encara no l'has begut", amics amb el seu recompte i enllaç; la fitxa de cervesa accepta contingut de la ruta.

## Final

Web local amb dos usuaris; revisió de tota la branca; PRs de les US a `main`.
