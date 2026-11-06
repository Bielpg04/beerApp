import { ActivityIndicator, Pressable, StyleSheet, type PressableProps } from 'react-native';

import { useTheme } from '@/shared/theme';

import { Text } from './text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends Omit<PressableProps, 'children'> {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
}

export function Button({
  title,
  variant = 'primary',
  loading = false,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const { colors, radius, spacing } = useTheme();
  const isDisabled = disabled || loading;

  const background = {
    primary: colors.primary,
    secondary: colors.surfaceAlt,
    ghost: 'transparent',
    danger: colors.danger,
  }[variant];
  const foreground = {
    primary: colors.onPrimary,
    secondary: colors.text,
    ghost: colors.primary,
    danger: colors.onDanger,
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={(state) => [
        styles.base,
        {
          backgroundColor: state.pressed && variant === 'primary' ? colors.primaryPressed : background,
          borderRadius: radius.md,
          paddingHorizontal: spacing.lg,
          opacity: isDisabled ? 0.5 : state.pressed ? 0.85 : 1,
        },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <Text variant="label" style={{ color: foreground }}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
});
