import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { i18n } from '@/shared/i18n';
import { supabase } from '@/shared/lib/supabase';

import { deletePost, DeletePostButton, postKey, type Post } from '..';

jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }));
const mockRemove = jest.fn();
const mockSelect = jest.fn();
const mockEq = jest.fn(() => ({ select: mockSelect }));
const mockDelete = jest.fn(() => ({ eq: mockEq }));
jest.mock('@/shared/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({ delete: mockDelete })),
    storage: { from: () => ({ remove: mockRemove }) },
  },
}));

const t = (key: string, options?: object) => i18n.t(key as never, options as never) as unknown as string;
const order: string[] = [];
const photo = { path: 'u1/a.jpg', thumbPath: 'u1/a_thumb.jpg', width: 1080, height: 810 };
const post = { id: 'p1', photo } as Post;

beforeAll(() => i18n.changeLanguage('ca'));
beforeEach(() => {
  jest.clearAllMocks();
  order.length = 0;
  mockRemove.mockImplementation(async () => {
    order.push('files');
    return { data: [], error: null };
  });
  mockSelect.mockImplementation(async () => {
    order.push('row');
    return { data: [{ id: 'p1' }], error: null };
  });
});

it('removes the photo files first, then the post', async () => {
  await deletePost(post);
  expect(mockRemove).toHaveBeenCalledWith(['u1/a.jpg', 'u1/a_thumb.jpg']);
  expect(supabase.from).toHaveBeenCalledWith('posts');
  expect(mockEq).toHaveBeenCalledWith('id', 'p1');
  expect(order).toEqual(['files', 'row']);
});

it('keeps the post when its files cannot be removed', async () => {
  mockRemove.mockResolvedValue({ data: null, error: new Error('offline') });
  await expect(deletePost(post)).rejects.toThrow('offline');
  expect(mockDelete).not.toHaveBeenCalled();
});

it('finishes the job when the files were already gone (a second attempt)', async () => {
  mockRemove.mockResolvedValue({ data: [], error: null });
  await expect(deletePost(post)).resolves.toBeUndefined();
  expect(mockDelete).toHaveBeenCalled();
});

it('only deletes the row of a post without a photo', async () => {
  await deletePost({ ...post, photo: null });
  expect(mockRemove).not.toHaveBeenCalled();
  expect(order).toEqual(['row']);
});

it('fails when the post was not deleted (not mine, or already gone)', async () => {
  mockSelect.mockResolvedValue({ data: [], error: null });
  await expect(deletePost({ ...post, photo: null })).rejects.toThrow('post_not_found');
});

describe('DeletePostButton', () => {
  async function renderButton() {
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    client.setQueryData(postKey('p1'), post);
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    await render(
      <QueryClientProvider client={client}>
        <DeletePostButton post={post} />
      </QueryClientProvider>,
    );
    return { client, invalidate };
  }

  it('asks before deleting, warns it cannot be undone, then goes back', async () => {
    const { client, invalidate } = await renderButton();
    await fireEvent.press(screen.getByRole('button', { name: t('posts.delete.open') }));
    expect(screen.getByText(t('posts.delete.confirm'))).toBeOnTheScreen();
    expect(screen.getByText(t('posts.delete.cannotUndo'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: t('posts.delete.confirmYes') }));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(order).toEqual(['files', 'row']);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['posts'] });
    expect(client.getQueryData(postKey('p1'))).toBeUndefined();
  });

  it('does nothing when cancelled', async () => {
    await renderButton();
    await fireEvent.press(screen.getByRole('button', { name: t('posts.delete.open') }));
    await fireEvent.press(screen.getByRole('button', { name: t('common.cancel') }));
    expect(mockRemove).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('says so when deleting fails', async () => {
    mockRemove.mockResolvedValue({ data: null, error: new Error('offline') });
    await renderButton();
    await fireEvent.press(screen.getByRole('button', { name: t('posts.delete.open') }));
    await fireEvent.press(screen.getByRole('button', { name: t('posts.delete.confirmYes') }));
    expect(await screen.findByText(t('posts.delete.error'))).toBeOnTheScreen();
    expect(router.back).not.toHaveBeenCalled();
  });
});
