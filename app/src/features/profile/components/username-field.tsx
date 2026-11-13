import { useTranslation } from '@/shared/i18n';
import { useTheme } from '@/shared/theme';
import { Input, Text } from '@/shared/ui';

import { useUsernameStatus } from '../api/username';
import { normalizeUsername } from '../lib/validation';

export interface UsernameFieldProps {
  value: string;
  onChangeText: (value: string) => void;
  /** Error from submitting (e.g. taken meanwhile); overrides the live status. */
  error?: string;
}

export function UsernameField({ value, onChangeText, error }: UsernameFieldProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const status = useUsernameStatus(value);

  const hint =
    status === 'invalid'
      ? { text: t('onboarding.profile.usernameRules'), color: colors.textMuted }
      : status === 'checking'
        ? { text: t('onboarding.profile.usernameChecking'), color: colors.textMuted }
        : status === 'available'
          ? { text: t('onboarding.profile.usernameAvailable'), color: colors.verified }
          : status === 'taken'
            ? { text: t('onboarding.profile.usernameTaken'), color: colors.danger }
            : null;

  return (
    <>
      <Input
        label={t('onboarding.profile.username')}
        placeholder={t('onboarding.profile.usernamePlaceholder')}
        value={value}
        onChangeText={(text) => onChangeText(normalizeUsername(text).replace(/\s/g, ''))}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username-new"
        maxLength={20}
        error={error}
      />
      {!error && hint ? (
        <Text variant="caption" style={{ color: hint.color }} accessibilityLiveRegion="polite">
          {hint.text}
        </Text>
      ) : null}
    </>
  );
}
