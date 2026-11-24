import { useState } from 'react';

import { useTranslation } from '@/shared/i18n';
import { Button, Sheet, Text } from '@/shared/ui';

import { useDeletePost } from '../api/delete-post';
import type { Post } from '../types';

export function DeletePostButton({ post }: { post: Pick<Post, 'id' | 'photo'> }) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const remove = useDeletePost(post);

  return (
    <>
      <Button title={t('posts.delete.open')} variant="ghost" onPress={() => setConfirming(true)} />
      {remove.isError ? <Text accessibilityRole="alert">{t('posts.delete.error')}</Text> : null}
      <Sheet visible={confirming} onClose={() => setConfirming(false)} title={t('posts.delete.confirm')}>
        <Text muted>{t('posts.delete.cannotUndo')}</Text>
        <Button
          title={t('posts.delete.confirmYes')}
          variant="danger"
          loading={remove.isPending}
          onPress={() => remove.mutate(undefined, { onSettled: () => setConfirming(false) })}
        />
        <Button title={t('common.cancel')} variant="secondary" onPress={() => setConfirming(false)} />
      </Sheet>
    </>
  );
}
