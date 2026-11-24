import { useState } from 'react';

import { useTranslation } from '@/shared/i18n';
import { Button, Sheet, Text } from '@/shared/ui';

import { useBlockActions } from '../api/blocks';

export interface BlockButtonProps {
  userId: string;
  username: string;
  /** I already blocked them: offer to unblock. */
  blocked: boolean;
}

/** Block someone after explaining what it does, or unblock them. */
export function BlockButton({ userId, username, blocked }: BlockButtonProps) {
  const { t } = useTranslation();
  const { block, unblock } = useBlockActions();
  const [confirming, setConfirming] = useState(false);
  const failed = block.isError || unblock.isError;

  return (
    <>
      {blocked ? (
        <Button
          title={t('social.block.unblock')}
          variant="secondary"
          loading={unblock.isPending}
          onPress={() => unblock.mutate(userId)}
        />
      ) : (
        <Button
          title={t('social.block.open', { username })}
          variant="ghost"
          onPress={() => setConfirming(true)}
        />
      )}
      {failed ? (
        <Text accessibilityRole="alert" style={{ textAlign: 'center' }}>
          {t('social.friendship.error')}
        </Text>
      ) : null}
      <Sheet
        visible={confirming}
        onClose={() => setConfirming(false)}
        title={t('social.block.confirm', { username })}
      >
        <Text muted>{t('social.block.explain')}</Text>
        <Button
          title={t('social.block.confirmYes')}
          variant="danger"
          loading={block.isPending}
          onPress={() => block.mutate(userId, { onSettled: () => setConfirming(false) })}
        />
        <Button title={t('common.cancel')} variant="secondary" onPress={() => setConfirming(false)} />
      </Sheet>
    </>
  );
}
