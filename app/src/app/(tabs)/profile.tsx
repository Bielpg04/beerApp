import { useSession } from '@/features/auth';
import { ProfilePostsGrid } from '@/features/posts';
import { MyProfileScreen } from '@/features/profile';

export default function Profile() {
  const { userId } = useSession();
  return <MyProfileScreen>{userId ? <ProfilePostsGrid userId={userId} isMe /> : null}</MyProfileScreen>;
}
