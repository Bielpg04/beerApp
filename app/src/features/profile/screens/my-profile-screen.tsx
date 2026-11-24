import { router } from 'expo-router';
import type { ReactNode } from 'react';

import { useTranslation } from '@/shared/i18n';
import { Button, Screen } from '@/shared/ui';

import { useOwnProfile } from '../api/my-profile';
import { ProfileScreen } from './profile-screen';

export interface MyProfileScreenProps {
  /** Composed by the route below my own buttons (friends, requests…). */
  actions?: ReactNode;
  /** Composed by the route: my posts. */
  children?: ReactNode;
}

/** My profile: the shared profile screen plus my own buttons. */
export function MyProfileScreen({ actions, children }: MyProfileScreenProps = {}) {
  const { t } = useTranslation();
  const { data: me } = useOwnProfile();
  if (!me) return <Screen />;

  return (
    <ProfileScreen
      id={me.id}
      renderActions={() => (
        <>
          <Button
            title={t('profile.edit')}
            variant="secondary"
            onPress={() => router.push('/profile-edit')}
          />
          {actions}
          <Button title={t('about.title')} variant="ghost" onPress={() => router.push('/about')} />
        </>
      )}
      renderContent={() => children}
    />
  );
}
