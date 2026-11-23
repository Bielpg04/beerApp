import { initialDraft, usePostDraft } from '..';

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
