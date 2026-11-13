import { getLocales } from 'expo-localization';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { type Language, useTranslation } from '@/shared/i18n';
import { useTheme } from '@/shared/theme';
import { Button, Input, Screen, Sheet, Text } from '@/shared/ui';

import { OnboardingError, useSetBirthdate } from '../api/set-birthdate';
import { isOldEnough, minDrinkingAge, parseBirthdate } from '../lib/age';
import { countriesSortedFor, findCountry } from '../lib/countries';

const deviceCountry = () => findCountry(getLocales()[0]?.regionCode?.toUpperCase())?.code ?? null;

export function AgeScreen() {
  const { t, i18n } = useTranslation();
  const { colors, radius, spacing } = useTheme();
  const language = i18n.language as Language;
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [country, setCountry] = useState<string | null>(deviceCountry);
  const [picking, setPicking] = useState(false);
  const setBirthdate = useSetBirthdate();

  const birthdate = parseBirthdate(day, month, year);
  const complete = day !== '' && month !== '' && year.length === 4;
  const minAge = minDrinkingAge(country ?? '');
  const underage =
    (birthdate !== null && country !== null && !isOldEnough(birthdate, country)) ||
    (setBirthdate.error instanceof OnboardingError && setBirthdate.error.reason === 'underage');
  const countries = useMemo(() => countriesSortedFor(language), [language]);

  let message: string | null = null;
  if (complete && !birthdate) message = t('onboarding.age.invalidDate');
  else if (underage) message = t('onboarding.age.underage', { age: minAge });
  else if (setBirthdate.error) message = t('auth.errors.generic');

  const canSubmit = birthdate !== null && country !== null && !underage;
  const onSubmit = () => {
    if (canSubmit) setBirthdate.mutate({ birthdate, country });
  };
  const onChange = (setter: (v: string) => void) => (text: string) => {
    setBirthdate.reset();
    setter(text.replace(/\D/g, ''));
  };

  return (
    <Screen scroll>
      <Text variant="title" accessibilityRole="header">
        {t('onboarding.age.title')}
      </Text>
      <Text muted>{t('onboarding.age.subtitle')}</Text>

      <View style={[styles.row, { gap: spacing.sm }]}>
        <View style={styles.small}>
          <Input
            label={t('onboarding.age.day')}
            placeholder={t('onboarding.age.dayPlaceholder')}
            value={day}
            onChangeText={onChange(setDay)}
            keyboardType="number-pad"
            maxLength={2}
            autoComplete="birthdate-day"
          />
        </View>
        <View style={styles.small}>
          <Input
            label={t('onboarding.age.month')}
            placeholder={t('onboarding.age.monthPlaceholder')}
            value={month}
            onChangeText={onChange(setMonth)}
            keyboardType="number-pad"
            maxLength={2}
            autoComplete="birthdate-month"
          />
        </View>
        <View style={styles.large}>
          <Input
            label={t('onboarding.age.year')}
            placeholder={t('onboarding.age.yearPlaceholder')}
            value={year}
            onChangeText={onChange(setYear)}
            keyboardType="number-pad"
            maxLength={4}
            autoComplete="birthdate-year"
          />
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('onboarding.age.country')}: ${findCountry(country)?.name[language] ?? t('onboarding.age.chooseCountry')}`}
        onPress={() => setPicking(true)}
        style={[
          styles.select,
          {
            borderColor: colors.border,
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            padding: spacing.md,
          },
        ]}
      >
        <Text variant="caption" muted>
          {t('onboarding.age.country')}
        </Text>
        <Text>{findCountry(country)?.name[language] ?? t('onboarding.age.chooseCountry')}</Text>
      </Pressable>

      {message ? (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {message}
        </Text>
      ) : null}

      <Button
        title={t('onboarding.age.submit')}
        onPress={onSubmit}
        disabled={!canSubmit}
        loading={setBirthdate.isPending}
      />
      <Text variant="caption" muted>
        {t('onboarding.age.responsible')}
      </Text>

      <Sheet visible={picking} onClose={() => setPicking(false)} title={t('onboarding.age.chooseCountry')}>
        <ScrollView style={{ maxHeight: 420 }}>
          {countries.map((c) => (
            <Pressable
              key={c.code}
              accessibilityRole="button"
              accessibilityState={{ selected: c.code === country }}
              onPress={() => {
                setBirthdate.reset();
                setCountry(c.code);
                setPicking(false);
              }}
              style={{ paddingVertical: spacing.md }}
            >
              <Text style={c.code === country ? { color: colors.primary, fontWeight: '700' } : undefined}>
                {c.name[language]}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  small: { flex: 1 },
  large: { flex: 1.6 },
  select: { borderWidth: 1, gap: 2 },
});
