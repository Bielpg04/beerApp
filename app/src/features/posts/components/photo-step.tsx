import { Image } from 'expo-image';
import { ActivityIndicator, View } from 'react-native';

import { useTranslation } from '@/shared/i18n';
import { useTheme } from '@/shared/theme';
import { Button, Text } from '@/shared/ui';

import type { PhotoSource } from '../api/upload-photo';
import type { DraftPhoto } from '../lib/draft';

export interface PhotoStepProps {
  photo: DraftPhoto | null;
  busy: boolean;
  error: string | null;
  onPick: (source: PhotoSource) => void;
  onRemove: () => void;
  onContinue: () => void;
}

export function PhotoStep({ photo, busy, error, onPick, onRemove, onContinue }: PhotoStepProps) {
  const { t } = useTranslation();
  const { colors, radius } = useTheme();

  return (
    <View style={{ gap: 12 }}>
      {photo ? (
        <Image
          source={photo.uri}
          contentFit="cover"
          accessible
          accessibilityLabel={t('posts.new.photoPreview')}
          style={{
            aspectRatio: photo.width / photo.height,
            maxHeight: 420,
            borderRadius: radius.lg,
            backgroundColor: colors.surface,
          }}
        />
      ) : (
        <Text muted>{t('posts.new.photoHint')}</Text>
      )}
      {busy ? <ActivityIndicator accessibilityLabel={t('common.loading')} /> : null}
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}

      {photo ? (
        <>
          <Button title={t('posts.new.continue')} onPress={onContinue} disabled={busy} />
          <Button
            title={t('posts.new.takeAnother')}
            variant="secondary"
            onPress={() => onPick('camera')}
            disabled={busy}
          />
          <Button
            title={t('posts.new.chooseAnother')}
            variant="secondary"
            onPress={() => onPick('library')}
            disabled={busy}
          />
          <Button title={t('posts.new.removePhoto')} variant="ghost" onPress={onRemove} disabled={busy} />
        </>
      ) : (
        <>
          <Button title={t('posts.new.takePhoto')} onPress={() => onPick('camera')} disabled={busy} />
          <Button
            title={t('posts.new.choosePhoto')}
            variant="secondary"
            onPress={() => onPick('library')}
            disabled={busy}
          />
          <Button title={t('posts.new.noPhoto')} variant="ghost" onPress={onContinue} disabled={busy} />
        </>
      )}
    </View>
  );
}
