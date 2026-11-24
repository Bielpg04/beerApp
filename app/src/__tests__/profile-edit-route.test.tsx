import { fireEvent, render, screen } from '@testing-library/react-native';

import ProfileEdit from '@/app/profile-edit';
import { signOut } from '@/features/auth';
import { usePostDraft } from '@/features/posts';

jest.mock('@/shared/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/features/auth', () => ({ signOut: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/features/profile', () => {
  const { Pressable, Text } = jest.requireActual('react-native');
  return {
    EditProfileScreen: ({ onSignOut }: { onSignOut: () => void }) => (
      <Pressable accessibilityRole="button" onPress={onSignOut}>
        <Text>sign out</Text>
      </Pressable>
    ),
  };
});

it('forgets the post draft when signing out, so the next user on this phone never sees it', async () => {
  usePostDraft
    .getState()
    .setBeer({ id: 'b1', name: 'X', brand: 'X', imageThumbUrl: null, abv: null, styleCode: null });
  usePostDraft.getState().setCaption('private');
  await render(<ProfileEdit />);
  await fireEvent.press(screen.getByRole('button', { name: 'sign out' }));
  expect(signOut).toHaveBeenCalled();
  expect(usePostDraft.getState().beer).toBeNull();
  expect(usePostDraft.getState().caption).toBe('');
});
