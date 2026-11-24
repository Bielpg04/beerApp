import type { QueryClient } from '@tanstack/react-query';

/** A friendship or block changes profiles, which posts I can see, and the social lists. */
export function invalidateSocial(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['profile'] }),
    queryClient.invalidateQueries({ queryKey: ['posts'] }),
    queryClient.invalidateQueries({ queryKey: ['social'] }),
  ]);
}
