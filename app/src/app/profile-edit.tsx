import { signOut } from '@/features/auth';
import { EditProfileScreen } from '@/features/profile';

export default function ProfileEdit() {
  return <EditProfileScreen onSignOut={() => void signOut()} />;
}
