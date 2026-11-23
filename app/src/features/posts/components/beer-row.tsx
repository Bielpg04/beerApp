import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';

import type { BeerSummary } from '@/features/beers';
import { useTheme } from '@/shared/theme';
import { Text } from '@/shared/ui';

export function BeerRow({ beer, onPress }: { beer: BeerSummary; onPress?: () => void }) {
  const { colors, radius, spacing } = useTheme();
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56 }}>
      {beer.imageThumbUrl ? (
        <Image
          source={beer.imageThumbUrl}
          contentFit="contain"
          style={{ width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.surface }}
        />
      ) : (
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.sm,
            backgroundColor: colors.surfaceAlt,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text>🍺</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text variant="label" numberOfLines={2}>
          {beer.name}
        </Text>
        <Text variant="caption" muted numberOfLines={1}>
          {beer.brand}
        </Text>
      </View>
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${beer.name}, ${beer.brand}`}
      onPress={onPress}
    >
      {content}
    </Pressable>
  );
}
