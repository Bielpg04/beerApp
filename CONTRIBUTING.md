# Guia de contribució

Projecte d'una sola persona, però amb el workflow d'un equip: tot passa per issues, branques i PRs.

## Jerarquia a GitHub

| Nivell | Issue | Label | Exemple |
|---|---|---|---|
| Epic | `EPIC-07 · Bars i mapa` | `epic` | |
| User story | `US-701 · Model de bars…` (sub-issue de l'epic) | `user-story` | milestone = sprint |
| Subtasca | `US-701-T2 · Edge Function venues-sync` (sub-issue de la US) | `task` | una subtasca = una branca = una PR |

- El backlog viu a [`docs/PLAN.md`](docs/PLAN.md). Per crear/actualitzar issues:
  `node scripts/backlog/create-backlog.ts --dry-run --tasks S1` i després sense `--dry-run`.
- Les subtasques es creen a GitHub en planificar cada sprint (`--tasks SN`).
- Cada sprint és un milestone de 14 dies.

## Branques

```
main                                     sempre publicable, protegida
 └─ feature/us-701-model-de-bars-i-...   branca de la US (des de main)
     ├─ task/us-701-t1-migracions-...    branca de subtasca (des de la US)
     └─ task/us-701-t2-edge-function-...
fix/<issue>-descripcio                   bugs (des de main)
chore/<descripcio>                       manteniment (des de main)
```

El nom exacte de cada branca surt al cos de l'issue.

## Flux de treball

1. Crear la branca de la US des de `main` i pujar-la (`git push -u origin feature/...`).
2. Per a cada subtasca: branca `task/...` des de la US → commits → PR **cap a la branca de la US** → **squash merge**.
3. Quan totes les subtasques estan fetes: PR de la US **cap a `main`** → **merge commit** (a l'historial es veu la US com un bloc amb les seves subtasques).
4. Cada PR porta `Closes #<issue>`. Les PRs cap a branques de US també tanquen issues gràcies al workflow `close-linked-issues`.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/), validats per commitlint:

```
feat(feed): add infinite scroll
fix(auth): keep session after app restart
chore(ci): cache node_modules
```

Tipus: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `style`, `chore`, `ci`, `build`, `revert`.
Scope = feature o àrea (`auth`, `feed`, `map`, `db`, `ci`, `scripts`…).

## Definition of Done

- Lint, typecheck i tests en verd (local i CI)
- Si toca BD: migració versionada + tests pgTAP (incloent RLS)
- Textos traduïts a ca/es/en
- Provat a iOS i Android si toca l'app; captures a la PR si és UI
- Docs o ADR (`docs/adr/`) si hi ha una decisió nova

## Releases

- Tag semver `vX.Y.Z` a `main` → build i submit amb EAS.
- Canvis només de JS → EAS Update (OTA).
