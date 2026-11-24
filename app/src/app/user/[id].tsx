import { Redirect, useLocalSearchParams } from 'expo-router';

import { useSession } from '@/features/auth';
import { ProfileScreen } from '@/features/profile';

export default function UserRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useSession();
  if (id === userId) return <Redirect href="/profile" />;
  return <ProfileScreen id={id} />;
}
