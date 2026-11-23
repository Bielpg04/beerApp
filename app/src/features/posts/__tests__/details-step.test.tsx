import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { i18n } from '@/shared/i18n';

import { DetailsStep, usePostDraft } from '..';

type PickerProps = {
  mode: 'date' | 'time';
  value: Date;
  maximumDate?: Date;
  onValueChange: (event: unknown, date: Date) => void;
};
const mockPickers: PickerProps[] = [];
jest.mock('@expo/ui/community/datetime-picker', () => {
  const Picker = (props: PickerProps) => {
    mockPickers.push(props);
    return null;
  };
  return { __esModule: true, default: Picker, DateTimePicker: Picker };
});

const t = (key: string, options?: object) => i18n.t(key as never, options as never) as unknown as string;
const lastPicker = (mode: 'date' | 'time') => [...mockPickers].reverse().find((p) => p.mode === mode)!;
const DAY = 24 * 3_600_000;

async function renderDetails() {
  await render(<DetailsStep onPublish={jest.fn()} publishing={false} error={null} />);
}

beforeAll(() => i18n.changeLanguage('ca'));
beforeEach(() => {
  mockPickers.length = 0;
  usePostDraft.getState().reset();
});

it('is now and goes to the feed by default', async () => {
  await renderDetails();
  expect(screen.getByRole('radio', { name: t('posts.when.now') })).toBeChecked();
  expect(screen.getByRole('switch', { name: t('posts.when.feed') })).toBeChecked();
  expect(screen.queryByText(t('posts.when.retroNotice'))).toBeNull();
});

it('takes a day three days ago, marks it as retroactive and keeps it off the feed', async () => {
  await renderDetails();
  await fireEvent.press(screen.getByRole('radio', { name: t('posts.when.earlier') }));
  await fireEvent.press(screen.getByRole('button', { name: /^Dia/ }));
  const picker = lastPicker('date');
  expect(picker.maximumDate!.getTime()).toBeGreaterThan(Date.now() - 60_000);
  const threeDaysAgo = new Date(Date.now() - 3 * DAY);
  await act(async () => picker.onValueChange({}, threeDaysAgo));

  const consumedAt = new Date(usePostDraft.getState().consumedAt!);
  expect(consumedAt.toDateString()).toBe(threeDaysAgo.toDateString());
  expect(screen.getByText(t('posts.when.retroNotice'))).toBeOnTheScreen();
  expect(screen.getByRole('switch', { name: t('posts.when.feed') })).not.toBeChecked();
  expect(screen.getByText(t('posts.when.feedOffHint'))).toBeOnTheScreen();
});

it('changes the time and keeps the day', async () => {
  usePostDraft.setState({ consumedAt: new Date(2026, 10, 20, 21, 15).toISOString() });
  await renderDetails();
  await fireEvent.press(screen.getByRole('button', { name: /^Hora/ }));
  await act(async () => lastPicker('time').onValueChange({}, new Date(2030, 0, 1, 18, 40)));
  const consumedAt = new Date(usePostDraft.getState().consumedAt!);
  expect([consumedAt.getFullYear(), consumedAt.getMonth(), consumedAt.getDate()]).toEqual([2026, 10, 20]);
  expect([consumedAt.getHours(), consumedAt.getMinutes()]).toEqual([18, 40]);
});

it('never goes later than now', async () => {
  usePostDraft.setState({ consumedAt: new Date(Date.now() - 30 * 60_000).toISOString() });
  await renderDetails();
  await fireEvent.press(screen.getByRole('button', { name: /^Hora/ }));
  const inAnHour = new Date(Date.now() + 3_600_000);
  await act(async () => lastPicker('time').onValueChange({}, inAnHour));
  expect(new Date(usePostDraft.getState().consumedAt!).getTime()).toBeLessThanOrEqual(Date.now());
});

it('keeps the feed choice the user made when the date changes', async () => {
  usePostDraft.setState({ consumedAt: new Date(Date.now() - 3 * DAY).toISOString() });
  await renderDetails();
  await fireEvent(screen.getByRole('switch', { name: t('posts.when.feed') }), 'valueChange', true);
  expect(usePostDraft.getState().publishToFeed).toBe(true);
  await fireEvent.press(screen.getByRole('button', { name: /^Dia/ }));
  await act(async () => lastPicker('date').onValueChange({}, new Date(Date.now() - 5 * DAY)));
  expect(screen.getByRole('switch', { name: t('posts.when.feed') })).toBeChecked();
});

it('goes back to now', async () => {
  usePostDraft.setState({ consumedAt: new Date(Date.now() - 3 * DAY).toISOString() });
  await renderDetails();
  await fireEvent.press(screen.getByRole('radio', { name: t('posts.when.now') }));
  expect(usePostDraft.getState().consumedAt).toBeNull();
  expect(screen.queryByText(t('posts.when.retroNotice'))).toBeNull();
});

it('offers the date a gallery photo was taken', async () => {
  const twoDaysAgo = new Date(Date.now() - 2 * DAY);
  twoDaysAgo.setSeconds(0, 0);
  usePostDraft.setState({
    photo: {
      uri: 'file:///p.jpg',
      width: 1,
      height: 1,
      source: 'library',
      exifTakenAt: twoDaysAgo.toISOString(),
    },
  });
  await renderDetails();
  const when = new Intl.DateTimeFormat('ca', { dateStyle: 'medium', timeStyle: 'short' }).format(twoDaysAgo);
  await fireEvent.press(screen.getByRole('button', { name: t('posts.when.usePhotoDate', { date: when }) }));
  expect(usePostDraft.getState().consumedAt).toBe(twoDaysAgo.toISOString());
  expect(screen.queryByRole('button', { name: t('posts.when.usePhotoDate', { date: when }) })).toBeNull();
});

it('does not offer a photo date close to now, or in the future', async () => {
  usePostDraft.setState({
    photo: {
      uri: 'file:///p.jpg',
      width: 1,
      height: 1,
      source: 'library',
      exifTakenAt: new Date(Date.now() - 20 * 60_000).toISOString(),
    },
  });
  await renderDetails();
  expect(screen.queryByText(/foto/i, { exact: false })).toBeNull();
  usePostDraft.setState({
    photo: {
      uri: 'file:///p.jpg',
      width: 1,
      height: 1,
      source: 'library',
      exifTakenAt: new Date(Date.now() + DAY).toISOString(),
    },
  });
  expect(screen.queryByText(/foto/i, { exact: false })).toBeNull();
});
