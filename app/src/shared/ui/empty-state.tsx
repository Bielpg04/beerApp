import type { ReactNode } from 'react';

import { Screen } from './screen';
import { Text } from './text';

export interface EmptyStateProps {
  emoji: string;
  title: string;
  message?: string;
  children?: ReactNode;
}

export function EmptyState({ emoji, title, message, children }: EmptyStateProps) {
  return (
    <Screen style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 56 }} accessibilityElementsHidden importantForAccessibility="no">
        {emoji}
      </Text>
      <Text variant="title" accessibilityRole="header">
        {title}
      </Text>
      {message ? <Text muted>{message}</Text> : null}
      {children}
    </Screen>
  );
}
