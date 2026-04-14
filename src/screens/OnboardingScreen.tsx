import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GhostButton } from '../components/GhostButton';
import { getAppCopy } from '../content/appCopy';
import { useGhost } from '../context/GhostContext';
import { RootStackParamList } from '../types';
import { colors, fonts, radii, spacing } from '../theme';
import { getResponsiveContentWidth, isTabletWidth } from '../utils/layout';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

export function OnboardingScreen({ navigation }: Props) {
  const { completeOnboarding, settings } = useGhost();
  const copy = getAppCopy(settings.uiLanguage);
  const { width } = useWindowDimensions();
  const tabletLayout = isTabletWidth(width);
  const contentWidth = getResponsiveContentWidth(width, tabletLayout ? 900 : 560);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <View style={styles.backgroundGlow} />
        <View style={styles.backgroundGlowSoft} />

        <View style={[styles.content, { maxWidth: contentWidth }]}>
          <View style={styles.topBlock}>
            <Text style={[styles.brand, tabletLayout && styles.brandTablet]}>Fakarni</Text>
            <Text style={[styles.brandSubtitle, tabletLayout && styles.brandSubtitleTablet]}>
              {copy.home.brandSubtitle}
            </Text>
          </View>

          <View style={[styles.heroCard, tabletLayout && styles.heroCardTablet]}>
            {copy.onboarding.eyebrow ? (
              <Text style={[styles.eyebrow, tabletLayout && styles.eyebrowTablet]}>
                {copy.onboarding.eyebrow}
              </Text>
            ) : null}
            <Text style={[styles.title, tabletLayout && styles.titleTablet]}>
              {copy.onboarding.title}
            </Text>
            <Text style={[styles.description, tabletLayout && styles.descriptionTablet]}>
              {copy.onboarding.description}
            </Text>

            <View style={[styles.flowRow, tabletLayout && styles.flowRowTablet]}>
              {[copy.onboarding.flowSpeak, copy.onboarding.flowConfirm, copy.onboarding.flowRemember].map(
                (step, index) => (
                  <View key={step} style={styles.flowItem}>
                    <View style={[styles.flowStep, tabletLayout && styles.flowStepTablet]}>
                      <Text style={[styles.flowStepText, tabletLayout && styles.flowStepTextTablet]}>
                        {step}
                      </Text>
                    </View>
                    {index < 2 ? (
                      <View style={[styles.flowConnector, tabletLayout && styles.flowConnectorTablet]} />
                    ) : null}
                  </View>
                )
              )}
            </View>

            <View style={[styles.exampleCard, tabletLayout && styles.exampleCardTablet]}>
              <Text style={[styles.exampleLabel, tabletLayout && styles.exampleLabelTablet]}>
                {copy.onboarding.exampleLabel}
              </Text>
              <Text style={[styles.exampleText, tabletLayout && styles.exampleTextTablet]}>
                {copy.onboarding.exampleText}
              </Text>
            </View>
          </View>

          <View style={styles.footer}>
            <GhostButton
              label={copy.onboarding.cta}
              onPress={() => {
                completeOnboarding();
                navigation.replace('Home');
              }}
            />
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
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  content: {
    width: '100%',
    justifyContent: 'space-between',
    flex: 1,
  },
  backgroundGlow: {
    position: 'absolute',
    top: -80,
    right: -40,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(108,92,231,0.08)',
  },
  backgroundGlowSoft: {
    position: 'absolute',
    bottom: 120,
    left: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(125,108,242,0.06)',
  },
  topBlock: {
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
  },
  brand: {
    fontFamily: fonts.bold,
    fontSize: 24,
    color: colors.text,
  },
  brandTablet: {
    fontSize: 34,
    lineHeight: 44,
  },
  brandSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
    writingDirection: 'rtl',
  },
  brandSubtitleTablet: {
    fontSize: 17,
    lineHeight: 26,
  },
  heroCard: {
    marginTop: spacing.xl,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.line,
    gap: spacing.md,
    shadowColor: colors.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  heroCardTablet: {
    padding: spacing.xxl,
    gap: spacing.lg,
  },
  eyebrow: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(108,92,231,0.10)',
    color: colors.primaryDark,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    overflow: 'hidden',
    fontFamily: fonts.semibold,
    fontSize: 12,
    writingDirection: 'rtl',
  },
  eyebrowTablet: {
    fontSize: 15,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 25,
    color: colors.text,
    textAlign: 'right',
    lineHeight: 42,
    writingDirection: 'rtl',
  },
  titleTablet: {
    fontSize: 38,
    lineHeight: 56,
  },
  description: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'right',
    lineHeight: 28,
    writingDirection: 'rtl',
  },
  descriptionTablet: {
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
    marginTop: spacing.md,
  },
  flowItem: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.xs,
  },
  flowStep: {
    flex: 1,
    minHeight: 52,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: 'rgba(255,255,255,0.84)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  flowStepTablet: {
    minHeight: 72,
    paddingHorizontal: spacing.md,
  },
  flowStepText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.text,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  flowStepTextTablet: {
    fontSize: 18,
    lineHeight: 28,
  },
  flowConnector: {
    width: 12,
    height: 1,
    backgroundColor: colors.line,
  },
  flowConnectorTablet: {
    width: 24,
  },
  exampleCard: {
    backgroundColor: 'rgba(247,247,251,0.95)',
    padding: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  exampleCardTablet: {
    padding: spacing.xl,
    gap: spacing.sm,
  },
  exampleLabel: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.primaryDark,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  exampleLabelTablet: {
    fontSize: 15,
  },
  exampleText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'right',
    lineHeight: 28,
    writingDirection: 'rtl',
  },
  exampleTextTablet: {
    fontSize: 22,
    lineHeight: 36,
  },
  footer: {
    paddingTop: spacing.lg,
  },
});
