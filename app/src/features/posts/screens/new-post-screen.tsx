import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useTranslation } from '@/shared/i18n';
import { Button, EmptyState, Screen, Sheet, Text } from '@/shared/ui';

import { publishPost, type PhotoStorage } from '../api/create-post';
import {
  photoFileExists,
  pickPhoto,
  PhotoPermissionError,
  removePhotos,
  uploadPhoto,
  type PhotoSource,
} from '../api/upload-photo';
import { BeerRow } from '../components/beer-row';
import { BeerStep } from '../components/beer-step';
import { DetailsStep } from '../components/details-step';
import { PhotoStep } from '../components/photo-step';
import { hasDraftContent, useDraftHydrated, usePostDraft, type DraftStep } from '../lib/draft';

const PREVIOUS: Record<DraftStep, DraftStep | null> = { beer: null, photo: 'beer', details: 'photo' };
const TITLE = {
  beer: 'posts.new.beerTitle',
  photo: 'posts.new.photoTitle',
  details: 'posts.new.detailsTitle',
} as const;

const photoStorage: PhotoStorage = { upload: uploadPhoto, remove: removePhotos };

export interface NewPostScreenProps {
  userId: string;
  storage?: PhotoStorage;
}

export function NewPostScreen({ userId, storage = photoStorage }: NewPostScreenProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const draft = usePostDraft();
  const previous = PREVIOUS[draft.step];
  const [picking, setPicking] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoGone, setPhotoGone] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const hydrated = useDraftHydrated();
  const photoUri = draft.photo?.uri ?? null;

  // A restored draft may point to a cached file the system has already cleaned up.
  useEffect(() => {
    if (!photoUri) return;
    let active = true;
    void photoFileExists(photoUri).then((exists) => {
      if (active && !exists && usePostDraft.getState().photo?.uri === photoUri) {
        usePostDraft.getState().setPhoto(null);
        setPhotoGone(true);
      }
    });
    return () => {
      active = false;
    };
  }, [photoUri]);

  const pick = async (source: PhotoSource) => {
    setPhotoError(null);
    setPhotoGone(false);
    setPicking(true);
    try {
      const picked = await pickPhoto(source);
      if (picked) draft.setPhoto(picked);
    } catch (e) {
      setPhotoError(
        e instanceof PhotoPermissionError ? t('posts.new.photoPermission') : t('auth.errors.generic'),
      );
    } finally {
      setPicking(false);
    }
  };

  const publish = useMutation({
    mutationFn: () => publishPost(usePostDraft.getState(), userId, storage),
    onSuccess: (postId) => {
      usePostDraft.getState().reset();
      void queryClient.invalidateQueries({ queryKey: ['posts'] });
      router.push(`/post/${postId}`);
    },
  });

  if (!hydrated) return <EmptyState emoji="🍺" title={t('common.loading')} />;

  return (
    <Screen scroll>
      <View
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 }}
      >
        {previous ? (
          <Button title={t('posts.new.back')} variant="ghost" onPress={() => draft.goTo(previous)} />
        ) : (
          <View />
        )}
        {hasDraftContent(draft) ? (
          <Button title={t('posts.new.discard')} variant="ghost" onPress={() => setConfirmDiscard(true)} />
        ) : null}
      </View>
      <Text variant="title" accessibilityRole="header">
        {t(TITLE[draft.step])}
      </Text>

      {draft.step !== 'beer' && draft.beer ? <BeerRow beer={draft.beer} /> : null}

      {draft.step === 'beer' ? <BeerStep userId={userId} onPick={draft.setBeer} /> : null}
      {photoGone ? <Text accessibilityRole="alert">{t('posts.new.photoGone')}</Text> : null}

      {draft.step === 'photo' ? (
        <PhotoStep
          photo={draft.photo}
          busy={picking}
          error={photoError}
          onPick={(source) => void pick(source)}
          onRemove={() => draft.setPhoto(null)}
          onContinue={() => draft.goTo('details')}
        />
      ) : null}
      {draft.step === 'details' ? (
        <DetailsStep
          onPublish={() => publish.mutate()}
          publishing={publish.isPending}
          error={publish.isError ? t('posts.new.publishError') : null}
        />
      ) : null}

      <Sheet
        visible={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        title={t('posts.new.discardConfirm')}
      >
        <Button
          title={t('posts.new.discardConfirmYes')}
          variant="danger"
          onPress={() => {
            setConfirmDiscard(false);
            setPhotoGone(false);
            draft.reset();
          }}
        />
        <Button title={t('common.cancel')} variant="secondary" onPress={() => setConfirmDiscard(false)} />
      </Sheet>
    </Screen>
  );
}
