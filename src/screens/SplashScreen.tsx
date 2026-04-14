import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useGhost } from '../context/GhostContext';
import { RootStackParamList } from '../types';
import { colors, fonts, spacing } from '../theme';
import { isTabletWidth } from '../utils/layout';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

export function SplashScreen({ navigation }: Props) {
  const { hydrated, settings } = useGhost();
  const { width } = useWindowDimensions();
  const tabletLayout = isTabletWidth(width);
  const opacity = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 900,
      useNativeDriver: true,
    }).start();
  }, [opacity]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const timeout = setTimeout(() => {
      navigation.replace(settings.hasSeenOnboarding ? 'Home' : 'Onboarding');
    }, 1200);

    return () => clearTimeout(timeout);
  }, [hydrated, navigation, settings.hasSeenOnboarding]);

  return (
    <LinearGradient
      colors={['#F4EFE6', '#E6D9C5', '#FCE7DA']}
      style={[styles.container, tabletLayout && styles.containerTablet]}
    >
      <Animated.View style={[styles.ghostOrb, tabletLayout && styles.ghostOrbTablet, { opacity }]} />
      <Text style={[styles.logo, tabletLayout && styles.logoTablet]}>Fakarni</Text>
      <Text style={[styles.subtitle, tabletLayout && styles.subtitleTablet]}>
        المهام اليومية بصوتك وبأقل خطوة ممكنة
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
  containerTablet: {
    padding: 72,
  },
  ghostOrb: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.primary,
    opacity: 0.85,
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.25,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 15 },
    elevation: 10,
    marginBottom: spacing.xl,
  },
  ghostOrbTablet: {
    width: 220,
    height: 220,
    borderRadius: 110,
    marginBottom: 44,
  },
  logo: {
    fontFamily: fonts.bold,
    fontSize: 36,
    color: colors.text,
  },
  logoTablet: {
    fontSize: 52,
    lineHeight: 64,
  },
  subtitle: {
    marginTop: spacing.sm,
    textAlign: 'center',
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.textMuted,
    writingDirection: 'rtl',
  },
  subtitleTablet: {
    fontSize: 24,
    lineHeight: 34,
  },
});
