import { useSession } from '@/features/auth';
import { ProfilePostsGrid } from '@/features/posts';
import { MyProfileScreen } from '@/features/profile';
import { FriendRequestsLink, FriendsLink } from '@/features/social';

export default function Profile() {
  const { userId } = useSession();
  return (
    <MyProfileScreen
      actions={
        <>
          <FriendRequestsLink />
          <FriendsLink />
        </>
      }
    >
      {userId ? <ProfilePostsGrid userId={userId} isMe /> : null}
    </MyProfileScreen>
  );
}
