import { useState } from 'react';
import { View } from 'react-native';

import { useTranslation } from '@/shared/i18n';
import { useTheme } from '@/shared/theme';
import { Button, Card, EmptyState, Screen, Text } from '@/shared/ui';

import { useFriendshipActions } from '../api/friendships';
import { useFriendRequests } from '../api/requests';
import { PersonRow } from '../components/person-row';
import type { Person } from '../types';

/** The friend requests I received: accept or decline each. */
export function FriendRequestsScreen() {
  const { t } = useTranslation();
  const requests = useFriendRequests();
  const [notice, setNotice] = useState<string | null>(null);

  if (requests.isError) {
    return (
      <EmptyState emoji="📡" title={t('common.connectionError')} message={t('common.connectionErrorHint')}>
        <Button title={t('common.retry')} onPress={() => void requests.refetch()} />
      </EmptyState>
    );
  }
  if (requests.isPending) return <Screen />;
  if (requests.data.length === 0 && !notice) {
    return <EmptyState emoji="📭" title={t('social.requests.empty')} />;
  }

  return (
    <Screen scroll>
      {notice ? (
        <Text accessibilityRole="alert" muted>
          {notice}
        </Text>
      ) : null}
      {requests.data.length === 0 ? <Text muted>{t('social.requests.empty')}</Text> : null}
      {requests.data.map((person) => (
        <Request key={person.id} person={person} onNotice={setNotice} />
      ))}
    </Screen>
  );
}

function Request({ person, onNotice }: { person: Person; onNotice: (message: string) => void }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const { accept, decline } = useFriendshipActions();
  const busy = accept.isPending || decline.isPending;
  const onError = (error: Error) =>
    onNotice(
      error.message === 'request_not_found' ? t('social.requests.gone') : t('social.friendship.error'),
    );

  return (
    <Card>
      <PersonRow
        person={person}
        right={
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Button
                title={t('social.friendship.accept')}
                disabled={busy}
                onPress={() => accept.mutate(person.id, { onError })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title={t('social.friendship.decline')}
                variant="secondary"
                disabled={busy}
                onPress={() => decline.mutate(person.id, { onError })}
              />
            </View>
          </View>
        }
      />
    </Card>
  );
}
