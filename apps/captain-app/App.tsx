import React from 'react';
import { Text, View } from 'react-native';
import { ACTIVE_FOUNDATION_CONTRACTS } from '@dusky/contracts';
import { AppErrorBoundary } from './src/AppErrorBoundary';

export default function App(): React.JSX.Element {
  return (
    <AppErrorBoundary>
      <View accessibilityRole="summary">
        <Text accessibilityRole="header">Dusky Captain</Text>
        <Text>{ACTIVE_FOUNDATION_CONTRACTS.captain.contractId}</Text>
      </View>
    </AppErrorBoundary>
  );
}
