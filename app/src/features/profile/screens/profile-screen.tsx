import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useTranslation } from '@/shared/i18n';
import { useTheme } from '@/shared/theme';
import { Avatar, Button, Card, EmptyState, Screen, Text } from '@/shared/ui';

import { avatarUrl } from '../api/avatar';
import { useProfile } from '../api/profile';
import type { Profile } from '../types';

export interface ProfileScreenProps {
  id: string;
  /** Composed by the route: edit, friendship, block… depending on the relationship. */
  renderActions?: (profile: Profile) => ReactNode;
  /** Composed by the route: the posts grid. */
  renderContent?: (profile: Profile) => ReactNode;
}

/** Anyone's profile, mine included: header, summary, and what the route adds. */
export function ProfileScreen({ id, renderActions, renderContent }: ProfileScreenProps) {
  const { t } = useTranslation();
  const query = useProfile(id);

  if (query.isError) {
    return (
      <EmptyState emoji="📡" title={t('common.connectionError')} message={t('common.connectionErrorHint')}>
        <Button title={t('common.retry')} onPress={() => void query.refetch()} />
      </EmptyState>
    );
  }
  if (query.isPending) return <Screen />;
  const profile = query.data;
  // Unknown, not onboarded, or blocked me: all look the same.
  if (!profile) return <EmptyState emoji="🤷" title={t('profile.notFound')} />;

  return (
    <Screen scroll>
      <ProfileHeader profile={profile} />
      {renderActions?.(profile)}
      {profile.canSeePosts ? (
        renderContent?.(profile)
      ) : (
        <Card>
          <Text style={{ textAlign: 'center' }} accessible={false}>
            🔒
          </Text>
          <Text style={{ textAlign: 'center' }}>
            {t('profile.privateNotice', { username: profile.username })}
          </Text>
        </Card>
      )}
    </Screen>
  );
}

function ProfileHeader({ profile }: { profile: Profile }) {
  const { t } = useTranslation();
  const name = profile.displayName ?? profile.username;
  const isMe = profile.relationship === 'self';

  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <Avatar name={name} uri={avatarUrl(profile.avatarPath)} size={96} />
      <Text variant="title" accessibilityRole="header">
        {name}
      </Text>
      <Text muted>@{profile.username}</Text>
      {profile.bio || isMe ? (
        <Text style={{ textAlign: 'center' }} muted={!profile.bio}>
          {profile.bio || t('profile.noBio')}
        </Text>
      ) : null}
      {profile.stats ? <Stats stats={profile.stats} /> : null}
    </View>
  );
}

function Stats({ stats }: { stats: NonNullable<Profile['stats']> }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const items = [
    t('profile.stats.posts', { count: stats.posts }),
    t('profile.stats.beers', { count: stats.beers }),
    t('profile.stats.friends', { count: stats.friends }),
  ];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.lg }}>
      {items.map((label) => (
        <Text key={label} variant="label">
          {label}
        </Text>
      ))}
    </View>
  );
}
