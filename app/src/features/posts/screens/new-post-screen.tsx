import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { View } from 'react-native';

import { useTranslation } from '@/shared/i18n';
import { Button, Screen, Text } from '@/shared/ui';

import { publishPost, type PhotoStorage } from '../api/create-post';
import { BeerRow } from '../components/beer-row';
import { BeerStep } from '../components/beer-step';
import { DetailsStep } from '../components/details-step';
import { PhotoStep } from '../components/photo-step';
import { usePostDraft, type DraftStep } from '../lib/draft';

const PREVIOUS: Record<DraftStep, DraftStep | null> = { beer: null, photo: 'beer', details: 'photo' };
const TITLE = {
  beer: 'posts.new.beerTitle',
  photo: 'posts.new.photoTitle',
  details: 'posts.new.detailsTitle',
} as const;

/** Until photos can be uploaded (US-301-T3) a draft never has one. */
const noPhotoStorage: PhotoStorage = {
  upload: () => Promise.reject(new Error('photos_not_supported')),
  remove: () => Promise.resolve(),
};

export interface NewPostScreenProps {
  userId: string;
  storage?: PhotoStorage;
}

export function NewPostScreen({ userId, storage = noPhotoStorage }: NewPostScreenProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const draft = usePostDraft();
  const previous = PREVIOUS[draft.step];

  const publish = useMutation({
    mutationFn: () => publishPost(usePostDraft.getState(), userId, storage),
    onSuccess: (postId) => {
      usePostDraft.getState().reset();
      void queryClient.invalidateQueries({ queryKey: ['posts'] });
      router.push(`/post/${postId}`);
    },
  });

  return (
    <Screen scroll>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48 }}>
        {previous ? (
          <Button title={t('posts.new.back')} variant="ghost" onPress={() => draft.goTo(previous)} />
        ) : null}
      </View>
      <Text variant="title" accessibilityRole="header">
        {t(TITLE[draft.step])}
      </Text>

      {draft.step !== 'beer' && draft.beer ? <BeerRow beer={draft.beer} /> : null}

      {draft.step === 'beer' ? <BeerStep userId={userId} onPick={draft.setBeer} /> : null}
      {draft.step === 'photo' ? (
        <PhotoStep
          onSkip={() => {
            draft.setPhoto(null);
            draft.goTo('details');
          }}
        />
      ) : null}
      {draft.step === 'details' ? (
        <DetailsStep
          onPublish={() => publish.mutate()}
          publishing={publish.isPending}
          error={publish.isError ? t('posts.new.publishError') : null}
        />
      ) : null}
    </Screen>
  );
}
