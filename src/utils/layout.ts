import { spacing } from '../theme';

export const TABLET_LAYOUT_BREAKPOINT = 768;

export function isTabletWidth(width: number) {
  return width >= TABLET_LAYOUT_BREAKPOINT;
}

export function getResponsiveContentWidth(
  width: number,
  maxWidth = 720,
  horizontalPadding = spacing.lg * 2
) {
  return Math.min(Math.max(width - horizontalPadding, 0), maxWidth);
}
