import { useSession } from '@/features/auth';
import { MyRecentPosts } from '@/features/posts';
import { MyProfileScreen } from '@/features/profile';

export default function Profile() {
  const { userId } = useSession();
  return <MyProfileScreen>{userId ? <MyRecentPosts userId={userId} /> : null}</MyProfileScreen>;
}
