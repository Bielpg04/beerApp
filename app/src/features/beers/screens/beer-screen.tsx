import { Image } from 'expo-image';
import { useState } from 'react';
import { View } from 'react-native';

import type { Language } from '@/shared/i18n';
import { useTranslation } from '@/shared/i18n';
import { useTheme } from '@/shared/theme';
import { Button, Card, EmptyState, Screen, Text } from '@/shared/ui';

import { useBeer } from '../api/beer';
import { countryLabel, formatAbv } from '../lib/format';
import type { Beer } from '../types';

export function BeerScreen({ id }: { id: string }) {
  const { t } = useTranslation();
  const query = useBeer(id);

  if (query.isError) {
    return (
      <EmptyState emoji="📡" title={t('common.connectionError')} message={t('common.connectionErrorHint')}>
        <Button title={t('common.retry')} onPress={() => void query.refetch()} />
      </EmptyState>
    );
  }
  if (query.isPending) return <EmptyState emoji="🍺" title={t('common.loading')} />;
  if (!query.data) return <EmptyState emoji="🤷" title={t('beers.notFound')} />;
  return <BeerDetails beer={query.data} />;
}

function BeerDetails({ beer }: { beer: Beer }) {
  const { t, i18n } = useTranslation();
  const { colors, radius } = useTheme();
  const language = i18n.language as Language;
  const [imageFailed, setImageFailed] = useState(false);
  const brewery = beer.brewery ? [beer.brewery.name, beer.brewery.city].filter(Boolean).join(' · ') : null;

  return (
    <Screen scroll>
      {beer.imageUrl && !imageFailed ? (
        <Image
          source={beer.imageUrl}
          onError={() => setImageFailed(true)}
          contentFit="contain"
          accessible
          accessibilityLabel={t('beers.imageLabel', { name: beer.name })}
          style={{ height: 240, borderRadius: radius.lg, backgroundColor: colors.surface }}
        />
      ) : (
        <View
          style={{
            height: 160,
            borderRadius: radius.lg,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 72 }}>🍺</Text>
        </View>
      )}

      <View style={{ gap: 4 }}>
        <Text variant="title" accessibilityRole="header">
          {beer.name}
        </Text>
        <Text muted>{beer.brand}</Text>
      </View>

      <Card>
        <View style={{ gap: 12 }}>
          {brewery ? <Fact label={t('beers.brewery')} value={brewery} /> : null}
          {beer.styleCode ? (
            <Fact label={t('beers.style')} value={t(`beers.styles.${beer.styleCode}` as never)} />
          ) : null}
          <Fact label={t('beers.abv')} value={beer.abv === null ? '—' : formatAbv(beer.abv, language)} />
          {beer.country ? (
            <Fact label={t('beers.country')} value={countryLabel(beer.country, language)} />
          ) : null}
        </View>
      </Card>

      <Text muted variant="caption">
        {t('beers.source')}
      </Text>
    </Screen>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 16 }}>
      <Text muted>{label}</Text>
      <Text style={{ flexShrink: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}
