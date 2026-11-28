import { createPostDraftStore, hasDraftContent, initialDraft, usePostDraft } from '..';

const beer = {
  id: 'b1',
  name: 'Estrella Damm',
  brand: 'Damm',
  imageThumbUrl: null,
  abv: 5.4,
  styleCode: 'lager',
};

beforeEach(() => usePostDraft.getState().reset());

it('starts empty on the beer step', () => {
  expect(usePostDraft.getState()).toMatchObject(initialDraft);
  expect(initialDraft.step).toBe('beer');
});

it('moves to the photo step once a beer is chosen', () => {
  usePostDraft.getState().setBeer(beer);
  expect(usePostDraft.getState()).toMatchObject({ beer, step: 'photo' });
});

it('keeps what was entered when going back a step', () => {
  const draft = usePostDraft.getState();
  draft.setBeer(beer);
  draft.goTo('details');
  draft.setServing('can');
  draft.setVolume(330);
  draft.setCaption('Al sol');
  draft.goTo('beer');
  expect(usePostDraft.getState()).toMatchObject({
    step: 'beer',
    beer,
    serving: 'can',
    volumeMl: 330,
    caption: 'Al sol',
  });
});

it('resets everything', () => {
  usePostDraft.getState().setBeer(beer);
  usePostDraft.getState().reset();
  expect(usePostDraft.getState()).toMatchObject(initialDraft);
});

describe('persistence', () => {
  const AsyncStorage = jest.requireMock('@react-native-async-storage/async-storage');

  it('saves the draft on the device', async () => {
    usePostDraft.getState().setBeer(beer);
    usePostDraft.getState().setCaption('Al sol');
    await new Promise((resolve) => setTimeout(resolve, 0));
    const saved = JSON.parse(await AsyncStorage.getItem('post-draft'));
    expect(saved.state).toMatchObject({ beer, caption: 'Al sol', step: 'photo' });
    expect(saved.version).toBe(1);
  });

  it('restores a saved draft in a new store (as after an app restart)', async () => {
    await AsyncStorage.setItem(
      'post-draft',
      JSON.stringify({ state: { ...initialDraft, beer, serving: 'can', step: 'details' }, version: 1 }),
    );
    const store = createPostDraftStore();
    await store.persist.rehydrate();
    expect(store.getState()).toMatchObject({ beer, serving: 'can', step: 'details' });
    expect(store.persist.hasHydrated()).toBe(true);
  });

  it('starts empty when the saved draft has another version', async () => {
    await AsyncStorage.setItem(
      'post-draft',
      JSON.stringify({ state: { beer, step: 'details' }, version: 0 }),
    );
    const store = createPostDraftStore();
    await store.persist.rehydrate();
    expect(store.getState()).toMatchObject(initialDraft);
  });
});

it('knows whether a draft has anything worth keeping', () => {
  expect(hasDraftContent(initialDraft)).toBe(false);
  expect(hasDraftContent({ ...initialDraft, caption: '  ' })).toBe(false);
  expect(hasDraftContent({ ...initialDraft, beer })).toBe(true);
  expect(hasDraftContent({ ...initialDraft, caption: 'x' })).toBe(true);
});
