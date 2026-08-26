import React from 'react';
import { Text, View } from 'react-native';

interface State { failed: boolean }

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State { return { failed: true }; }

  render(): React.ReactNode {
    if (this.state.failed) {
      return <View accessibilityRole="alert"><Text>Customer app could not start.</Text></View>;
    }
    return this.props.children;
  }
}

