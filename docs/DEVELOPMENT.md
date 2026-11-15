# Desenvolupament local

## Requisits

- Node.js ≥ 24 (`brew install node`)
- Docker Desktop (per a Supabase local)
- Supabase CLI (`brew install supabase/tap/supabase`)
- Per executar l'app: Expo Go al mòbil, o Xcode / Android Studio per a simuladors

## Primer cop

```bash
npm install                 # eines del repo + hooks de git (lefthook)
npm --prefix app install    # app Expo
npm run db:start            # aixeca Supabase local (Postgres, Auth, Storage, Studio)
```

`supabase start` mostra les URLs i claus locals (són claus de demo, iguals per a tothom).
Studio: http://127.0.0.1:54323 · Correus de prova (Mailpit): http://127.0.0.1:54324

## Base de dades

```bash
npm run db:migration nom_descriptiu   # nou fitxer a supabase/migrations/
npm run db:reset                      # recrea la BD local: migracions + seed.sql
npm run db:lint                       # comprova funcions i esquema
```

- Tots els canvis d'esquema van en **migracions** versionades, mai editant a mà a Studio.
- Les dades de prova locals van a `supabase/seed.sql`.

## App

```bash
cd app
npx expo start      # Expo Go / dev build
npm test            # Jest
npm run lint && npm run typecheck
```

## Connexió de l'app amb Supabase

```bash
cp app/.env.example app/.env.local   # valors de la BD local
npm run db:types                     # regenera app/src/types/database.ts després de cada migració
```

El client tipat és `supabase` a `@/shared/lib`. Les variables `EXPO_PUBLIC_*` s'inclouen dins l'app: només hi poden anar claus **públiques** (URL i _publishable key_), mai la _secret key_.

## Tests de la base de dades (pgTAP)

```bash
npm run db:test   # executa supabase/tests/database/*.test.sql
```

Cada fitxer obre una transacció (`begin` … `rollback`), declara `plan(n)` i acaba amb `finish()`. Tota taula nova porta tests de **RLS**: què pot llegir i escriure cada rol (anònim, propietari, amic, desconegut).

## Catàleg de cerveses

El catàleg s'omple amb [Open Brewery DB](https://www.openbrewerydb.org) (cerveseres) i el bolcat CSV d'[Open Food Facts](https://world.openfoodfacts.org) (cerveses venudes a Europa o als EUA). L'importador és idempotent: no esborra res i no canvia l'`id` ni el nom de les cerveses existents.

```bash
npm run catalog:import -- --source all             # BD local (descarrega ~1,5 GB en streaming)
npm run catalog:import -- --source off --dry-run   # només l'informe, sense connectar a la BD
npm run catalog:import -- --source off --off-file dump.csv.gz   # amb un bolcat ja descarregat
CATALOG_DB_URL=<url del session pooler> npm run catalog:import -- --source all   # dev/prod
```

- Al núvol ho fa la GitHub Action **Catalog import** cada mes (o a mà amb _Run workflow_).
- L'informe llista les cerveses que han agrupat diversos productes: revisa-les per detectar fusions errònies.
- Conflictes (codis d'una mateixa cervesa repartits entre dues fitxes) → taula `catalog_import.conflicts`; es fusionen a mà amb `select catalog_import.merge_beers('<duplicat>', '<bona>');`.
- La normalització viu a `supabase/functions/_shared/catalog/` (la fa servir també la Edge Function `beer-lookup`).
