import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
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
    <LinearGradient
      colors={['#F4EFE6', '#FFF6E8', '#F6D3C2']}
      style={styles.container}
    >
      <View style={styles.heroCard}>
        <Text style={styles.eyebrow}>{copy.onboarding.eyebrow}</Text>
        <Text style={styles.title}>{copy.onboarding.title}</Text>
        <Text style={styles.description}>{copy.onboarding.description}</Text>
        <View style={styles.flowRow}>
          {[copy.onboarding.flowRemember, copy.onboarding.flowConfirm, copy.onboarding.flowSpeak].map(
            (step, index) => (
              <View key={step} style={styles.flowStep}>
                <Text style={styles.flowStepText}>{step}</Text>
                {index < 2 ? <Text style={styles.flowArrow}>←</Text> : null}
              </View>
            )
          )}
        </View>

        <View style={styles.exampleCard}>
          <Text style={styles.exampleLabel}>{copy.onboarding.exampleLabel}</Text>
          <Text style={styles.exampleText}>{copy.onboarding.exampleText}</Text>
        </View>
      </View>

      <GhostButton
        label={copy.onboarding.cta}
        onPress={() => {
          completeOnboarding();
          navigation.replace('Home');
        }}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: 'space-between',
  },
  heroCard: {
    marginTop: spacing.xxl,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.line,
    gap: spacing.sm,
  },
  eyebrow: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentSoft,
    color: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    overflow: 'hidden',
    fontFamily: fonts.semibold,
    fontSize: 12,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 30,
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  description: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  featureRail: {
    gap: spacing.md,
  },
  flowRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  flowStep: {
    flex: 1,
    minHeight: 56,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(215,201,178,0.8)',
    backgroundColor: 'rgba(255,249,240,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    position: 'relative',
  },
  flowStepText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.text,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  flowArrow: {
    position: 'absolute',
    left: -11,
    top: '50%',
    marginTop: -8,
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textMuted,
  },
  exampleCard: {
    backgroundColor: colors.card,
    padding: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    gap: spacing.xs,
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
    writingDirection: 'rtl',
  },
});
