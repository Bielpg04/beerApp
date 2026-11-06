import 'i18next';

import type ca from './locales/ca.json';

// Type-safe translation keys: t('tabs.feed') is checked against ca.json.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof ca };
  }
}
