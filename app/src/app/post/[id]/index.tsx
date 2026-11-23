import { router, useLocalSearchParams } from 'expo-router';

import { useSession } from '@/features/auth';
import { PostScreen } from '@/features/posts';
import { useTranslation } from '@/shared/i18n';
import { Button } from '@/shared/ui';

export default function PostRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useSession();
  const { t } = useTranslation();
  return (
    <PostScreen
      id={id}
      renderActions={(post) =>
        post.authorId === userId ? (
          <Button
            title={t('posts.edit.open')}
            variant="secondary"
            onPress={() => router.push(`/post/${post.id}/edit`)}
          />
        ) : null
      }
    />
  );
}
