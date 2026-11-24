import { signOut } from '@/features/auth';
import { usePostDraft } from '@/features/posts';
import { EditProfileScreen } from '@/features/profile';

export default function ProfileEdit() {
  return (
    <EditProfileScreen
      onSignOut={() => {
        // The draft lives on the device: the next person to sign in here must not inherit it.
        usePostDraft.getState().reset();
        void signOut();
      }}
    />
  );
}
