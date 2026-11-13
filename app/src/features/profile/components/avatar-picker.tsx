import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { useTranslation } from '@/shared/i18n';
import { Avatar, Button, Sheet, Text } from '@/shared/ui';

import { AvatarPermissionError, avatarUrl, pickAndUploadAvatar, type AvatarSource } from '../api/avatar';

export interface AvatarPickerProps {
  userId: string;
  name: string;
  path: string | null;
  onChange: (path: string) => void;
}

/** Tappable avatar that lets the user take or choose a photo; uploads it right away. */
export function AvatarPicker({ userId, name, path, onChange }: AvatarPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choose = async (source: AvatarSource) => {
    setOpen(false);
    setError(null);
    setBusy(true);
    try {
      const newPath = await pickAndUploadAvatar(userId, source, path);
      if (newPath) onChange(newPath);
    } catch (e) {
      setError(
        e instanceof AvatarPermissionError
          ? t('onboarding.profile.permissionDenied')
          : t('auth.errors.generic'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('onboarding.profile.avatar')}
        accessibilityState={{ busy }}
        onPress={() => setOpen(true)}
        disabled={busy}
      >
        <Avatar name={name || '?'} uri={avatarUrl(path)} size={96} />
      </Pressable>
      <Text variant="caption" muted>
        {busy ? t('common.loading') : t('onboarding.profile.avatar')}
      </Text>
      {error ? (
        <Text variant="caption" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <Sheet visible={open} onClose={() => setOpen(false)} title={t('onboarding.profile.avatar')}>
        <Button
          title={t('onboarding.profile.takePhoto')}
          variant="secondary"
          onPress={() => void choose('camera')}
        />
        <Button
          title={t('onboarding.profile.chooseFromLibrary')}
          variant="secondary"
          onPress={() => void choose('library')}
        />
      </Sheet>
    </View>
  );
}
