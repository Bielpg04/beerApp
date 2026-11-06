// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ['dist/*', '.expo/*'],
  },
  {
    // Features are only reachable through their public index.ts.
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/*/*'],
              message: 'Importa la feature des de la seva API pública: @/features/<feature>',
            },
            {
              group: ['../*/../*', '../../*'],
              message: "Fes servir l'alias @/ en lloc de rutes relatives llargues",
            },
          ],
        },
      ],
    },
  },
]);
