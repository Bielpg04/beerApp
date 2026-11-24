import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/shared/lib/supabase';

import { invalidateSocial } from './invalidate';

type FriendshipFunction =
  'send_friend_request' | 'accept_friend_request' | 'decline_friend_request' | 'remove_friend';

/** The message of a server error (e.g. request_not_found), so screens can react to it. */
export class SocialError extends Error {}

async function call(fn: FriendshipFunction, userId: string) {
  const { error } = await supabase.rpc(fn, { user_id: userId });
  if (error) throw new SocialError(error.message);
}

function useFriendshipMutation(fn: FriendshipFunction) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => call(fn, userId),
    onSettled: () => invalidateSocial(queryClient),
  });
}

/** Send (or accept theirs), accept, decline, and cancel/unfriend. */
export function useFriendshipActions() {
  return {
    send: useFriendshipMutation('send_friend_request'),
    accept: useFriendshipMutation('accept_friend_request'),
    decline: useFriendshipMutation('decline_friend_request'),
    remove: useFriendshipMutation('remove_friend'),
  };
}
