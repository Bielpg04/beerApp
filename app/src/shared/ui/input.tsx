import { useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/shared/theme';

import { Text } from './text';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, style, onFocus, onBlur, ...props }: InputProps) {
  const { colors, radius, spacing, sizes, typography } = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error ? colors.danger : focused ? colors.focus : colors.borderStrong;
  const borderWidth = focused ? sizes.focusWidth : sizes.borderWidth;

  return (
    <View style={{ gap: spacing.xs }}>
      {label ? <Text variant="label">{label}</Text> : null}
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          typography.body,
          {
            minHeight: sizes.controlMinHeight,
            color: colors.text,
            backgroundColor: colors.surface,
            borderColor,
            borderWidth,
            borderRadius: radius.md,
            // Keep the text still when the border thickens on focus.
            paddingHorizontal: spacing.md - (borderWidth - sizes.borderWidth),
          },
          style,
        ]}
        {...props}
      />
      {error ? (
        <Text variant="caption" style={{ color: colors.danger }} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
