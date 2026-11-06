# ADR 0001 · Stack: Expo (React Native) + Supabase

- **Estat:** acceptat
- **Data:** 2026-11-06

## Context

Una sola persona desenvolupa una xarxa social mòbil per a iOS i Android, amb cost de servidor ~0 € i dades molt relacionals (amistats, feed, estadístiques) i geogràfiques (mapa de bars).

## Decisió

- **App:** React Native amb **Expo** (SDK 58), **Expo Router** i **TypeScript** strict. Builds i publicació amb EAS.
- **Backend:** **Supabase** (Postgres + PostGIS, Auth, Storage, Edge Functions), pla gratuït. Dos projectes: `dev` i `prod`. Seguretat amb Row Level Security.
- **Mapa:** MapLibre + tiles d'OpenFreeMap (sense clau ni facturació). Bars d'OpenStreetMap (Overpass), carregats per cel·les geohash a demanda.

## Alternatives descartades

- **Flutter:** igual de vàlid; Expo encaixa millor amb Supabase JS i els tipus generats de la BD.
- **Firebase:** Storage i Functions exigeixen el pla Blaze (targeta); Firestore és poc apte per a estadístiques i geo-consultes.
- **PocketBase en una VM gratuïta:** cost zero però tota l'operació (backups, updates, seguretat) recau en nosaltres.

## Conseqüències

- El projecte gratuït de Supabase es pausa després de 7 dies sense activitat → cron de keep-alive a GitHub Actions.
- Sense backups descarregables al pla gratuït → `pg_dump` setmanal des de GitHub Actions.
- 1 GB d'Storage → compressió d'imatges al client; capa `shared/storage` per poder migrar a Cloudflare R2.
