import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { BeerSummary } from '@/features/beers';

import type { Serving } from '../types';

export type DraftStep = 'beer' | 'photo' | 'details';

/** A photo picked on the device, not uploaded yet (uploads happen only when publishing). */
export type DraftPhoto = {
  uri: string;
  width: number;
  height: number;
  source: 'camera' | 'library';
  /** ISO date the photo was taken, from EXIF (gallery photos only). */
  exifTakenAt: string | null;
};

export type PostDraft = {
  step: DraftStep;
  beer: BeerSummary | null;
  photo: DraftPhoto | null;
  serving: Serving | null;
  volumeMl: number | null;
  caption: string;
  /** null = now. */
  consumedAt: string | null;
  /** null = automatic (off for posts older than 48 h). */
  publishToFeed: boolean | null;
};

type DraftActions = {
  setBeer: (beer: BeerSummary) => void;
  setPhoto: (photo: DraftPhoto | null) => void;
  setServing: (serving: Serving) => void;
  setVolume: (volumeMl: number | null) => void;
  setCaption: (caption: string) => void;
  setConsumedAt: (consumedAt: string | null) => void;
  setPublishToFeed: (publishToFeed: boolean | null) => void;
  goTo: (step: DraftStep) => void;
  reset: () => void;
};

export const initialDraft: PostDraft = {
  step: 'beer',
  beer: null,
  photo: null,
  serving: null,
  volumeMl: null,
  caption: '',
  consumedAt: null,
  publishToFeed: null,
};

const DRAFT_KEY = 'post-draft';
const DRAFT_VERSION = 1;

/** The draft lives on the device so closing the app half-way loses nothing. */
export function createPostDraftStore() {
  return create<PostDraft & DraftActions>()(
    persist(
      (set) => ({
        ...initialDraft,
        setBeer: (beer) => set({ beer, step: 'photo' }),
        setPhoto: (photo) => set({ photo }),
        setServing: (serving) => set({ serving }),
        setVolume: (volumeMl) => set({ volumeMl }),
        setCaption: (caption) => set({ caption }),
        setConsumedAt: (consumedAt) => set({ consumedAt }),
        setPublishToFeed: (publishToFeed) => set({ publishToFeed }),
        goTo: (step) => set({ step }),
        reset: () => set(initialDraft),
      }),
      {
        name: DRAFT_KEY,
        version: DRAFT_VERSION,
        storage: createJSONStorage(() => AsyncStorage),
        partialize: ({
          step,
          beer,
          photo,
          serving,
          volumeMl,
          caption,
          consumedAt,
          publishToFeed,
        }): PostDraft => ({
          step,
          beer,
          photo,
          serving,
          volumeMl,
          caption,
          consumedAt,
          publishToFeed,
        }),
        // A draft saved by another version of the app is dropped rather than guessed at.
        migrate: () => initialDraft,
      },
    ),
  );
}

export const usePostDraft = createPostDraftStore();

/** False until the saved draft has been read from the device. */
export function useDraftHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => usePostDraft.persist.onFinishHydration(onChange),
    () => usePostDraft.persist.hasHydrated(),
  );
}

export function hasDraftContent(draft: PostDraft): boolean {
  return draft.beer !== null || draft.photo !== null || draft.caption.trim() !== '';
}
