import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { avatarUrl } from '@/shared/lib/avatars';
import { useTheme } from '@/shared/theme';
import { Avatar, Text } from '@/shared/ui';

import type { Person } from '../types';

/** A user in a list: avatar, name and @username open their profile; `right` holds actions. */
export function PersonRow({ person, right }: { person: Person; right?: ReactNode }) {
  const { spacing } = useTheme();
  const name = person.displayName ?? person.username;
  return (
    <View style={{ gap: spacing.sm }}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={name}
        onPress={() => router.push(`/user/${person.id}`)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56 }}
      >
        <Avatar name={name} uri={avatarUrl(person.avatarPath)} size={44} />
        <View style={{ flex: 1 }}>
          <Text variant="label" numberOfLines={1}>
            {name}
          </Text>
          {person.displayName ? (
            <Text variant="caption" muted numberOfLines={1}>
              @{person.username}
            </Text>
          ) : null}
        </View>
      </Pressable>
      {right}
    </View>
  );
}
