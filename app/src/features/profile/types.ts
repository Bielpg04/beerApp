import type { Database } from '@/types/database';

export type MyProfile = Database['public']['Tables']['profiles']['Row'];

/** How the signed-in user relates to a profile. `blocked` = I blocked them. */
export type Relationship = 'self' | 'none' | 'outgoing' | 'incoming' | 'friends' | 'blocked';

/** Someone's profile as the signed-in user may see it (`get_profile`). */
export type Profile = {
  id: string;
  username: string;
  displayName: string | null;
  avatarPath: string | null;
  bio: string | null;
  isPrivate: boolean;
  relationship: Relationship;
  canSeePosts: boolean;
  /** Null when I may not see their posts. Counts only what I can see. */
  stats: { posts: number; beers: number; friends: number } | null;
};

/** The public bits of a user, for rows and links. */
export type PersonSummary = {
  id: string;
  username: string;
  displayName: string | null;
  avatarPath: string | null;
};
