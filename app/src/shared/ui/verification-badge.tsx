import { View } from 'react-native';

import { useTranslation } from '@/shared/i18n';
import { useTheme } from '@/shared/theme';

import { Text } from './text';

export type VerificationLevel = 'verified' | 'partial' | 'unverified';

export interface VerificationBadgeProps {
  level: VerificationLevel;
  /** Defaults to the translated `verification.<level>`. */
  label?: string;
}

const GLYPH = 12;

/**
 * How sure we are that the beer was really drunk.
 * Shape + word + colour, so the level reads without colour vision:
 * filled circle (verified), half-filled (partial), empty ring (unverified).
 */
export function VerificationBadge({ level, label }: VerificationBadgeProps) {
  const { colors, radius, spacing } = useTheme();
  const { t } = useTranslation();
  const color = colors[level];
  const text = label ?? t(`verification.${level}`);

  return (
    <View
      accessible
      accessibilityLabel={text}
      testID={`verification-${level}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: spacing.xs,
        minHeight: 24,
        paddingLeft: 6,
        paddingRight: spacing.sm,
        borderRadius: radius.full,
        backgroundColor: colors.surfaceAlt,
      }}
    >
      <View
        style={{
          width: GLYPH,
          height: GLYPH,
          borderRadius: GLYPH / 2,
          borderWidth: 2,
          borderColor: color,
          backgroundColor: level === 'verified' ? color : 'transparent',
          overflow: 'hidden',
        }}
      >
        {level === 'partial' ? (
          <View style={{ width: '50%', height: '100%', backgroundColor: color }} />
        ) : null}
      </View>
      <Text variant="caption">{text}</Text>
    </View>
  );
}
