import { ActivityIndicator, Pressable, type PressableProps } from 'react-native';

import { useTheme } from '@/shared/theme';

import { Text } from './text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends Omit<PressableProps, 'children'> {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
}

/** A pill, like a tap handle. One `primary` per view. */
export function Button({
  title,
  variant = 'primary',
  loading = false,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const { colors, radius, spacing, sizes, opacity } = useTheme();
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
    ghost: colors.primaryText,
    danger: colors.onDanger,
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={(state) => [
        {
          minHeight: sizes.controlMinHeight,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: state.pressed && variant === 'primary' ? colors.primaryPressed : background,
          borderRadius: radius.full,
          paddingHorizontal: spacing.xl,
          opacity: isDisabled ? opacity.disabled : state.pressed ? opacity.pressed : 1,
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
