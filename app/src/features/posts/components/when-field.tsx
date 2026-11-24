import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { Platform, View } from 'react-native';

import { useTranslation } from '@/shared/i18n';
import { useTheme } from '@/shared/theme';
import { Button, Text } from '@/shared/ui';

import { isRetroactive } from '../lib/timing';
import { ChoiceChips } from './choice-chips';

type Open = 'date' | 'time' | null;

/** The day from `day` with the time of `time`, never later than now. */
function combine(day: Date, time: Date, now: Date): Date {
  const result = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    time.getHours(),
    time.getMinutes(),
  );
  return result > now ? now : result;
}

export interface WhenFieldProps {
  /** ISO date, or null for "now". */
  value: string | null;
  onChange: (value: string | null) => void;
}

export function WhenField({ value, onChange }: WhenFieldProps) {
  const { t, i18n } = useTranslation();
  const { colors, spacing } = useTheme();
  const [open, setOpen] = useState<Open>(null);
  const now = new Date();
  const current = value ? new Date(value) : now;

  const pick = (mode: 'date' | 'time', picked: Date) => {
    const next =
      mode === 'date' ? combine(picked, current, new Date()) : combine(current, picked, new Date());
    onChange(next.toISOString());
    // Android shows a dialog that closes itself; iOS and web show the picker inline until toggled.
    if (Platform.OS === 'android') setOpen(null);
  };

  const dayLabel = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(current);
  const timeLabel = new Intl.DateTimeFormat(i18n.language, { timeStyle: 'short' }).format(current);

  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="label">{t('posts.when.label')}</Text>
      <ChoiceChips<'now' | 'earlier'>
        choices={[
          { value: 'now', label: t('posts.when.now') },
          { value: 'earlier', label: t('posts.when.earlier') },
        ]}
        value={value === null ? 'now' : 'earlier'}
        onChange={(choice) => {
          setOpen(null);
          onChange(choice === 'now' ? null : new Date().toISOString());
        }}
      />
      {value !== null ? (
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button
              title={`${t('posts.when.day')} · ${dayLabel}`}
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => setOpen(open === 'date' ? null : 'date')}
            />
            <Button
              title={`${t('posts.when.time')} · ${timeLabel}`}
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => setOpen(open === 'time' ? null : 'time')}
            />
          </View>
          {open ? (
            <DateTimePicker
              mode={open}
              value={current}
              maximumDate={now}
              presentation="dialog"
              accentColor={colors.primary}
              locale={i18n.language}
              onValueChange={(_event, date) => pick(open, date)}
              onDismiss={() => setOpen(null)}
            />
          ) : null}
          {isRetroactive(current, now) ? (
            <Text variant="caption" muted>
              {t('posts.when.retroNotice')}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
