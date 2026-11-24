import { useLocalSearchParams } from 'expo-router';

import { BeerScreen } from '@/features/beers';

export default function Beer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <BeerScreen id={id} />;
}
