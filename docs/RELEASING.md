# Builds i publicació (EAS)

## Entorns actuals

| Entorn EAS           | Projecte Supabase | Ref                    | URL                                      |
| -------------------- | ----------------- | ---------------------- | ---------------------------------------- |
| development, preview | `beerapp-dev`     | `txznwvkrpiuqgbzskpdw` | https://txznwvkrpiuqgbzskpdw.supabase.co |
| production           | `beerapp-prod`    | `jvikptbacskqebxkblxx` | https://jvikptbacskqebxkblxx.supabase.co |

- Projecte Expo: [`@bili04/beerapp`](https://expo.dev/accounts/bili04/projects/beerapp)
- Regió Supabase: `eu-west-1` (Irlanda), pla Free
- Les variables `EXPO_PUBLIC_SUPABASE_URL` i `EXPO_PUBLIC_SUPABASE_KEY` (publishable) ja estan creades a cada entorn d'EAS.
- Aplicar migracions al núvol (primer a dev, després a prod):
  ```bash
  supabase db push --remote=txznwvkrpiuqgbzskpdw   # dev
  supabase db push --remote=jvikptbacskqebxkblxx   # prod
  ```

## Configuració inicial (un sol cop, ja feta)

1. Crear un compte a [expo.dev](https://expo.dev) i iniciar sessió:
   ```bash
   cd app && npx eas-cli@latest login
   ```
2. Vincular el projecte (afegeix `extra.eas.projectId` i `updates.url` a `app.json`):
   ```bash
   npx eas-cli@latest init
   npx eas-cli@latest update:configure
   ```
3. Variables per entorn (les claus són **públiques**: URL i _publishable key_ de Supabase):
   ```bash
   npx eas-cli@latest env:create --environment development --name EXPO_PUBLIC_SUPABASE_URL --value <url-dev> --visibility plaintext
   npx eas-cli@latest env:create --environment development --name EXPO_PUBLIC_SUPABASE_KEY --value <publishable-dev> --visibility plaintext
   # repetir per a preview i production (production → projecte Supabase prod)
   ```
4. Token per a GitHub Actions: crear-lo a expo.dev → _Access tokens_ i desar-lo com a secret `EXPO_TOKEN` al repo.

## Perfils (`app/eas.json`)

| Perfil               | Ús                                                                   | Canal OTA     | Entorn      |
| -------------------- | -------------------------------------------------------------------- | ------------- | ----------- |
| `development`        | Dev client al simulador d'iOS / APK Android                          | `development` | development |
| `development-device` | Dev client en un iPhone real (cal registrar-lo: `eas device:create`) | `development` | development |
| `preview`            | Proves internes (TestFlight intern / APK)                            | `preview`     | preview     |
| `production`         | Stores; el número de build s'incrementa sol                          | `production`  | production  |

```bash
npx eas-cli@latest build --profile development --platform ios
```

## Identificador de l'app

`com.bielpg04.beerapp` (iOS `bundleIdentifier` i Android `package`). **Provisional**: es pot canviar fins a la primera build pujada a una store; després és permanent.

## Releases

- **Versió nativa nova**: tag `vX.Y.Z` a `main` → el workflow `Release` fa build de producció i l'envia a les stores.
- **Només canvis de JS/assets**: EAS Update al canal `production` (el `runtimeVersion` per _fingerprint_ evita enviar JS incompatible amb una build antiga).

## Manteniment del pla gratuït de Supabase

Workflow `Maintenance` (`.github/workflows/maintenance.yml`):

- **Keep-alive diari** als projectes dev i prod (el pla gratuït es pausa després de 7 dies sense activitat).
- **Backup setmanal** de producció (rols + esquema + dades), **xifrat amb GPG** perquè els artifacts d'un repo públic els pot descarregar qualsevol usuari de GitHub. Es guarden 90 dies.

Secrets necessaris: `SUPABASE_DB_URL_DEV`, `SUPABASE_DB_URL_PROD` (cadena de connexió del _session pooler_) i `BACKUP_PASSPHRASE`.

Restaurar un backup:

```bash
gpg --decrypt backup-AAAA-MM-DD.tar.gpg > backup.tar && tar -xf backup.tar
psql "$DB_URL" -f backup/roles.sql -f backup/schema.sql -f backup/data.sql
```
