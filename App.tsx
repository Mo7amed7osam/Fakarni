import { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  NavigationContainer,
  DefaultTheme,
  useNavigationContainerRef,
} from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppState, I18nManager, Platform } from 'react-native';
import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import {
  Cairo_400Regular,
  Cairo_500Medium,
  Cairo_600SemiBold,
  Cairo_700Bold,
  useFonts,
} from '@expo-google-fonts/cairo';
import { GhostProvider } from './src/context/GhostContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { colors } from './src/theme';
import { flush, screen, track } from './src/services/analytics';
import { consumePendingExternalLaunch } from './src/services/externalLaunch';
import { configureNotifications } from './src/services/notifications';
import { RootStackParamList } from './src/types';

WebBrowser.maybeCompleteAuthSession();

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.card,
    border: 'transparent',
    primary: colors.primary,
    text: colors.text,
  },
};

export default function App() {
  const [fontsLoaded] = useFonts({
    Cairo_400Regular,
    Cairo_500Medium,
    Cairo_600SemiBold,
    Cairo_700Bold,
  });

  if (!fontsLoaded) {
    return null;
  }
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const routeNameRef = useRef<string | undefined>(undefined);
  const pendingExternalLaunchRef = useRef<RootStackParamList['Home'] | null>(null);
  const checkingPendingLaunchRef = useRef(false);

  function navigateToExternalLaunch(
    params: NonNullable<RootStackParamList['Home']>
  ) {
    if (navigationRef.isReady()) {
      navigationRef.navigate('Home', params);
      return;
    }

    pendingExternalLaunchRef.current = params;
  }

  function navigateToWidgetMic() {
    const params: NonNullable<RootStackParamList['Home']> = {
      launchAction: 'start_recording',
      launchSource: 'widget_mic',
      launchNonce: `${Date.now()}`,
    };

    track('widget opened', {
      widget_source: 'widget_mic',
      widget_surface: 'ios_home_screen',
    });

    navigateToExternalLaunch(params);
  }

  function navigateToSiriLaunch(
    params: NonNullable<RootStackParamList['Home']>
  ) {
    track('siri shortcut invoked', {
      source: params.launchSource,
      siri_mode: params.launchSource === 'siri_record' ? 'record' : 'text',
    });
    navigateToExternalLaunch(params);
  }

  function handleIncomingUrl(url?: string | null) {
    if (!url) {
      return;
    }

    if (url.startsWith('voiceghost://widget/mic')) {
      navigateToWidgetMic();
      return;
    }

    if (url.startsWith('voiceghost://siri/record')) {
      navigateToSiriLaunch({
        launchAction: 'start_recording',
        launchSource: 'siri_record',
        launchNonce: `${Date.now()}`,
      });
      return;
    }

    if (url.startsWith('voiceghost://siri/text')) {
      const [, rawQuery = ''] = url.split('?');
      const params = new URLSearchParams(rawQuery);
      navigateToSiriLaunch({
        launchAction: 'process_text',
        launchSource: 'siri_text',
        launchNonce: params.get('nonce') ?? `${Date.now()}`,
        spokenText: params.get('spokenText') ?? '',
      });
    }
  }

  async function syncPendingNativeLaunch() {
    if (checkingPendingLaunchRef.current) {
      return;
    }

    checkingPendingLaunchRef.current = true;
    try {
      const pending = await consumePendingExternalLaunch();
      if (!pending) {
        return;
      }

      navigateToSiriLaunch({
        launchAction: pending.action,
        launchSource: pending.source,
        launchNonce: pending.launchNonce,
        spokenText: pending.spokenText,
      });
    } finally {
      checkingPendingLaunchRef.current = false;
    }
  }

  useEffect(() => {
    if (!I18nManager.isRTL && Platform.OS !== 'web') {
      I18nManager.allowRTL(true);
      I18nManager.forceRTL(true);
    }
    configureNotifications();
  }, []);

  useEffect(() => {
    void syncPendingNativeLaunch();
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void syncPendingNativeLaunch();
      }

      if (nextState === 'background' || nextState === 'inactive') {
        void flush();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    void Linking.getInitialURL().then((url) => {
      handleIncomingUrl(url);
    });

    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleIncomingUrl(url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <GhostProvider>
          <NavigationContainer
            ref={navigationRef}
            theme={navigationTheme}
            onReady={() => {
              routeNameRef.current = navigationRef.getCurrentRoute()?.name;
              if (routeNameRef.current) {
                screen(routeNameRef.current);
              }
              if (pendingExternalLaunchRef.current) {
                navigationRef.navigate('Home', pendingExternalLaunchRef.current);
                pendingExternalLaunchRef.current = null;
              }
            }}
            onStateChange={() => {
              const currentRouteName = navigationRef.getCurrentRoute()?.name;
              if (!currentRouteName || routeNameRef.current === currentRouteName) {
                return;
              }

              screen(currentRouteName, {
                previous_screen: routeNameRef.current,
              });
              routeNameRef.current = currentRouteName;
            }}
          >
            <StatusBar style="dark" />
            <RootNavigator />
          </NavigationContainer>
        </GhostProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
