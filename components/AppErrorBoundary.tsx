import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { logError } from '@/lib/appDiagnostics';
import { t } from '@/lib/i18n';

// Kept outside the providers so failures during their startup are recorded too.
export default class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logError('render-error', error, info.componentStack);
    void SplashScreen.hideAsync().catch(() => {});
  }

  render() {
    if (this.state.failed) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text accessibilityRole="alert" style={{ fontSize: 16, textAlign: 'center' }}>{t().settings.diagnostics.renderError}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}
