import { PropsWithChildren } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { colors, fonts, radii, spacing } from '../theme';
import { isTabletWidth } from '../utils/layout';

interface SectionCardProps extends PropsWithChildren {
  title?: string;
  subtitle?: string;
}

export function SectionCard({ children, title, subtitle }: SectionCardProps) {
  const { width } = useWindowDimensions();
  const tabletLayout = isTabletWidth(width);

  return (
    <View style={[styles.card, tabletLayout && styles.cardTablet]}>
      {title ? <Text style={[styles.title, tabletLayout && styles.titleTablet]}>{title}</Text> : null}
      {subtitle ? (
        <Text style={[styles.subtitle, tabletLayout && styles.subtitleTablet]}>{subtitle}</Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.line,
    gap: spacing.xs,
    shadowColor: colors.shadow,
    shadowOpacity: 0.38,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  cardTablet: {
    padding: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 17,
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  titleTablet: {
    fontSize: 22,
    lineHeight: 32,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'right',
    lineHeight: 20,
    writingDirection: 'rtl',
  },
  subtitleTablet: {
    fontSize: 16,
    lineHeight: 26,
  },
});
