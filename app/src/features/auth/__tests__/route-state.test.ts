import { routeState } from '..';

type Profile = Parameters<typeof routeState>[1];
const profile = (fields: { birthdate?: string | null; onboarded_at?: string | null }) =>
  ({ birthdate: null, onboarded_at: null, ...fields }) as unknown as Profile;

describe('routeState', () => {
  it('waits while the session is being restored', () => {
    expect(routeState('loading', undefined)).toBe('loading');
  });

  it('sends signed-out users to login', () => {
    expect(routeState('signedOut', null)).toBe('signedOut');
    expect(routeState('signedOut', undefined)).toBe('signedOut');
  });

  it('waits while the profile of a signed-in user loads', () => {
    expect(routeState('signedIn', undefined)).toBe('loading');
  });

  it('asks for the age first', () => {
    expect(routeState('signedIn', profile({}))).toBe('needsAge');
  });

  it('then asks for the profile', () => {
    expect(routeState('signedIn', profile({ birthdate: '2000-01-01' }))).toBe('needsProfile');
  });

  it('lets onboarded users in', () => {
    expect(
      routeState('signedIn', profile({ birthdate: '2000-01-01', onboarded_at: '2026-11-13T10:00:00Z' })),
    ).toBe('ready');
  });

  it('treats a signed-in user without a profile row as needing onboarding', () => {
    expect(routeState('signedIn', null)).toBe('needsAge');
  });

  it('reports an error when the profile could not be loaded, instead of waiting forever', () => {
    expect(routeState('signedIn', undefined, true)).toBe('error');
  });

  it('keeps using a cached profile even if a refetch failed', () => {
    expect(
      routeState('signedIn', profile({ birthdate: '2000-01-01', onboarded_at: '2026-11-13' }), true),
    ).toBe('ready');
  });
});
