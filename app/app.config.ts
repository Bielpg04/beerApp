import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Extends app.json with plugins that need values only known per environment.
 * Google Sign-In's iOS plugin requires the reversed iOS client id (URL scheme); until a
 * Google Cloud project exists, the plugin is left out so builds keep working.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const googleIosUrlScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME;
  return {
    ...config,
    name: config.name ?? 'BeerApp',
    slug: config.slug ?? 'beerapp',
    plugins: [
      ...(config.plugins ?? []),
      ...(googleIosUrlScheme
        ? [
            ['@react-native-google-signin/google-signin', { iosUrlScheme: googleIosUrlScheme }] as [
              string,
              object,
            ],
          ]
        : []),
    ],
  };
};
