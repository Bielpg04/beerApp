import { Redirect, useLocalSearchParams } from 'expo-router';

import { useSession } from '@/features/auth';
import { ProfilePostsGrid } from '@/features/posts';
import { ProfileScreen } from '@/features/profile';
import { BlockButton, FriendshipButton } from '@/features/social';

export default function UserRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useSession();
  if (id === userId) return <Redirect href="/profile" />;
  return (
    <ProfileScreen
      id={id}
      renderActions={(profile) => (
        <>
          <FriendshipButton
            userId={profile.id}
            username={profile.username}
            relationship={profile.relationship}
          />
          <BlockButton
            userId={profile.id}
            username={profile.username}
            blocked={profile.relationship === 'blocked'}
          />
        </>
      )}
      renderContent={(profile) => <ProfilePostsGrid userId={profile.id} />}
    />
  );
}
