import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { supabase } from '@/shared/lib/supabase';

import { AuthorRow } from '..';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
const mockMaybeSingle = jest.fn();
jest.mock('@/shared/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }) })),
    storage: { from: () => ({ getPublicUrl: (p: string) => ({ data: { publicUrl: `https://cdn/${p}` } }) }) },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockMaybeSingle.mockResolvedValue({
    data: { id: 'user-a', username: 'anna', display_name: 'Anna', avatar_path: null },
    error: null,
  });
});

it('shows the author and opens their profile', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  await render(
    <QueryClientProvider client={client}>
      <AuthorRow userId="user-a" />
    </QueryClientProvider>,
  );
  await fireEvent.press(await screen.findByText('Anna'));
  expect(router.push).toHaveBeenCalledWith('/user/user-a');
  expect(screen.getByText('@anna')).toBeTruthy();
  expect(supabase.from).toHaveBeenCalledWith('public_profiles');
});
