# 🍺 BeerApp

Xarxa social per registrar **quines cerveses beus, on, quan i amb qui**: perfil, amics, feed amb reaccions i comentaris, estadístiques, logros, verificació amb foto i un mapa de bars amb les seves cerveses i preus.

> Nom provisional.

## Stack

- **App**: React Native + Expo (TypeScript, Expo Router) — un sol codi per a iOS i Android
- **Backend**: Supabase (Postgres + PostGIS, Auth, Storage, Edge Functions)
- **Mapa**: MapLibre + OpenFreeMap · dades de bars d'OpenStreetMap
- **CI/CD**: GitHub Actions + EAS

## Documentació

- [Pla del projecte](docs/PLAN.md) — arquitectura, backlog, sprints
- [Guia de contribució](CONTRIBUTING.md) — workflow de git, branques, commits, Definition of Done
- [Desenvolupament local](docs/DEVELOPMENT.md) — requisits, Supabase local, scripts
- [Builds i publicació](docs/RELEASING.md) — EAS, perfils, entorns, releases

## Estructura

```
app/         Aplicació Expo
supabase/    Migracions, Edge Functions, tests pgTAP
scripts/     Utilitats (importadors, backlog)
docs/        Documentació i ADRs
```

## Llicència

Tots els drets reservats. El codi és públic per transparència, però no té llicència de reutilització.
