# Sprint 1 · Autenticació, edat i perfil — pla d'implementació

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Login amb email (codi), Google i Apple sobre Supabase Auth, onboarding obligatori amb edat validada al servidor, i perfil propi editable.

**Architecture:** La BD (`profiles`, RPCs `security definer`, RLS, Storage) és la font de veritat de les regles (edat, username, permisos). L'app té dues features noves (`auth`, `profile`) amb TanStack Query; el `_layout` arrel decideix la ruta amb `Stack.Protected` a partir d'un estat pur `routeState()`.

**Tech Stack:** Expo SDK 58 · Expo Router 58 (`Stack.Protected`) · Supabase JS 2.119 · Postgres 17 + pgTAP · TanStack Query 5 · react-hook-form 7 + zod 4 · expo-apple-authentication · @react-native-google-signin/google-signin 17 · expo-image-picker · expo-image-manipulator

**Spec:** `docs/superpowers/specs/2026-11-13-sprint-1-auth-perfil-design.md`

## Global Constraints

- Paquets d'Expo sempre amb `npx expo install`; la resta amb versió exacta (`--save-exact`).
- Tots els textos visibles a `app/src/shared/i18n/locales/{ca,es,en}.json` (el test de paritat de claus ha de passar).
- Imports entre features només via `@/features/<feature>` (regla ESLint existent).
- Edat mínima: **21 si `country = 'US'`, 18 per a la resta**, calculada sobre la data actual del servidor.
- Username: `^[a-z0-9_.]{3,20}$`, sense `.` al principi ni al final, únic sense distingir majúscules (`citext`).
- `display_name` 1–50 caràcters; `bio` ≤ 160; `country` ISO 3166-1 alfa-2 en majúscules.
- `birthdate` mai visible per a altres usuaris; `birthdate` i `country` immutables un cop `onboarded_at` no és null.
- Avatar: 512×512 JPEG qualitat 0.7, ruta `avatars/<user_id>/<uuid>.jpg`, lectura pública.
- Codi d'email: 6 dígits (`supabase/config.toml` → `[auth.email] otp_length = 6`).
- Botons d'Apple/Google ocults si falta la seva configuració a l'entorn.
- Cada migració → `npm run db:types` i commit del fitxer de tipus (la CI ho comprova).
- Git: una branca `task/us-xxx-tn-…` per subtasca (nom exacte al cos de l'issue), PR cap a `feature/us-xxx-…` amb squash; la US cap a `main` amb merge commit.

## Review Focus

1. **Username amb majúscules o accents** ("Biel", "pèl") → s'ha de rebutjar amb missatge clar, no petar; "Biel" i "biel" són el mateix. _Test a Task 1 (pgTAP) i Task 8 (Jest)._
2. **Aniversari avui** (fa 18 anys exactes avui, país ES) → acceptat; un dia menys → rebutjat. _Test a Task 5._
3. **Codi d'email incorrecte o caducat** → missatge d'error i es pot reenviar el codi, sense quedar bloquejat. _Test a Task 3._
4. **Tancar l'app a mig onboarding** → en tornar a obrir torna al pas pendent, no a les pestanyes. _Test a Task 4._
5. **Username agafat entre la comprovació en viu i l'enviament** (carrera) → error d'unicitat traduït a "aquest nom ja està agafat", no un error genèric. _Test a Task 8._

---

## Fase 0 · Preparació

### Task 0: Subtasques de l'S1 a GitHub

- [ ] **Step 1:** `npm run backlog -- --dry-run --tasks S1` → ha de llistar 11 issues nous (`US-101-T1…T5`, `US-102-T1…T2`, `US-103-T1…T4`).
- [ ] **Step 2:** `npm run backlog -- --tasks S1` i `node scripts/github/setup-project.ts` (afegeix-los al tauler).
- [ ] **Step 3:** Comentar a `US-101-T1` que "recuperar contrasenya" queda fora (no hi ha contrasenyes, veure spec).
- [ ] **Step 4:** Commit de spec + pla en una branca `docs/sprint-1-design` → PR a `main`.

---

## Fase A · `feature/us-103-crear-i-editar-el-meu-perfil` (part 1)

### Task 1 (US-103-T1): Taula `profiles`, trigger i RLS

**Files:**

- Create: `supabase/migrations/<ts>_profiles.sql`
- Create: `supabase/tests/database/010_profiles.test.sql`
- Modify: `app/src/types/database.ts` (generat)

**Interfaces:**

- Produces: taula `public.profiles` (columnes de la spec), vista `public.public_profiles(id, username, display_name, avatar_path, bio, country, is_private, created_at)`, funció `public.username_available(candidate text) returns boolean`, funció interna `public.is_valid_username(text) returns boolean`.

- [ ] **Step 1: Test que falla** — `010_profiles.test.sql` amb un helper `pg_temp.login_as(uid uuid)` (`set local role authenticated` + `set_config('request.jwt.claims', …)`), creant 2 usuaris a `auth.users`. Assercions:
  - `has_table('public','profiles')`
  - inserir a `auth.users` crea una fila a `profiles` amb `onboarded_at is null`
  - Apple/Google: `raw_user_meta_data->>'full_name' = 'Anna Puig'` → `display_name = 'Anna Puig'`
  - com a A: `update profiles set bio='hola' where id = A` afecta 1 fila; `where id = B` afecta 0
  - com a A: `update profiles set birthdate=…` → `throws_ok` (permís de columna)
  - com a A: `select birthdate from profiles where id = B` → 0 files; `select * from public_profiles` no té columna `birthdate` (`hasnt_column`)
  - `username_available('biel')` → true; després d'assignar `'biel'` a B: `username_available('BIEL')` → false
  - `is_valid_username`: `'ab'`, `'.biel'`, `'biel.'`, `'pèl'`, `'Biel Palomar'` → false; `'biel_04'`, `'b.p'` → true
- [ ] **Step 2:** `npm run db:reset && npm run db:test` → FAIL (`profiles` no existeix).
- [ ] **Step 3: Migració** — `create extension citext with schema extensions`; taula amb `check`s de la spec; trigger `on_auth_user_created` (`security definer`, `search_path = ''`); trigger `updated_at`; RLS activat; `select` sobre `profiles` només `id = auth.uid()`; vista `public_profiles` amb `security_invoker = false` i `grant select … to authenticated`; `revoke update on profiles from authenticated` + `grant update (display_name, bio, avatar_path, is_private) on profiles to authenticated` + policy `update using (id = auth.uid())`; sense `insert`/`delete` per a `authenticated`.
- [ ] **Step 4:** `npm run db:reset && npm run db:test && npm run db:lint` → PASS.
- [ ] **Step 5:** `npm run db:types`, commit `feat(db): add profiles table with RLS and username rules`.

---

## Fase B · `feature/us-101-registre-i-login` (part 1)

### Task 2 (US-101-T2): Login per email amb codi i sessió

**Files:**

- Modify: `supabase/config.toml` (`otp_length = 6`, `otp_expiry = 600`), `supabase/templates/magic_link.html` (plantilla amb `{{ .Token }}`, ca/es/en en un sol correu)
- Create: `app/src/shared/lib/query-client.ts`
- Create: `app/src/features/auth/api/email.ts`, `app/src/features/auth/hooks/use-session.ts`, `app/src/features/auth/index.ts`
- Test: `app/src/features/auth/__tests__/email.test.ts`, `app/src/features/auth/__tests__/use-session.test.tsx`

**Interfaces:**

- Produces:
  - `queryClient: QueryClient` i `<QueryProvider>` a `@/shared/lib`
  - `sendEmailCode(email: string): Promise<void>` (llança `AuthError` traduïble)
  - `verifyEmailCode(email: string, code: string): Promise<void>`
  - `signOut(): Promise<void>` (també buida `queryClient`)
  - `useSession(): { status: 'loading' | 'signedIn' | 'signedOut'; userId: string | null }`
  - `emailSchema`, `codeSchema` (zod) a `features/auth`

- [ ] **Step 1: Tests que fallen** (mock de `@/shared/lib/supabase`):
  - `sendEmailCode('  Biel@Example.com ')` crida `signInWithOtp({ email: 'biel@example.com', options: { shouldCreateUser: true } })`
  - `verifyEmailCode('biel@example.com', '123456')` crida `verifyOtp({ email, token: '123456', type: 'email' })`
  - error de Supabase → la promesa rebutja amb el mateix `code`
  - `codeSchema.safeParse('12345').success === false`, `'123456'` → true, `'12a456'` → false
  - `useSession`: estat inicial `loading`; després de `getSession()` sense sessió → `signedOut`; un event `SIGNED_IN` → `signedIn` amb `userId`
- [ ] **Step 2:** `npm test -- features/auth` → FAIL.
- [ ] **Step 3:** Instal·lar `@tanstack/react-query`, `react-hook-form`, `zod`, `@hookform/resolvers`; implementar les funcions; `useSession` amb `getSession()` + `onAuthStateChange`.
- [ ] **Step 4:** `npm test && npm run typecheck && npm run lint` → PASS. Manual: `supabase db reset`, enviar codi a qualsevol adreça i veure'l a Mailpit (http://127.0.0.1:54324).
- [ ] **Step 5:** Commit `feat(auth): add email code sign-in and session hook`.

### Task 3 (US-101-T1): Pantalles de login i codi

**Files:**

- Create: `app/src/app/(auth)/_layout.tsx`, `app/src/app/(auth)/login.tsx`, `app/src/app/(auth)/code.tsx`
- Create: `app/src/features/auth/screens/login-screen.tsx`, `app/src/features/auth/screens/code-screen.tsx`, `app/src/features/auth/lib/auth-error.ts`
- Test: `app/src/features/auth/__tests__/screens.test.tsx`

**Interfaces:**

- Consumes: Task 2.
- Produces: `authErrorKey(error: unknown): TranslationKey` (mapa de codis de Supabase → claus i18n, `auth.errors.generic` per defecte); ruta `/code?email=…`.

- [ ] **Step 1: Tests que fallen:**
  - Login: email invàlid → missatge `auth.errors.invalidEmail` i no crida `sendEmailCode`; vàlid → crida i navega a `/code` amb el paràmetre `email`
  - Code: 6 dígits → crida `verifyEmailCode`; error `otp_expired` → mostra `auth.errors.codeExpired` i el botó **Reenviar codi** crida `sendEmailCode` un altre cop; botó desactivat 30 s després de reenviar
  - `authErrorKey({ code: 'otp_expired' })` → `'auth.errors.codeExpired'`; `{ code: 'over_email_send_rate_limit' }` → `'auth.errors.tooManyEmails'`; qualsevol altra cosa → `'auth.errors.generic'`
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Pantalles amb `Screen`, `Input`, `Button` i `react-hook-form` + `zodResolver`; input del codi amb `keyboardType="number-pad"` i `textContentType="oneTimeCode"`.
- [ ] **Step 4:** Tests + typecheck + lint → PASS.
- [ ] **Step 5:** Commit `feat(auth): add login and code screens`.

### Task 4 (US-101-T5): Guard de rutes

**Files:**

- Create: `app/src/features/auth/lib/route-state.ts`
- Create: `app/src/features/profile/api/my-profile.ts`, `app/src/features/profile/index.ts`
- Modify: `app/src/app/_layout.tsx`
- Create: `app/src/app/(onboarding)/_layout.tsx` + pantalles provisionals `age.tsx`, `profile.tsx` (EmptyState; es completen a Tasks 6 i 8)
- Test: `app/src/features/auth/__tests__/route-state.test.ts`, modificar `app/src/__tests__/navigation.test.tsx`

**Interfaces:**

- Consumes: `useSession` (Task 2), `profiles` (Task 1).
- Produces:
  - `type SessionStatus = 'loading' | 'signedIn' | 'signedOut'` (exportat per `use-session.ts`)
  - `type RouteState = 'loading' | 'signedOut' | 'needsAge' | 'needsProfile' | 'ready'`
  - `routeState(session: SessionStatus, profile: MyProfile | null | undefined): RouteState`
  - `useMyProfile(): UseQueryResult<MyProfile | null>` amb `queryKey: ['profile','me']`
  - `type MyProfile = Database['public']['Tables']['profiles']['Row']`

- [ ] **Step 1: Tests que fallen:**
  - `routeState('loading', undefined)` → `'loading'`; `('signedOut', null)` → `'signedOut'`
  - signedIn + perfil sense `birthdate` → `'needsAge'`; amb `birthdate` però `onboarded_at` null → `'needsProfile'`; amb `onboarded_at` → `'ready'`
  - signedIn + perfil encara carregant (`undefined`) → `'loading'`
  - navegació: sense sessió, `/` redirigeix a `/login`; amb sessió i `needsAge`, `/map` redirigeix a `/age` (Review Focus 4)
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** `_layout.tsx`: `QueryProvider` + `Stack` amb `Stack.Protected guard={state === 'signedOut'}` per a `(auth)`, `guard={state === 'needsAge' || state === 'needsProfile'}` per a `(onboarding)`, `guard={state === 'ready'}` per a `(tabs)`; splash fins que `state !== 'loading'` (`expo-splash-screen` `preventAutoHideAsync`/`hideAsync`).
- [ ] **Step 4:** Tests + typecheck + lint → PASS; `npx expo export --platform ios --platform android` compila.
- [ ] **Step 5:** Commit `feat(auth): guard routes by session and onboarding state`.
- [ ] **Step 6:** PR `feature/us-101…` → `main` (merge commit, `Refs #<US-101>`: queden T3 i T4).

---

## Fase C · `feature/us-102-verificacio-d-edat`

### Task 5 (US-102-T2): Edat validada al servidor

**Files:**

- Create: `supabase/migrations/<ts>_onboarding.sql`
- Create: `supabase/tests/database/020_onboarding.test.sql`

**Interfaces:**

- Produces:
  - taula `public.legal_drinking_age(country char(2) primary key, min_age smallint)` amb `('US', 21)`; lectura per a `authenticated`
  - `public.min_drinking_age(country char(2)) returns smallint` (18 si no hi ha fila)
  - `public.set_birthdate(birthdate date, country char(2)) returns void` — error `P0001` amb missatge `underage` si no arriba a l'edat; desa ambdós camps
  - `public.complete_profile(username text, display_name text) returns void` — exigeix `birthdate` ja fixada; errors `invalid_username`, `username_taken`, `invalid_display_name`; marca `onboarded_at = now()`
  - trigger que impedeix canviar `birthdate`/`country` si `onboarded_at is not null`

- [ ] **Step 1: Test que falla** (data de referència `current_date`):
  - ES, `current_date - interval '18 years'` → ok (Review Focus 2); `… + 1 day` → `throws_ok('P0001', 'underage')`
  - US, 20 anys → `underage`; 21 anys → ok
  - país `'es'` (minúscules) → es desa `'ES'`; `'XX1'` → error
  - `complete_profile` sense `birthdate` → error `birthdate_required`
  - `complete_profile('Biel', 'Biel')` → error `invalid_username`; `'biel'` ja agafat per un altre → `username_taken`
  - després de `onboarded_at`: `set_birthdate(...)` → error `already_onboarded`
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Migració: funcions `security definer`, `set search_path = ''`, `grant execute … to authenticated`; `username_taken` capturant `unique_violation`.
- [ ] **Step 4:** `db:reset`, `db:test`, `db:lint` → PASS; `db:types`.
- [ ] **Step 5:** Commit `feat(db): validate legal drinking age on the server`.

### Task 6 (US-102-T1): Pantalla d'edat i país

**Files:**

- Create: `app/src/features/profile/screens/age-screen.tsx`, `app/src/features/profile/lib/age.ts`, `app/src/features/profile/lib/countries.ts`
- Modify: `app/src/app/(onboarding)/age.tsx`
- Test: `app/src/features/profile/__tests__/age.test.ts`, `…/age-screen.test.tsx`

**Interfaces:**

- Consumes: `set_birthdate` (Task 5), `useMyProfile` (Task 4).
- Produces: `minDrinkingAge(country: string): number`, `isOldEnough(birthdate: Date, country: string, today?: Date): boolean` (mirall del servidor, només per donar feedback immediat), `COUNTRIES: { code: string; name: Record<Language, string> }[]` (Europa + EUA, ordenats per nom), `useSetBirthdate()` (mutation que invalida `['profile','me']`).

- [ ] **Step 1: Tests que fallen:** `isOldEnough(new Date('2008-11-13'), 'ES', new Date('2026-11-13'))` → true; `('2008-11-14', 'ES', …)` → false; `('2006-01-01','US', '2026-11-13')` → false; pantalla: menor → missatge `onboarding.age.underage` i botó desactivat; error `underage` del servidor → mateix missatge.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Selector de data amb `@react-native-community/datetimepicker` (`npx expo install`), país preseleccionat amb `getLocales()[0].regionCode`; avís de consum responsable (spec US-1404 es reaprofita aquí com a text).
- [ ] **Step 4:** Tests + typecheck + lint → PASS.
- [ ] **Step 5:** Commit `feat(profile): add age and country onboarding step`.
- [ ] **Step 6:** PR `feature/us-102…` → `main` (`Closes #<US-102>`).

---

## Fase D · `feature/us-103-crear-i-editar-el-meu-perfil` (part 2, des de `main`)

### Task 7 (US-103-T3): Avatars a Storage

**Files:**

- Create: `supabase/migrations/<ts>_avatars.sql`, `supabase/tests/database/030_avatars.test.sql`
- Create: `app/src/features/profile/api/avatar.ts`
- Test: `app/src/features/profile/__tests__/avatar.test.ts`

**Interfaces:**

- Produces: bucket `avatars` (públic, límit 1 MB, `image/jpeg`); `pickAndUploadAvatar(userId: string, source: 'camera' | 'library'): Promise<string | null>` (retorna `avatar_path` o null si cancel·la); `avatarUrl(path: string | null): string | null`.

- [ ] **Step 1: Tests que fallen:** pgTAP: A pot inserir a `avatars/<A>/x.jpg`, no a `avatars/<B>/x.jpg`; anònim pot llegir. Jest: `pickAndUploadAvatar` crida `manipulateAsync` amb `resize { width: 512, height: 512 }` i `compress: 0.7`, puja a `<userId>/<uuid>.jpg`, i esborra l'avatar anterior; cancel·lar → `null` sense pujar.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Migració (bucket + policies a `storage.objects` amb `(storage.foldername(name))[1] = auth.uid()::text`); `npx expo install expo-image-picker expo-image-manipulator expo-crypto`; permisos de càmera i fotos a `app.json` (plugins amb textos).
- [ ] **Step 4:** `db:test`, Jest, typecheck, lint → PASS.
- [ ] **Step 5:** Commit `feat(profile): upload compressed avatars to storage`.

### Task 8 (US-103-T2): Pas de perfil de l'onboarding

**Files:**

- Create: `app/src/features/profile/components/username-field.tsx`, `app/src/features/profile/lib/validation.ts`, `app/src/features/profile/screens/profile-setup-screen.tsx`
- Modify: `app/src/app/(onboarding)/profile.tsx`
- Test: `app/src/features/profile/__tests__/validation.test.ts`, `…/username-field.test.tsx`, `…/profile-setup-screen.test.tsx`

**Interfaces:**

- Consumes: `username_available`, `complete_profile`, `pickAndUploadAvatar`.
- Produces: `usernameSchema`, `displayNameSchema`, `bioSchema` (zod, mateixes regles que la BD); `normalizeUsername(input: string): string` (trim + minúscules); `useCompleteProfile()`.

- [ ] **Step 1: Tests que fallen:**
  - `normalizeUsername('  Biel ')` → `'biel'`; `usernameSchema` rebutja `'pèl'`, `'.biel'`, `'ab'` i accepta `'biel_04'` (Review Focus 1)
  - `UsernameField`: escriure `biel` crida `username_available` **un sol cop** 400 ms després de l'última tecla; mostra ✓ o "ja està agafat"
  - setup: error `username_taken` en enviar → missatge `onboarding.profile.usernameTaken` al camp (Review Focus 5); èxit → invalida `['profile','me']` (el guard porta a `(tabs)`)
  - `display_name` es pre-omple amb el del perfil (Apple/Google)
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implementar amb `react-hook-form`; l'avatar és opcional.
- [ ] **Step 4:** Tests + typecheck + lint → PASS.
- [ ] **Step 5:** Commit `feat(profile): add profile onboarding step with live username check`.

### Task 9 (US-103-T4): El meu perfil, edició i logout

**Files:**

- Create: `app/src/features/profile/screens/my-profile-screen.tsx`, `…/edit-profile-screen.tsx`, `app/src/features/profile/api/update-profile.ts`
- Modify: `app/src/app/(tabs)/profile.tsx`; Create: `app/src/app/profile-edit.tsx` (presentació modal)
- Test: `app/src/features/profile/__tests__/edit-profile-screen.test.tsx`

**Interfaces:**

- Consumes: `useMyProfile`, `pickAndUploadAvatar`, `signOut`.
- Produces: `useUpdateProfile()` amb `UpdateProfileInput = Pick<MyProfile, 'display_name' | 'bio' | 'avatar_path' | 'is_private'>`.

- [ ] **Step 1: Tests que fallen:** la pestanya Perfil mostra avatar (o inicials), nom, `@username`, bio; editar bio de 161 caràcters → error `profile.errors.bioTooLong`; desar crida `update` només amb els camps editables; interruptor "Perfil privat" desa `is_private`; a la pantalla d'edició, **Tancar sessió** demana confirmació i crida `signOut`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implementar; username, data i país es mostren però no s'editen (text explicatiu).
- [ ] **Step 4:** Tests + typecheck + lint → PASS.
- [ ] **Step 5:** Commit `feat(profile): add my profile and edit screens with sign out`.
- [ ] **Step 6:** PR `feature/us-103…` → `main` (`Closes #<US-103>`).

---

## Fase E · `feature/us-101-registre-i-login` (part 2, des de `main`)

### Task 10 (US-101-T4): Google Sign-In

**Files:**

- Create: `app/src/features/auth/api/google.ts`, `app/src/features/auth/components/social-buttons.tsx`
- Modify: `app/app.json` (plugin `@react-native-google-signin/google-signin` amb `iosUrlScheme`), `app/src/features/auth/screens/login-screen.tsx`, `app/.env.example`
- Test: `app/src/features/auth/__tests__/google.test.ts`

**Interfaces:**

- Produces: `isGoogleConfigured(): boolean` (true si hi ha `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` i, a iOS, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`); `signInWithGoogle(): Promise<'ok' | 'cancelled'>`.

- [ ] **Step 1: Tests que fallen:** sense variables → `isGoogleConfigured()` false i el botó no es renderitza; amb mock de `GoogleSignin.signIn` retornant `{ type: 'success', data: { idToken: 't' } }` → crida `signInWithIdToken({ provider: 'google', token: 't' })`; `{ type: 'cancelled' }` → retorna `'cancelled'` sense error.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** `npm install --save-exact @react-native-google-signin/google-signin@17`; `GoogleSignin.configure({ webClientId, iosClientId })` un cop.
- [ ] **Step 4:** Tests + typecheck + lint → PASS; `npx expo-doctor` net.
- [ ] **Step 5:** Commit `feat(auth): add native Google sign-in`.
- [ ] **Step 6 (quan hi hagi Google Cloud):** crear clients OAuth (web, iOS, Android amb SHA-1 d'EAS), proveïdor Google a Supabase dev/prod, variables a EAS; build `development` i provar en un mòbil real.

### Task 11 (US-101-T3): Sign in with Apple

**Files:**

- Create: `app/src/features/auth/api/apple.ts`
- Modify: `app/app.json` (`ios.usesAppleSignIn: true`, plugin `expo-apple-authentication`), `social-buttons.tsx`
- Test: `app/src/features/auth/__tests__/apple.test.ts`

**Interfaces:**

- Produces: `isAppleAvailable(): Promise<boolean>` (només iOS + `AppleAuthentication.isAvailableAsync()` + `EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED === 'true'`); `signInWithApple(): Promise<'ok' | 'cancelled'>`.

- [ ] **Step 1: Tests que fallen:** a Android → false; a iOS sense la variable → false; credencial amb `identityToken: 't'` i `fullName { givenName: 'Anna', familyName: 'Puig' }` → `signInWithIdToken({ provider: 'apple', token: 't', nonce })` i `updateUser({ data: { full_name: 'Anna Puig' } })`; `ERR_REQUEST_CANCELED` → `'cancelled'`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** `npx expo install expo-apple-authentication expo-crypto`; nonce aleatori, es passa el hash SHA-256 a Apple i el nonce en clar a Supabase; botó oficial `AppleAuthenticationButton`.
- [ ] **Step 4:** Tests + typecheck + lint → PASS.
- [ ] **Step 5:** Commit `feat(auth): add Sign in with Apple`.
- [ ] **Step 6 (quan hi hagi Apple Developer):** Service ID + clau a Supabase, `EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED=true` a EAS, build i prova en iPhone.
- [ ] **Step 7:** PR `feature/us-101…` → `main` (`Closes #<US-101>` només quan els Steps 6 de Tasks 10 i 11 estiguin fets; si no, `Refs`).

---

## Pendent fora de codi

- **SMTP propi:** quan hi hagi domini → Resend (DNS SPF/DKIM) → Supabase dev/prod _Auth → SMTP_. Fins llavors, el projecte dev només envia als membres de l'equip.
- **Plantilla de correu al núvol:** `supabase config push` o copiar-la al dashboard un cop provada en local.
