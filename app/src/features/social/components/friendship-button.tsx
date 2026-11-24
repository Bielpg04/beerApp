import { useState } from 'react';
import { View } from 'react-native';

import { useTranslation } from '@/shared/i18n';
import { useTheme } from '@/shared/theme';
import { Button, Sheet, Text } from '@/shared/ui';

import { useFriendshipActions } from '../api/friendships';
import type { Relationship } from '../types';

export interface FriendshipButtonProps {
  userId: string;
  username: string;
  relationship: Relationship;
}

/** Add · request sent (cancel) · accept/decline · friends (remove, after confirming). */
export function FriendshipButton({ userId, username, relationship }: FriendshipButtonProps) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const { send, accept, decline, remove } = useFriendshipActions();
  const [confirming, setConfirming] = useState(false);
  const failed = [send, accept, decline, remove].some((m) => m.isError);
  const busy = [send, accept, decline, remove].some((m) => m.isPending);

  if (relationship === 'self' || relationship === 'blocked') return null;

  return (
    <View style={{ gap: spacing.sm }}>
      {relationship === 'none' ? (
        <Button title={t('social.friendship.add')} loading={busy} onPress={() => send.mutate(userId)} />
      ) : null}

      {relationship === 'outgoing' ? (
        <>
          <Text muted style={{ textAlign: 'center' }}>
            {t('social.friendship.sent')}
          </Text>
          <Button
            title={t('social.friendship.cancel')}
            variant="secondary"
            loading={busy}
            onPress={() => remove.mutate(userId)}
          />
        </>
      ) : null}

      {relationship === 'incoming' ? (
        <>
          <Text style={{ textAlign: 'center' }}>{t('social.friendship.received', { username })}</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Button
                title={t('social.friendship.accept')}
                disabled={busy}
                onPress={() => accept.mutate(userId)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title={t('social.friendship.decline')}
                variant="secondary"
                disabled={busy}
                onPress={() => decline.mutate(userId)}
              />
            </View>
          </View>
        </>
      ) : null}

      {relationship === 'friends' ? (
        <>
          <Text variant="label" style={{ textAlign: 'center' }}>
            {t('social.friendship.friends')}
          </Text>
          <Button title={t('social.friendship.remove')} variant="ghost" onPress={() => setConfirming(true)} />
          <Sheet
            visible={confirming}
            onClose={() => setConfirming(false)}
            title={t('social.friendship.removeConfirm', { username })}
          >
            <Text muted>{t('social.friendship.removeHint')}</Text>
            <Button
              title={t('social.friendship.removeYes')}
              variant="danger"
              loading={remove.isPending}
              onPress={() => remove.mutate(userId, { onSettled: () => setConfirming(false) })}
            />
            <Button title={t('common.cancel')} variant="secondary" onPress={() => setConfirming(false)} />
          </Sheet>
        </>
      ) : null}

      {failed ? (
        <Text accessibilityRole="alert" style={{ textAlign: 'center' }}>
          {t('social.friendship.error')}
        </Text>
      ) : null}
    </View>
  );
}
