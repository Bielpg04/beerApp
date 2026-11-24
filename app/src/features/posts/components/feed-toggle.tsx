import { Switch, View } from 'react-native';

import { useTranslation } from '@/shared/i18n';
import { useTheme } from '@/shared/theme';
import { Text } from '@/shared/ui';

import { defaultPublishToFeed } from '../lib/timing';

export interface FeedToggleProps {
  consumedAt: string | null;
  /** null = automatic: on unless the beer was drunk more than 48 h ago. */
  value: boolean | null;
  onChange: (value: boolean) => void;
}

export function FeedToggle({ consumedAt, value, onChange }: FeedToggleProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const now = new Date();
  const on = value ?? defaultPublishToFeed(consumedAt ? new Date(consumedAt) : now, now);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <View style={{ flex: 1 }}>
        <Text variant="label">{t('posts.when.feed')}</Text>
        <Text variant="caption" muted>
          {on ? t('posts.when.feedOnHint') : t('posts.when.feedOffHint')}
        </Text>
      </View>
      <Switch
        accessibilityLabel={t('posts.when.feed')}
        value={on}
        onValueChange={onChange}
        trackColor={{ true: colors.primary }}
      />
    </View>
  );
}
