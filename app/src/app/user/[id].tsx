import { Redirect, useLocalSearchParams } from 'expo-router';

import { useSession } from '@/features/auth';
import { ProfilePostsGrid } from '@/features/posts';
import { ProfileScreen } from '@/features/profile';
import { FriendshipButton } from '@/features/social';

export default function UserRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useSession();
  if (id === userId) return <Redirect href="/profile" />;
  return (
    <ProfileScreen
      id={id}
      renderActions={(profile) => (
        <FriendshipButton
          userId={profile.id}
          username={profile.username}
          relationship={profile.relationship}
        />
      )}
      renderContent={(profile) => <ProfilePostsGrid userId={profile.id} />}
    />
  );
}
