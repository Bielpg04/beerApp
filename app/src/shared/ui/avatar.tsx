import { Image } from 'expo-image';
import { View } from 'react-native';

import { fonts, useTheme } from '@/shared/theme';

import { Text } from './text';

export interface AvatarProps {
  name: string;
  uri?: string | null;
  size?: number;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '?';
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

export function Avatar({ name, uri, size }: AvatarProps) {
  const { colors, sizes } = useTheme();
  const diameter = size ?? sizes.avatarDefault;
  const shape = { width: diameter, height: diameter, borderRadius: diameter / 2 };

  if (uri) {
    return <Image source={{ uri }} style={shape} accessibilityLabel={name} contentFit="cover" />;
  }
  return (
    <View
      accessibilityLabel={name}
      style={[shape, { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }]}
    >
      <Text
        style={{
          color: colors.onPrimary,
          fontFamily: fonts.displayHeavy,
          fontSize: diameter * 0.42,
          lineHeight: diameter * 0.5,
          letterSpacing: 0.5,
        }}
      >
        {initials(name)}
      </Text>
    </View>
  );
}
