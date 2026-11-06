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
