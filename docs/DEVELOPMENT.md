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
