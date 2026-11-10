import { View } from 'react-native';

import { useTheme } from '@/shared/theme';

import { Screen } from './screen';
import { Text } from './text';

export interface EmptyStateProps {
  emoji: string;
  title: string;
  message?: string;
}

export function EmptyState({ emoji, title, message }: EmptyStateProps) {
  const { colors, sizes } = useTheme();
  const disc = sizes.emptyStateDisc;
  return (
    <Screen style={{ alignItems: 'center', justifyContent: 'center' }}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: disc,
          height: disc,
          borderRadius: disc / 2,
          backgroundColor: colors.surfaceAlt,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: disc / 2, lineHeight: disc * 0.6 }}>{emoji}</Text>
      </View>
      <Text variant="title" accessibilityRole="header" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      {message ? (
        <Text muted style={{ textAlign: 'center' }}>
          {message}
        </Text>
      ) : null}
    </Screen>
  );
}
