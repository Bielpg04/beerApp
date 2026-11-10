import { View, type ViewProps } from 'react-native';

import { useTheme } from '@/shared/theme';

/** Surface container. No shadows: a hairline border and the screen gap separate cards. */
export function Card({ style, ...props }: ViewProps) {
  const { colors, radius, spacing, sizes } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: sizes.borderWidth,
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
