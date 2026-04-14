import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { GhostButton } from '../components/GhostButton';
import { getAppCopy } from '../content/appCopy';
import { useGhost } from '../context/GhostContext';
import { colors, fonts, radii, spacing } from '../theme';
import { RootStackParamList } from '../types';
import { getResponsiveContentWidth, isTabletWidth } from '../utils/layout';

type Props = NativeStackScreenProps<RootStackParamList, 'SpeechFailed'>;

export function SpeechFailedScreen({ navigation, route }: Props) {
  const { settings } = useGhost();
  const copy = getAppCopy(settings.uiLanguage);
  const { width } = useWindowDimensions();
  const tabletLayout = isTabletWidth(width);
  const contentMaxWidth = getResponsiveContentWidth(width, 620, spacing.xl * 2);

  return (
    <View style={styles.container}>
      <View style={[styles.content, { maxWidth: contentMaxWidth }]}>
        <View style={styles.errorOrb}>
          <Text style={styles.errorOrbText}>!</Text>
        </View>
        <Text style={[styles.title, tabletLayout && styles.titleTablet]}>{copy.speechFailed.title}</Text>
        <Text style={[styles.text, tabletLayout && styles.textTablet]}>{route.params.reason}</Text>
        {route.params.transcript ? (
          <View style={styles.transcriptCard}>
            <Text style={styles.transcriptLabel}>{copy.speechFailed.transcriptLabel}</Text>
            <Text style={styles.transcriptText}>{route.params.transcript}</Text>
          </View>
        ) : null}
        <GhostButton label={copy.common.tryAgain} onPress={() => navigation.replace('Home')} />
        <GhostButton
          label={copy.common.openHelp}
          variant="secondary"
          onPress={() => navigation.navigate('HelpFaq')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    padding: spacing.xl,
    alignItems: 'center',
  },
  content: {
    width: '100%',
    gap: spacing.lg,
  },
  errorOrb: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignSelf: 'center',
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorOrbText: {
    fontSize: 42,
    color: colors.danger,
    fontFamily: fonts.bold,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 28,
    color: colors.text,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  titleTablet: {
    fontSize: 38,
    lineHeight: 50,
  },
  text: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  textTablet: {
    fontSize: 18,
    lineHeight: 28,
  },
  transcriptCard: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  transcriptLabel: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  transcriptText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
