import { useState } from 'react';

import { useTranslation } from '@/shared/i18n';
import { useDebounced } from '@/shared/lib/use-debounced';
import { Button, EmptyState, Input, Screen, Text } from '@/shared/ui';

import { FIND_MIN_CHARS, normalizeQuery, useFindPeople, type FoundPerson } from '../api/find-people';
import { useFriends } from '../api/friends';
import { useFriendshipActions } from '../api/friendships';
import { PersonRow } from '../components/person-row';

const DEBOUNCE_MS = 300;

/** My friends, and a search by @username to find new ones. */
export function FriendsScreen() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, DEBOUNCE_MS);
  const searching = normalizeQuery(query).length >= FIND_MIN_CHARS;

  return (
    <Screen scroll>
      <Input
        label={t('social.find.label')}
        placeholder={t('social.find.placeholder')}
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      {searching ? <Results query={debounced} /> : <FriendsList />}
    </Screen>
  );
}

function FriendsList() {
  const { t } = useTranslation();
  const friends = useFriends();
  if (friends.isError) {
    return <Button title={t('common.retry')} variant="secondary" onPress={() => void friends.refetch()} />;
  }
  if (friends.isPending) return <Text muted>{t('common.loading')}</Text>;
  if (friends.data.length === 0) {
    return (
      <EmptyState emoji="🍻" title={t('social.friends.empty')} message={t('social.friends.emptyHint')} />
    );
  }
  return friends.data.map((person) => <PersonRow key={person.id} person={person} />);
}

function Results({ query }: { query: string }) {
  const { t } = useTranslation();
  const results = useFindPeople(query);
  if (results.isError) {
    return <Button title={t('common.retry')} variant="secondary" onPress={() => void results.refetch()} />;
  }
  if (!results.data) return <Text muted>{t('common.loading')}</Text>;
  if (results.data.length === 0) return <Text muted>{t('social.find.none')}</Text>;
  return results.data.map((person) => <Result key={person.id} person={person} />);
}

function Result({ person }: { person: FoundPerson }) {
  const { t } = useTranslation();
  const { send } = useFriendshipActions();
  const status = {
    friends: t('social.friendship.friends'),
    outgoing: t('social.friendship.sent'),
    incoming: t('social.find.incoming'),
  } as Partial<Record<FoundPerson['relationship'], string>>;

  return (
    <PersonRow
      person={person}
      right={
        person.relationship === 'none' ? (
          <Button
            title={t('social.friendship.add')}
            variant="secondary"
            loading={send.isPending}
            onPress={() => send.mutate(person.id)}
          />
        ) : status[person.relationship] ? (
          <Text variant="caption" muted>
            {status[person.relationship]}
          </Text>
        ) : null
      }
    />
  );
}
