import { Redirect, useLocalSearchParams } from 'expo-router';

import { useSession } from '@/features/auth';
import { ProfilePostsGrid } from '@/features/posts';
import { ProfileScreen } from '@/features/profile';

export default function UserRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useSession();
  if (id === userId) return <Redirect href="/profile" />;
  return (
    <ProfileScreen
      id={id}
      renderContent={(profile) => (profile.canSeePosts ? <ProfilePostsGrid userId={profile.id} /> : null)}
    />
  );
}
