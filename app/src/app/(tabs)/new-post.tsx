import { useSession } from '@/features/auth';
import { NewPostScreen } from '@/features/posts';
import { Screen } from '@/shared/ui';

export default function NewPost() {
  const { userId } = useSession();
  // The tabs are only reachable when signed in; the session is restored right after start.
  if (!userId) return <Screen />;
  return <NewPostScreen userId={userId} />;
}
