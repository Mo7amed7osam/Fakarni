import { PropsWithChildren } from 'react';
import {
  Platform,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';

interface GlassSurfaceProps extends PropsWithChildren {
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
  overlayColor?: string;
  borderColor?: string;
}

export function GlassSurface({
  children,
  style,
  contentStyle,
  intensity = 54,
  tint = 'light',
  overlayColor = 'rgba(255,255,255,0.34)',
  borderColor = 'rgba(255,255,255,0.42)',
}: GlassSurfaceProps) {
  return (
    <View style={[styles.shell, { borderColor }, style]}>
      {Platform.OS === 'ios' ? (
        <BlurView intensity={intensity} tint={tint} style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.fallback]} />
      )}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: overlayColor }]} />
      <View style={contentStyle}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    overflow: 'hidden',
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  fallback: {
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
});
