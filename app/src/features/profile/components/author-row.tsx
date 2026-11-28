import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/shared/theme';
import { Avatar, Text } from '@/shared/ui';

import { avatarUrl } from '../api/avatar';
import { usePersonSummary } from '../api/profile';

/** Avatar and name of a user that opens their profile (e.g. a post's author). */
export function AuthorRow({ userId }: { userId: string }) {
  const { spacing } = useTheme();
  const { data: person } = usePersonSummary(userId);
  if (!person) return null;

  const name = person.displayName ?? person.username;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={name}
      onPress={() => router.push(`/user/${person.id}`)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
    >
      <Avatar name={name} uri={avatarUrl(person.avatarPath)} size={40} />
      <View style={{ flex: 1 }}>
        <Text variant="label" numberOfLines={1}>
          {name}
        </Text>
        <Text variant="caption" muted numberOfLines={1}>
          @{person.username}
        </Text>
      </View>
    </Pressable>
  );
}
