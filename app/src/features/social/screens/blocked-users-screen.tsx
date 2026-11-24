import { useState } from 'react';

import { useTranslation } from '@/shared/i18n';
import { Button, EmptyState, Screen, Sheet, Text } from '@/shared/ui';

import { useBlockActions, useBlockedUsers } from '../api/blocks';
import { PersonRow } from '../components/person-row';
import type { Person } from '../types';

/** The people I blocked, to unblock them. */
export function BlockedUsersScreen() {
  const { t } = useTranslation();
  const blocked = useBlockedUsers();
  const { unblock } = useBlockActions();
  const [confirming, setConfirming] = useState<Person | null>(null);

  if (blocked.isError) {
    return (
      <EmptyState emoji="📡" title={t('common.connectionError')} message={t('common.connectionErrorHint')}>
        <Button title={t('common.retry')} onPress={() => void blocked.refetch()} />
      </EmptyState>
    );
  }
  if (blocked.isPending) return <Screen />;
  if (blocked.data.length === 0) return <EmptyState emoji="🕊️" title={t('social.blocked.empty')} />;

  return (
    <Screen scroll>
      {unblock.isError ? <Text accessibilityRole="alert">{t('social.friendship.error')}</Text> : null}
      {blocked.data.map((person) => (
        <PersonRow
          key={person.id}
          person={person}
          right={
            <Button
              title={t('social.block.unblock')}
              variant="secondary"
              onPress={() => setConfirming(person)}
            />
          }
        />
      ))}
      <Sheet
        visible={confirming !== null}
        onClose={() => setConfirming(null)}
        title={t('social.blocked.unblockConfirm', { username: confirming?.username ?? '' })}
      >
        <Text muted>{t('social.blocked.unblockHint')}</Text>
        <Button
          title={t('social.blocked.unblockYes')}
          loading={unblock.isPending}
          onPress={() =>
            confirming && unblock.mutate(confirming.id, { onSettled: () => setConfirming(null) })
          }
        />
        <Button title={t('common.cancel')} variant="secondary" onPress={() => setConfirming(null)} />
      </Sheet>
    </Screen>
  );
}
