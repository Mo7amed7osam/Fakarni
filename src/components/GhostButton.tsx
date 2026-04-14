import { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { colors, fonts, radii, spacing } from '../theme';
import { isTabletWidth } from '../utils/layout';

interface GhostButtonProps {
  label: string;
  onPress: () => void;
  icon?: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
}

export function GhostButton({
  label,
  onPress,
  icon,
  variant = 'primary',
  disabled,
}: GhostButtonProps) {
  const { width } = useWindowDimensions();
  const tabletLayout = isTabletWidth(width);

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        tabletLayout && styles.baseTablet,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <View style={[styles.content, tabletLayout && styles.contentTablet]}>
        {icon}
        <Text
          style={[
            styles.label,
            tabletLayout && styles.labelTablet,
            variant === 'secondary' && styles.secondaryLabel,
            variant === 'ghost' && styles.ghostLabel,
          ]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radii.pill,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    shadowColor: colors.shadow,
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  baseTablet: {
    minHeight: 64,
    paddingHorizontal: spacing.xl,
  },
  primary: {
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  secondary: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  content: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  contentTablet: {
    gap: spacing.md,
  },
  label: {
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 16,
    writingDirection: 'rtl',
  },
  labelTablet: {
    fontSize: 20,
  },
  secondaryLabel: {
    color: colors.text,
  },
  ghostLabel: {
    color: colors.primary,
  },
});
