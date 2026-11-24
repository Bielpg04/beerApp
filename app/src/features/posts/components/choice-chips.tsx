import { Pressable, View } from 'react-native';

import { useTheme } from '@/shared/theme';
import { Text } from '@/shared/ui';

export type Choice<T> = { value: T; label: string };

/** A row of single-choice chips (radio buttons). */
export function ChoiceChips<T extends string | number>({
  choices,
  value,
  onChange,
}: {
  choices: Choice<T>[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  const { colors, radius, spacing } = useTheme();
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {choices.map((choice) => {
        const selected = choice.value === value;
        return (
          <Pressable
            key={String(choice.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={choice.label}
            onPress={() => onChange(choice.value)}
            style={{
              minHeight: 44,
              justifyContent: 'center',
              paddingHorizontal: spacing.md,
              borderRadius: radius.full,
              borderWidth: 1,
              borderColor: selected ? colors.primary : colors.border,
              backgroundColor: selected ? colors.primary : colors.surface,
            }}
          >
            <Text variant="label" style={{ color: selected ? colors.onPrimary : colors.text }}>
              {choice.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
