import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GhostButton } from '../components/GhostButton';
import { getAppCopy } from '../content/appCopy';
import { useGhost } from '../context/GhostContext';
import { RootStackParamList } from '../types';
import { colors, fonts, radii, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

export function OnboardingScreen({ navigation }: Props) {
  const { completeOnboarding, settings } = useGhost();
  const copy = getAppCopy(settings.uiLanguage);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <View style={styles.backgroundGlow} />
        <View style={styles.backgroundGlowSoft} />

        <View style={styles.topBlock}>
          <Text style={styles.brand}>Fakarni</Text>
          <Text style={styles.brandSubtitle}>{copy.home.brandSubtitle}</Text>
        </View>

        <View style={styles.heroCard}>
          {copy.onboarding.eyebrow ? (
            <Text style={styles.eyebrow}>{copy.onboarding.eyebrow}</Text>
          ) : null}
          <Text style={styles.title}>{copy.onboarding.title}</Text>
          <Text style={styles.description}>{copy.onboarding.description}</Text>

          <View style={styles.flowRow}>
            {[copy.onboarding.flowSpeak, copy.onboarding.flowConfirm, copy.onboarding.flowRemember].map(
              (step, index) => (
                <View key={step} style={styles.flowItem}>
                  <View style={styles.flowStep}>
                    <Text style={styles.flowStepText}>{step}</Text>
                  </View>
                  {index < 2 ? <View style={styles.flowConnector} /> : null}
                </View>
              )
            )}
          </View>

          <View style={styles.exampleCard}>
            <Text style={styles.exampleLabel}>{copy.onboarding.exampleLabel}</Text>
            <Text style={styles.exampleText}>{copy.onboarding.exampleText}</Text>
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
    justifyContent: 'space-between',
    overflow: 'hidden',
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
  brandSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
    writingDirection: 'rtl',
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
  title: {
    fontFamily: fonts.bold,
    fontSize: 25,
    color: colors.text,
    textAlign: 'right',
    lineHeight: 42,
    writingDirection: 'rtl',
  },
  description: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'right',
    lineHeight: 28,
    writingDirection: 'rtl',
  },
  flowRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
    marginTop: spacing.sm,
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
  flowStepText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.text,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  flowConnector: {
    width: 12,
    height: 1,
    backgroundColor: colors.line,
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
  exampleLabel: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.primaryDark,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  exampleText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'right',
    lineHeight: 28,
    writingDirection: 'rtl',
  },
  footer: {
    paddingTop: spacing.lg,
  },
});
