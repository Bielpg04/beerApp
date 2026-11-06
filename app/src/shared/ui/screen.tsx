import { ScrollView, View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/shared/theme';

export interface ScreenProps extends ViewProps {
  scroll?: boolean;
}

/** Root container for screens: safe area, themed background and standard padding. */
export function Screen({ scroll = false, style, children, ...props }: ScreenProps) {
  const { colors, spacing } = useTheme();
  const content = { padding: spacing.lg, gap: spacing.lg };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView contentContainerStyle={[content, style]}>{children}</ScrollView>
      ) : (
        <View style={[{ flex: 1 }, content, style]} {...props}>
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}
