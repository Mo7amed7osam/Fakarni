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
import { flush, screen } from './src/services/analytics';
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
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const routeNameRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!I18nManager.isRTL && Platform.OS !== 'web') {
      I18nManager.allowRTL(true);
      I18nManager.forceRTL(true);
    }
    configureNotifications();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        void flush();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  if (!fontsLoaded) {
    return null;
  }

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
