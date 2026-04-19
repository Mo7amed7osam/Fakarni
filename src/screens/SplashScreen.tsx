import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAppCopy } from '../content/appCopy';
import { useGhost } from '../context/GhostContext';
import { RootStackParamList } from '../types';
import { colors, fonts, radii, spacing } from '../theme';
import { getResponsiveContentWidth, isTabletWidth } from '../utils/layout';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

export function SplashScreen({ navigation }: Props) {
  const { hydrated, settings } = useGhost();
  const copy = getAppCopy(settings.uiLanguage);
  const { width } = useWindowDimensions();
  const tabletLayout = isTabletWidth(width);
  const contentWidth = getResponsiveContentWidth(width, tabletLayout ? 880 : 560);
  const orbScale = useRef(new Animated.Value(0.92)).current;
  const orbOpacity = useRef(new Animated.Value(0.22)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(orbScale, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }),
      Animated.timing(orbOpacity, {
        toValue: 0.34,
        duration: 900,
        useNativeDriver: true,
      }),
    ]).start();
  }, [orbOpacity, orbScale]);

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
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={[styles.container, tabletLayout && styles.containerTablet]}>
        <View style={styles.backgroundGlowPrimary} />
        <View style={styles.backgroundGlowSecondary} />
        <Animated.View
          style={[
            styles.floatingOrb,
            tabletLayout && styles.floatingOrbTablet,
            {
              opacity: orbOpacity,
              transform: [{ scale: orbScale }],
            },
          ]}
        />

        <View style={[styles.content, { maxWidth: contentWidth }]}>
          <View style={styles.brandLockup}>
            <Text style={[styles.brand, tabletLayout && styles.brandTablet]}>Fakarni</Text>
            <Text style={[styles.brandSubtitle, tabletLayout && styles.brandSubtitleTablet]}>
              {copy.home.brandSubtitle}
            </Text>
          </View>

          <View style={[styles.heroCard, tabletLayout && styles.heroCardTablet]}>
            <View style={styles.badge}>
              <Text style={[styles.badgeText, tabletLayout && styles.badgeTextTablet]}>
                {settings.uiLanguage === 'en' ? 'Ready in a second' : 'جاهزين خلال ثانية'}
              </Text>
            </View>

            <Text style={[styles.title, tabletLayout && styles.titleTablet]}>
              {copy.onboarding.title}
            </Text>

            <Text style={[styles.subtitle, tabletLayout && styles.subtitleTablet]}>
              {copy.onboarding.description}
            </Text>

            <View style={[styles.flowRow, tabletLayout && styles.flowRowTablet]}>
              {[copy.onboarding.flowSpeak, copy.onboarding.flowConfirm, copy.onboarding.flowRemember].map(
                (step, index) => (
                  <View key={step} style={styles.flowItem}>
                    <View style={[styles.flowChip, tabletLayout && styles.flowChipTablet]}>
                      <Text style={[styles.flowChipText, tabletLayout && styles.flowChipTextTablet]}>
                        {step}
                      </Text>
                    </View>
                    {index < 2 ? <View style={styles.flowConnector} /> : null}
                  </View>
                )
              )}
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  containerTablet: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  backgroundGlowPrimary: {
    position: 'absolute',
    top: -72,
    right: -36,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(108,92,231,0.10)',
  },
  backgroundGlowSecondary: {
    position: 'absolute',
    bottom: 120,
    left: -70,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(0,229,168,0.08)',
  },
  floatingOrb: {
    position: 'absolute',
    top: '23%',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(108,92,231,0.12)',
    shadowColor: colors.primary,
    shadowOpacity: 0.18,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 6,
  },
  floatingOrbTablet: {
    width: 300,
    height: 300,
    borderRadius: 150,
  },
  content: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.lg,
  },
  brandLockup: {
    alignItems: 'center',
    gap: 4,
  },
  brand: {
    fontFamily: fonts.bold,
    fontSize: 28,
    color: colors.text,
  },
  brandTablet: {
    fontSize: 40,
    lineHeight: 52,
  },
  brandSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
    writingDirection: 'rtl',
  },
  brandSubtitleTablet: {
    fontSize: 18,
    lineHeight: 28,
  },
  heroCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: radii.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.line,
    gap: spacing.md,
    shadowColor: colors.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 5,
  },
  heroCardTablet: {
    padding: spacing.xxl,
    gap: spacing.lg,
  },
  badge: {
    alignSelf: 'center',
    borderRadius: radii.pill,
    backgroundColor: 'rgba(108,92,231,0.10)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  badgeText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.primaryDark,
    writingDirection: 'rtl',
  },
  badgeTextTablet: {
    fontSize: 15,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 27,
    lineHeight: 42,
    color: colors.text,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  titleTablet: {
    fontSize: 40,
    lineHeight: 58,
  },
  subtitle: {
    fontFamily: fonts.medium,
    fontSize: 15,
    lineHeight: 28,
    color: colors.textMuted,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  subtitleTablet: {
    fontSize: 20,
    lineHeight: 34,
  },
  flowRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  flowRowTablet: {
    gap: spacing.md,
  },
  flowItem: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.xs,
  },
  flowChip: {
    flex: 1,
    minHeight: 50,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.cardMuted,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  flowChipTablet: {
    minHeight: 68,
    paddingHorizontal: spacing.md,
  },
  flowChipText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.text,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  flowChipTextTablet: {
    fontSize: 18,
    lineHeight: 28,
  },
  flowConnector: {
    width: 12,
    height: 1,
    backgroundColor: colors.line,
  },
});
