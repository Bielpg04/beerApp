import { router, useLocalSearchParams } from 'expo-router';

import { fetchBeerSummary, ScanScreen } from '@/features/beers';
import { usePostDraft } from '@/features/posts';

/** /scan opens the beer it finds; /scan?for=post puts it in the post being created instead. */
export default function Scan() {
  const { for: purpose } = useLocalSearchParams<{ for?: string }>();
  if (purpose !== 'post') return <ScanScreen />;
  return (
    <ScanScreen
      onFound={async (beerId) => {
        const beer = await fetchBeerSummary(beerId);
        if (!beer) throw new Error('beer_not_found');
        usePostDraft.getState().setBeer(beer);
        router.back();
      }}
    />
  );
}
