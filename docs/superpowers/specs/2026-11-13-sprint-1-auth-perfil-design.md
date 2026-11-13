# Sprint 1 · Autenticació, edat i perfil — disseny

- **Data:** 2026-11-13
- **US:** US-101 (registre i login), US-102 (verificació d'edat), US-103 (crear i editar perfil)
- **Estat:** pendent d'aprovació

## Intenció

Que qualsevol persona pugui crear-se un compte a BeerApp, demostrar que té l'edat legal per beure i deixar el seu perfil a punt (username, nom, avatar), perquè la resta de l'app (amics, feed, posts) tingui sobre què construir-se. L'app ha d'estar **oberta a tothom**, no només a un grup de proves.

## Objectius

- Login amb **email (codi de 6 dígits)**, **Sign in with Apple** i **Google**, tots sobre Supabase Auth.
- Sessió persistent; logout.
- Onboarding obligatori abans d'entrar a l'app: data de naixement + país → username, nom i avatar.
- Edat mínima validada **al servidor**, no només a la UI.
- Pantalla per editar el perfil (nom, bio, avatar, país, privacitat).
- Seguretat a la BD: cadascú només pot modificar el seu perfil.

## No objectius (aquest sprint)

- Veure el perfil d'una altra persona (US-104, S4), amistats, cerca d'usuaris.
- Esborrar el compte des de l'app (US-1402, S12) — obligatori abans de publicar, no abans.
- Recuperar contrasenya: no hi ha contrasenyes (veure Enfocaments).
- Verificació documental de l'edat (DNI, etc.).

## Anti-objectius

- Que un menor pugui completar el registre canviant la data a la UI o cridant l'API directament.
- Que algú pugui editar o suplantar el perfil d'un altre.
- Que el login depengui d'un servei de pagament o amb límits que trenquin l'app quan creixi.
- Pantalles que només funcionin en anglès.

## Restriccions

- **Comptes que encara no existeixen:** Apple Developer (99 $/any), domini propi, Google Cloud (gratuït). El codi s'ha de poder escriure i provar en part sense ells, i activar-se quan arribin.
- **Supabase gratuït només envia correus als membres del teu equip** amb el servei per defecte. Per obrir-lo a tothom cal SMTP propi → domini.
- **Apple i Google natius no funcionen a Expo Go**: necessiten una build de desenvolupament (EAS, gratuïta).
- **Aquest Mac no té simulador** (ni Xcode ni Android SDK). Una build de desenvolupament per a **iPhone físic requereix el compte d'Apple Developer**; per a Android físic, no.
- Normes d'Apple: si a iOS hi ha login amb Google, cal oferir també Sign in with Apple.

## Enfocaments

|          | Enfocament                                                                                                                                                                | Pros                                                                                                                         | Contres                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **A ✅** | **Login natiu sobre Supabase Auth**: email OTP + `expo-apple-authentication` + Google Sign-In natiu; els tokens d'Apple/Google es passen a Supabase (`signInWithIdToken`) | Experiència nativa, encaix amb les normes d'Apple, una sola sessió i les mateixes regles RLS per a tots els mètodes, gratuït | Cal build de desenvolupament per provar Apple/Google                        |
| B        | Apple i Google via navegador (`signInWithOAuth` + retorn per enllaç)                                                                                                      | Menys codi natiu                                                                                                             | Salt al navegador, gestió de redireccions, pitjor davant la revisió d'Apple |
| C        | Servei extern (Clerk, Firebase Auth)                                                                                                                                      | —                                                                                                                            | Trenca la integració amb RLS de Supabase, límits/costos                     |

**Triat: A** (decisió teva).

Email amb **codi de 6 dígits** en lloc d'enllaç màgic (decisió meva): l'usuari no surt de l'app, funciona a Expo Go i evita problemes d'enllaços que s'obren al navegador equivocat. Sense contrasenyes → no cal flux de "recuperar contrasenya" (T1 de US-101 es redueix a pantalla de login + pantalla del codi).

Correu: **Resend** com a SMTP de Supabase (3.000 correus/mes gratuïts) amb un domini propi (decisió meva, pendent de comprar el domini).

## Disseny

### Flux

```
Obrir app
 ├─ sense sessió ─────────────► (auth)/login
 │                                ├─ "Continua amb Apple"   (només iOS)
 │                                ├─ "Continua amb Google"
 │                                └─ email → (auth)/code (6 dígits)
 ├─ sessió, onboarding pendent ► (onboarding)/age → (onboarding)/profile
 └─ sessió, perfil complet ────► (tabs)
```

- La decisió de cap on anar la pren el `_layout` arrel segons l'estat (`loading | signedOut | needsOnboarding | ready`), amb `Stack.Protected` / redireccions d'Expo Router.
- Si Apple o Google no estan configurats en aquell build (falta l'ID de client a l'entorn), el botó **no es mostra**. Així el codi pot entrar abans que els comptes.
- Logout: a la pantalla d'editar perfil (fins que hi hagi pantalla d'ajustos).

### Dades (`public.profiles`)

| Camp                       | Tipus                                        | Notes                                                                                        |
| -------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `id`                       | uuid PK → `auth.users(id)` on delete cascade |                                                                                              |
| `username`                 | `citext` únic, nullable fins a l'onboarding  | 3–20 caràcters `[a-z0-9_.]`, no pot començar/acabar amb `.`; únic sense distingir majúscules |
| `display_name`             | text                                         | 1–50 caràcters                                                                               |
| `avatar_path`              | text                                         | ruta dins el bucket `avatars`                                                                |
| `bio`                      | text                                         | ≤ 160 caràcters                                                                              |
| `birthdate`                | date                                         | obligatòria per completar l'onboarding; **no visible per a ningú més**                       |
| `country`                  | char(2) ISO 3166-1                           |                                                                                              |
| `is_private`               | boolean, default `false`                     | veure Decisions meves                                                                        |
| `onboarded_at`             | timestamptz                                  | null = onboarding pendent                                                                    |
| `created_at`, `updated_at` | timestamptz                                  |                                                                                              |

- **Trigger** a `auth.users` (insert) crea la fila buida de `profiles`. Amb Apple (que només dona el nom el primer cop) i Google, s'omple `display_name` si arriba.
- **Edat al servidor:** dues funcions `security definer`, una per pas de l'onboarding: `set_birthdate(birthdate, country)` valida l'edat mínima segons el país i la desa; `complete_profile(username, display_name)` exigeix l'edat ja validada, valida format i unicitat del username i marca `onboarded_at`. `birthdate` i `country` **no es poden canviar** per un `update` directe un cop fixats (trigger), per evitar que un menor reintenti.
- **Edat mínima:** 21 si `country = 'US'`, 18 per a la resta. Taula `legal_drinking_age(country, min_age)` per poder afinar països més endavant sense migrar codi.
- **RLS:** `select` per a usuaris autenticats de les columnes públiques (vista `public_profiles` sense `birthdate`); `update` només el propi perfil i només les columnes editables (`display_name`, `bio`, `avatar_path`, `is_private`); cap `insert`/`delete` des del client.
- **Comprovació de username en viu:** RPC `username_available(text) → boolean` (també valida el format).

### Avatar

- Bucket `avatars` amb lectura pública; escriptura només a `avatars/<user_id>/*` (política de Storage).
- Al client: `expo-image-picker` (galeria o càmera) → `expo-image-manipulator` a 512×512 JPEG ~0.7 (~50 KB) → pujada. Nom de fitxer nou a cada canvi (evita memòria cau antiga) i s'esborra l'anterior.

### Codi a l'app

- `features/auth`: client d'auth (email OTP, Apple, Google), hook `useSession`, pantalles de login i codi.
- `features/profile`: API del perfil (TanStack Query), onboarding (edat, perfil), pantalla d'edició, `UsernameField` amb comprovació en viu (debounce 400 ms).
- S'afegeixen **TanStack Query**, **react-hook-form + zod** (ja previstos al pla), `expo-apple-authentication`, `@react-native-google-signin/google-signin`, `expo-image-picker`, `expo-image-manipulator`.
- Tots els textos a ca/es/en.

### Configuració externa (quan existeixin els comptes)

| Què                                                             | On                                                   | Desbloqueja              |
| --------------------------------------------------------------- | ---------------------------------------------------- | ------------------------ |
| Projecte Google Cloud + IDs de client OAuth (web, iOS, Android) | Google Cloud → Supabase (proveïdor Google) + EAS env | Google                   |
| Apple Developer + Service ID / clau Sign in with Apple          | Apple → Supabase (proveïdor Apple)                   | Apple, builds a iPhone   |
| Domini + Resend                                                 | DNS del domini → Resend → Supabase SMTP              | Email a qualsevol adreça |
| Plantilla del correu amb el codi (ca/es/en)                     | `supabase/config.toml` + dashboard                   | Correu en català         |

## Com es provarà

- **pgTAP:** creació automàtica de perfil, RLS (no puc editar el d'un altre, no puc canviar `birthdate`), edat (17 → rebutjat; 18 a ES → ok; 20 a US → rebutjat; 21 a US → ok), format i unicitat del username.
- **Jest:** validacions dels formularis, lògica de redirecció segons estat de sessió, `UsernameField`.
- **Manual:**
  - Email: en local amb Mailpit (qualsevol adreça) i al projecte dev amb la teva adreça.
  - Google i Apple: amb build de desenvolupament en un mòbil real quan hi hagi els comptes.

## Decisions meves (revisa-les)

1. Codi de 6 dígits per email, sense contrasenyes ni enllaç màgic.
2. Resend com a proveïdor de correu.
3. Username: 3–20 caràcters `a-z 0-9 _ .`, sense distingir majúscules.
4. Perfil **públic per defecte** (`is_private = false`): nom, username i avatar sempre visibles perquè et puguin trobar; amb perfil privat, posts i estadístiques només per a amics.
5. Edat: 21 als EUA, 18 a la resta (taula per afinar-ho).
6. La data de naixement i el país no es poden canviar després de l'onboarding (només via suport).
7. Avatar 512×512, lectura pública.
8. Logout a la pantalla d'editar perfil de moment.

## Ordre de feina proposat

1. **US-103 T1** — taula `profiles`, trigger, RLS, Storage (sense dependències externes).
2. **US-101 T2 + T5** — login per email + guard de rutes (provable a Expo Go amb Mailpit).
3. **US-102** — onboarding d'edat amb validació al servidor.
4. **US-103 T2–T4** — onboarding de perfil, avatar, edició.
5. **US-101 T4** — Google (codi + build de desenvolupament; activació quan hi hagi Google Cloud).
6. **US-101 T3** — Apple (codi; activació i proves quan hi hagi Apple Developer).
7. SMTP propi quan hi hagi domini.

## Què queda en mans de qui ho construeixi

Estructura interna dels components, noms de fitxers, missatges d'error concrets, disseny visual de les pantalles dins del tema existent, i com es divideixen les migracions.
