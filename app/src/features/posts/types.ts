export type Serving = 'tap' | 'bottle' | 'can';

export type VerificationLevel = 'verified' | 'partial' | 'unverified';

export type PostPhoto = { path: string; thumbPath: string; width: number; height: number };

export type Post = {
  id: string;
  authorId: string;
  beer: { id: string; name: string; brand: string; imageThumbUrl: string | null };
  serving: Serving;
  volumeMl: number | null;
  caption: string | null;
  consumedAt: string;
  isRetroactive: boolean;
  publishToFeed: boolean;
  verificationLevel: VerificationLevel;
  createdAt: string;
  photo: PostPhoto | null;
};
