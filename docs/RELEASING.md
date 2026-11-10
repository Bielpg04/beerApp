# Builds i publicació (EAS)

## Configuració inicial (un sol cop)

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
