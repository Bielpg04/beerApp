import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { supabase } from '@/shared/lib/supabase';
import { i18n } from '@/shared/i18n';

import { ProfileScreen, type Profile } from '..';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/shared/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    storage: { from: () => ({ getPublicUrl: (p: string) => ({ data: { publicUrl: `https://cdn/${p}` } }) }) },
  },
}));

const row = {
  id: 'user-a',
  username: 'anna',
  display_name: 'Anna',
  avatar_path: null,
  bio: 'Lager lover',
  is_private: false,
  relationship: 'none',
  can_see_posts: true,
  posts_count: 3,
  beers_count: 2,
  friends_count: 0,
};

async function renderProfile(props: Partial<Parameters<typeof ProfileScreen>[0]> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  await render(
    <QueryClientProvider client={client}>
      <ProfileScreen id="user-a" {...props} />
    </QueryClientProvider>,
  );
}

const rpc = supabase.rpc as jest.Mock;

beforeAll(() => i18n.changeLanguage('ca'));
beforeEach(() => {
  jest.clearAllMocks();
  rpc.mockResolvedValue({ data: [row], error: null });
});

it('shows the header and the summary', async () => {
  await renderProfile();
  expect(await screen.findByText('Anna')).toBeTruthy();
  expect(screen.getByText('@anna')).toBeTruthy();
  expect(screen.getByText('Lager lover')).toBeTruthy();
  expect(screen.getByText('3 registres')).toBeTruthy();
  expect(screen.getByText('2 cerveses')).toBeTruthy();
  expect(screen.getByText('0 amics')).toBeTruthy();
  expect(rpc).toHaveBeenCalledWith('get_profile', { user_id: 'user-a' });
});

it('uses singular labels for one', async () => {
  rpc.mockResolvedValue({
    data: [{ ...row, posts_count: 1, beers_count: 1, friends_count: 1 }],
    error: null,
  });
  await renderProfile();
  expect(await screen.findByText('1 registre')).toBeTruthy();
  expect(screen.getByText('1 cervesa')).toBeTruthy();
  expect(screen.getByText('1 amic')).toBeTruthy();
});

it('lets the route add actions and content for the profile', async () => {
  const renderActions = jest.fn((p: Profile) => <Text>{`actions for ${p.username}`}</Text>);
  const renderContent = jest.fn((p: Profile) => <Text>{`posts of ${p.id}`}</Text>);
  await renderProfile({ renderActions, renderContent });
  expect(await screen.findByText('actions for anna')).toBeTruthy();
  expect(screen.getByText('posts of user-a')).toBeTruthy();
  expect(renderActions.mock.calls[0]?.[0]).toMatchObject({
    relationship: 'none',
    canSeePosts: true,
    stats: { posts: 3, beers: 2, friends: 0 },
  });
});

it('offers to retry when it cannot load', async () => {
  rpc.mockResolvedValueOnce({ data: null, error: new Error('offline') });
  await renderProfile();
  const retry = await screen.findByText('Torna-ho a provar');
  await fireEvent.press(retry);
  await waitFor(() => expect(screen.getByText('Anna')).toBeTruthy());
});

describe('privacy states', () => {
  const t = (key: string, options?: object) => i18n.t(key as never, options as never) as unknown as string;

  it('says the user does not exist when get_profile finds nothing', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    const renderActions = jest.fn(() => <Text>actions</Text>);
    await renderProfile({ renderActions });
    expect(await screen.findByText(t('profile.notFound'))).toBeTruthy();
    expect(renderActions).not.toHaveBeenCalled();
  });

  it('shows only the header and the actions of a private profile I cannot see', async () => {
    rpc.mockResolvedValue({
      data: [
        {
          ...row,
          is_private: true,
          can_see_posts: false,
          posts_count: null,
          beers_count: null,
          friends_count: null,
        },
      ],
      error: null,
    });
    const renderContent = jest.fn(() => <Text>grid</Text>);
    await renderProfile({ renderActions: () => <Text>actions</Text>, renderContent });
    expect(await screen.findByText('Anna')).toBeTruthy();
    expect(screen.getByText('actions')).toBeTruthy();
    expect(screen.getByText(t('profile.privateNotice', { username: 'anna' }))).toBeTruthy();
    expect(screen.queryByText('grid')).toBeNull();
    expect(renderContent).not.toHaveBeenCalled();
    expect(screen.queryByText(/registres?$/)).toBeNull();
  });

  it('shows no private notice on a public profile', async () => {
    await renderProfile({ renderContent: () => <Text>grid</Text> });
    expect(await screen.findByText('grid')).toBeTruthy();
    expect(screen.queryByText(t('profile.privateNotice', { username: 'anna' }))).toBeNull();
  });
});
