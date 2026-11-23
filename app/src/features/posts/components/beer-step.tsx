import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useBeerSearch, type BeerSummary } from '@/features/beers';
import { useTranslation } from '@/shared/i18n';
import { Button, Input, Text } from '@/shared/ui';

import { useRecentBeers } from '../api/recent-beers';
import { BeerRow } from './beer-row';

const DEBOUNCE_MS = 300;

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

export function BeerStep({ userId, onPick }: { userId: string; onPick: (beer: BeerSummary) => void }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, DEBOUNCE_MS);
  const search = useBeerSearch(debounced);
  const recent = useRecentBeers(userId);
  const searching = query.trim().length >= 2;

  return (
    <View style={{ gap: 16 }}>
      <Input
        label={t('posts.new.searchLabel')}
        placeholder={t('posts.new.searchPlaceholder')}
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
      />
      <Button title={t('posts.new.scan')} variant="secondary" onPress={() => router.push('/scan?for=post')} />

      {searching ? (
        search.isError ? (
          <Text accessibilityRole="alert">{t('common.connectionError')}</Text>
        ) : search.data === undefined || search.isFetching ? (
          search.data?.length ? (
            <BeerList beers={search.data} onPick={onPick} />
          ) : (
            <ActivityIndicator accessibilityLabel={t('common.loading')} />
          )
        ) : search.data.length === 0 ? (
          <View style={{ gap: 4 }}>
            <Text variant="label">{t('posts.new.noResults')}</Text>
            <Text muted>{t('posts.new.noResultsHint')}</Text>
          </View>
        ) : (
          <BeerList beers={search.data} onPick={onPick} />
        )
      ) : recent.data?.length ? (
        <View style={{ gap: 8 }}>
          <Text variant="label" muted>
            {t('posts.new.recent')}
          </Text>
          <BeerList beers={recent.data} onPick={onPick} />
        </View>
      ) : null}
    </View>
  );
}

function BeerList({ beers, onPick }: { beers: BeerSummary[]; onPick: (beer: BeerSummary) => void }) {
  return (
    <View style={{ gap: 4 }}>
      {beers.map((beer) => (
        <BeerRow key={beer.id} beer={beer} onPress={() => onPick(beer)} />
      ))}
    </View>
  );
}
