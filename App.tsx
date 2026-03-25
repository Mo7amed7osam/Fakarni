import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nManager, Platform } from 'react-native';
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
import { configureNotifications } from './src/services/notifications';

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

  useEffect(() => {
    if (!I18nManager.isRTL && Platform.OS !== 'web') {
      I18nManager.allowRTL(true);
      I18nManager.forceRTL(true);
    }
    configureNotifications();
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <GhostProvider>
          <NavigationContainer theme={navigationTheme}>
            <StatusBar style="dark" />
            <RootNavigator />
          </NavigationContainer>
        </GhostProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
