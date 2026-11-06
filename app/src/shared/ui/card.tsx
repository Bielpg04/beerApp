import { View, type ViewProps } from 'react-native';

import { useTheme } from '@/shared/theme';

export function Card({ style, ...props }: ViewProps) {
  const { colors, radius, spacing } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.lg,
          padding: spacing.lg,
          gap: spacing.sm,
        },
        style,
      ]}
      {...props}
    />
  );
}
