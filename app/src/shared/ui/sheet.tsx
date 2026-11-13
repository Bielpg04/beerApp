import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslation } from '@/shared/i18n';
import { useTheme } from '@/shared/theme';

import { Text } from './text';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

/** Simple bottom sheet built on Modal: slides up, closes on backdrop tap or back button. */
export function Sheet({ visible, onClose, title, children }: SheetProps) {
  const { colors, radius, spacing, sizes } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          testID="sheet-backdrop"
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.backdrop }]}
          onPress={onClose}
        />
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            padding: spacing.lg,
            paddingBottom: spacing.lg + insets.bottom,
            gap: spacing.md,
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: sizes.sheetHandleWidth,
              height: sizes.sheetHandleHeight,
              borderRadius: radius.full,
              backgroundColor: colors.borderStrong,
            }}
          />
          {title ? <Text variant="subtitle">{title}</Text> : null}
          {children}
        </View>
      </View>
    </Modal>
  );
}
