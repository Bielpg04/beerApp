import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/shared/theme';

import { Text } from './text';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, style, ...props }: InputProps) {
  const { colors, radius, spacing, typography } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      {label ? <Text variant="label">{label}</Text> : null}
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        style={[
          styles.input,
          typography.body,
          {
            color: colors.text,
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : colors.border,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
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

const styles = StyleSheet.create({
  input: { minHeight: 48, borderWidth: StyleSheet.hairlineWidth * 2 },
});
