import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { i18n } from '@/shared/i18n';

import { EditProfileScreen, myProfileKey, MyProfileScreen } from '..';
import { pickAndUploadAvatar, removeAvatar } from '../api/avatar';

const mockEq = jest.fn();
const mockUpdate = jest.fn(() => ({ eq: mockEq }));
jest.mock('@/shared/lib/supabase', () => ({
  supabase: {
    auth: { getSession: jest.fn() },
    from: jest.fn(() => ({ update: mockUpdate })),
    storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: 'https://x/a.jpg' } }) }) },
  },
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock('../api/avatar', () => ({
  ...jest.requireActual('../api/avatar'),
  pickAndUploadAvatar: jest.fn(),
  removeAvatar: jest.fn(),
}));

const t = (key: string) => i18n.t(key as never) as unknown as string;
const profile = {
  id: 'user-1',
  username: 'biel',
  display_name: 'Biel',
  bio: 'Amant de les IPA',
  avatar_path: null,
  is_private: false,
  birthdate: '1995-05-20',
  country: 'ES',
};

async function renderWith(ui: React.ReactElement, overrides: Partial<typeof profile> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(myProfileKey, { ...profile, ...overrides });
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  await render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  return { invalidate };
}

beforeAll(() => i18n.changeLanguage('ca'));
beforeEach(() => {
  jest.clearAllMocks();
  mockEq.mockResolvedValue({ error: null });
});

describe('MyProfileScreen', () => {
  it('shows initials, name, @username and bio', async () => {
    await renderWith(<MyProfileScreen />);
    expect(screen.getByText('B')).toBeOnTheScreen();
    expect(screen.getByText('Biel')).toBeOnTheScreen();
    expect(screen.getByText('@biel')).toBeOnTheScreen();
    expect(screen.getByText('Amant de les IPA')).toBeOnTheScreen();
  });
});

describe('EditProfileScreen', () => {
  const save = () => fireEvent.press(screen.getByRole('button', { name: t('common.save') }));

  it('rejects a bio longer than 160 characters', async () => {
    await renderWith(<EditProfileScreen onSignOut={jest.fn()} />);
    await fireEvent.changeText(screen.getByLabelText(t('profile.bio')), 'a'.repeat(161));
    await save();
    expect(await screen.findByText(t('profile.errors.bioTooLong'))).toBeOnTheScreen();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('saves only the editable fields, including privacy', async () => {
    const { invalidate } = await renderWith(<EditProfileScreen onSignOut={jest.fn()} />);
    await fireEvent.changeText(screen.getByLabelText(t('profile.bio')), 'Stouts i porters');
    await fireEvent(screen.getByRole('switch', { name: t('profile.private') }), 'valueChange', true);
    await save();
    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith({
        display_name: 'Biel',
        bio: 'Stouts i porters',
        avatar_path: null,
        is_private: true,
      }),
    );
    expect(mockEq).toHaveBeenCalledWith('id', 'user-1');
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: myProfileKey }));
  });

  it('shows username, birthdate and country without letting them be edited', async () => {
    await renderWith(<EditProfileScreen onSignOut={jest.fn()} />);
    expect(screen.getByText('@biel')).toBeOnTheScreen();
    expect(screen.getByText(/Espanya/)).toBeOnTheScreen();
    expect(screen.queryByLabelText(t('onboarding.profile.username'))).toBeNull();
  });

  it('keeps the saved photo until the new one is saved, then removes it', async () => {
    (pickAndUploadAvatar as jest.Mock).mockResolvedValue('user-1/new.jpg');
    await renderWith(<EditProfileScreen onSignOut={jest.fn()} />, { avatar_path: 'user-1/old.jpg' as never });
    await fireEvent.press(screen.getByRole('button', { name: t('onboarding.profile.avatar') }));
    await fireEvent.press(screen.getByRole('button', { name: t('onboarding.profile.chooseFromLibrary') }));
    await waitFor(() => expect(pickAndUploadAvatar).toHaveBeenCalledWith('user-1', 'library', null));
    expect(removeAvatar).not.toHaveBeenCalled();

    await save();
    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ avatar_path: 'user-1/new.jpg' })),
    );
    await waitFor(() => expect(removeAvatar).toHaveBeenCalledWith('user-1/old.jpg'));
  });

  it('asks for confirmation before signing out', async () => {
    const onSignOut = jest.fn();
    await renderWith(<EditProfileScreen onSignOut={onSignOut} />);
    await fireEvent.press(screen.getByRole('button', { name: t('profile.signOut') }));
    expect(onSignOut).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: t('profile.signOutConfirmYes') }));
    expect(onSignOut).toHaveBeenCalled();
  });
});
