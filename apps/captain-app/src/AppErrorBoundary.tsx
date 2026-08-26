import React from 'react';
import { Text, View } from 'react-native';

interface State {
  failed: boolean;
}

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { failed: false };
  static getDerivedStateFromError(): State {
    return { failed: true };
  }
  render(): React.ReactNode {
    return this.state.failed ? (
      <View accessibilityRole="alert">
        <Text>Captain app could not start.</Text>
      </View>
    ) : (
      this.props.children
    );
  }
}
