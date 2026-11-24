import Constants from 'expo-constants';
import { openBrowserAsync } from 'expo-web-browser';
import { View } from 'react-native';

import { useTranslation } from '@/shared/i18n';
import { useTheme } from '@/shared/theme';
import { Card, Screen, Text } from '@/shared/ui';

const SOURCES = [
  { name: 'Open Food Facts', url: 'https://world.openfoodfacts.org', licenceKey: 'about.offLicence' },
  { name: 'Open Brewery DB', url: 'https://www.openbrewerydb.org', licenceKey: 'about.obdbLicence' },
] as const;

export function AboutScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const version = Constants.expoConfig?.version ?? '—';

  return (
    <Screen scroll>
      <Text variant="title" accessibilityRole="header">
        {t('about.title')}
      </Text>
      <Text muted>{t('about.version', { version })}</Text>

      <Text variant="subtitle" accessibilityRole="header">
        {t('about.dataTitle')}
      </Text>
      {SOURCES.map((source) => (
        <Card key={source.name}>
          <View style={{ gap: 4 }}>
            <Text
              accessibilityRole="link"
              accessibilityLabel={source.name}
              onPress={() => void openBrowserAsync(source.url)}
              style={{ color: colors.primary, fontWeight: '600' }}
            >
              {source.name}
            </Text>
            <Text muted>{t(source.licenceKey)}</Text>
          </View>
        </Card>
      ))}
    </Screen>
  );
}
