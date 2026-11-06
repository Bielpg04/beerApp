# Features

Cada funcionalitat viu a la seva carpeta i exposa una API pública a `index.ts`:

```
features/<feature>/
├─ api/          crides a Supabase (queries i mutations de TanStack Query)
├─ components/   components específics de la feature
├─ hooks/
├─ screens/      pantalles (les rutes de src/app/ només les importen)
├─ types.ts
└─ index.ts      API pública: l'únic punt d'entrada des de fora
```

Regles (ESLint les comprova):

- Des de fora d'una feature, importa només `@/features/<feature>`, mai fitxers interns.
- Dins d'una feature, importa amb rutes relatives curtes (`./`, `../api/...`).
- `src/app/` (rutes) ha de ser prim: només composa pantalles de `features/`.
- El codi compartit va a `src/shared/` (`ui`, `lib`, `theme`, `i18n`, `storage`).

Features previstes: `auth`, `profile`, `beers`, `venues`, `posts`, `verification`, `social`,
`feed`, `tags`, `search`, `stats`, `achievements`, `notifications`, `moderation`.
