/** How the signed-in user relates to someone (same values as get_profile). */
export type Relationship = 'self' | 'none' | 'outgoing' | 'incoming' | 'friends' | 'blocked';

/** A user in a social list. */
export type Person = {
  id: string;
  username: string;
  displayName: string | null;
  avatarPath: string | null;
};
