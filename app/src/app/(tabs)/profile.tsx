import { useSession } from '@/features/auth';
import { ProfilePostsGrid } from '@/features/posts';
import { MyProfileScreen } from '@/features/profile';
import { FriendRequestsLink } from '@/features/social';

export default function Profile() {
  const { userId } = useSession();
  return (
    <MyProfileScreen actions={<FriendRequestsLink />}>
      {userId ? <ProfilePostsGrid userId={userId} isMe /> : null}
    </MyProfileScreen>
  );
}
