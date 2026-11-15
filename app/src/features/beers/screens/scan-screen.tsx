import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router } from 'expo-router';
import { useEffect, useReducer, useRef } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTranslation } from '@/shared/i18n';
import { useTheme } from '@/shared/theme';
import { Button, Card, EmptyState, Text } from '@/shared/ui';

import { findBeerByBarcode } from '../api/find-by-barcode';
import { initialScanState, scanReducer, type ScanState } from '../lib/scan-state';

const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e'] as const;

const MESSAGE_KEY = {
  not_found: 'beers.scan.notFound',
  not_beer: 'beers.scan.notBeer',
  unavailable: 'beers.scan.unavailable',
  rate_limited: 'beers.scan.rateLimited',
  invalid: 'beers.scan.invalid',
} as const;

export function ScanScreen() {
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();
  const [state, dispatch] = useReducer(scanReducer, initialScanState);
  // The camera can fire again before React re-renders with the new state.
  const busy = useRef(false);
  // A lookup can finish after the user closed the scanner: then it must not navigate.
  const closed = useRef(false);

  useEffect(() => {
    closed.current = false; // also after a StrictMode remount
    return () => {
      closed.current = true;
    };
  }, []);

  useEffect(() => {
    if (state.kind === 'scanning') busy.current = false;
  }, [state.kind]);

  const onScanned = ({ data, type }: BarcodeScanningResult) => {
    if (busy.current) return;
    busy.current = true;
    dispatch({ type: 'detected', code: data });
    void findBeerByBarcode(data, type).then((result) => {
      if (closed.current) return;
      if (result.status === 'found' || result.status === 'imported') {
        router.replace(`/beer/${result.beerId}`);
      } else {
        dispatch({ type: 'resolved', result });
      }
    });
  };

  if (!permission) return <EmptyState emoji="📷" title={t('common.loading')} />;
  if (!permission.granted) {
    return permission.canAskAgain ? (
      <EmptyState emoji="📷" title={t('beers.scan.title')} message={t('beers.scan.cameraWhy')}>
        <Button title={t('beers.scan.allowCamera')} onPress={() => void requestPermission()} />
        <Button title={t('common.close')} variant="ghost" onPress={() => router.back()} />
      </EmptyState>
    ) : (
      <EmptyState emoji="📷" title={t('beers.scan.title')} message={t('beers.scan.cameraDenied')}>
        <Button title={t('beers.scan.openSettings')} onPress={() => void Linking.openSettings()} />
        <Button title={t('common.close')} variant="ghost" onPress={() => router.back()} />
      </EmptyState>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: 'black' }}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
        onBarcodeScanned={state.kind === 'scanning' ? onScanned : undefined}
      />
      <SafeAreaView style={{ flex: 1, justifyContent: 'space-between', padding: 16 }}>
        <Button title={t('common.close')} variant="secondary" onPress={() => router.back()} />
        <ScanFrame />
        <ScanPanel state={state} onRetry={() => dispatch({ type: 'retry' })} />
      </SafeAreaView>
    </View>
  );
}

function ScanFrame() {
  const { colors } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        alignSelf: 'center',
        width: '85%',
        aspectRatio: 2,
        borderWidth: 3,
        borderRadius: 16,
        borderColor: colors.primary,
      }}
    />
  );
}

function ScanPanel({ state, onRetry }: { state: ScanState; onRetry: () => void }) {
  const { t } = useTranslation();
  if (state.kind === 'scanning') {
    return (
      <Card>
        <Text style={{ textAlign: 'center' }}>{t('beers.scan.hint')}</Text>
      </Card>
    );
  }
  if (state.kind === 'looking') {
    return (
      <Card>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
          <Text>{t('beers.scan.looking')}</Text>
        </View>
      </Card>
    );
  }
  const { status } = state.result;
  if (status === 'found' || status === 'imported') return null; // already navigating to the beer
  return (
    <Card>
      <View style={{ gap: 8 }}>
        <Text variant="subtitle" accessibilityLiveRegion="polite">
          {t(MESSAGE_KEY[status])}
        </Text>
        {status === 'not_found' ? (
          <>
            <Text muted>{state.code}</Text>
            <Text muted>{t('beers.scan.addSoon')}</Text>
          </>
        ) : null}
        <Button title={t('beers.scan.again')} onPress={onRetry} />
      </View>
    </Card>
  );
}
