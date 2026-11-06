import { renderRouter, screen } from 'expo-router/testing-library';

import { i18n } from '@/shared/i18n';

describe('tab navigation', () => {
  beforeAll(() => i18n.changeLanguage('ca'));

  it.each([
    ['/', 'Feed'],
    ['/search', 'Cerca'],
    ['/new-post', 'Nova cervesa'],
    ['/map', 'Mapa'],
    ['/profile', 'Perfil'],
  ])('%s renders the %s screen', async (url, title) => {
    await renderRouter('./src/app', { initialUrl: url });
    expect(screen).toHavePathname(url);
    expect(screen.getByRole('header', { name: title })).toBeOnTheScreen();
  });
});
