import { useTranslation } from '@/shared/i18n';
import { Button, EmptyState, Screen, Text } from '@/shared/ui';

import { useFriends } from '../api/friends';
import { PersonRow } from '../components/person-row';

/** My friends. */
export function FriendsScreen() {
  const { t } = useTranslation();
  const friends = useFriends();

  return (
    <Screen scroll>
      {friends.isError ? (
        <Button title={t('common.retry')} variant="secondary" onPress={() => void friends.refetch()} />
      ) : friends.data?.length === 0 ? (
        <EmptyState emoji="🍻" title={t('social.friends.empty')} message={t('social.friends.emptyHint')} />
      ) : (
        friends.data?.map((person) => <PersonRow key={person.id} person={person} />)
      )}
      {friends.isPending ? <Text muted>{t('common.loading')}</Text> : null}
    </Screen>
  );
}
