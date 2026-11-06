import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { useTheme, type TypographyVariant } from '@/shared/theme';

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  muted?: boolean;
}

export function Text({ variant = 'body', muted = false, style, ...props }: TextProps) {
  const theme = useTheme();
  return (
    <RNText
      style={[
        theme.typography[variant],
        { color: muted ? theme.colors.textMuted : theme.colors.text },
        style,
      ]}
      {...props}
    />
  );
}
