import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { SplashScreen } from '../screens/SplashScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { ConfirmationScreen } from '../screens/ConfirmationScreen';
import { ReminderListScreen } from '../screens/ReminderListScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { HelpFaqScreen } from '../screens/HelpFaqScreen';
import { SpeechFailedScreen } from '../screens/SpeechFailedScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: '#F4EFE6',
        },
        animation: 'fade',
      }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Confirmation" component={ConfirmationScreen} />
      <Stack.Screen name="ReminderList" component={ReminderListScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="HelpFaq" component={HelpFaqScreen} />
      <Stack.Screen name="SpeechFailed" component={SpeechFailedScreen} />
    </Stack.Navigator>
  );
}
