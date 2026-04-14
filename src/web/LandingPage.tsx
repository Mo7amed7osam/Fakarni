import { useRef } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, radii, spacing } from '../theme';

const appIcon = require('../../assets/icon.png');

const features = [
  {
    eyebrow: 'Capture in seconds',
    title: 'Speak naturally. Save without cleanup.',
    body:
      'Fakarni is built around voice input first. You say the task and time, and the app turns it into a clean reminder without pushing you through a long form.',
    bullets: [
      'Voice-first capture instead of manual setup',
      'Fast confirmation when something is unclear',
      'Built for spoken Arabic and English flows',
    ],
    visual: 'voice',
  },
  {
    eyebrow: 'Stay on track',
    title: 'A reminder flow designed for real days.',
    body:
      'The product is not just about creating reminders. It is about finishing them, snoozing them cleanly, and getting one smart follow-up when needed.',
    bullets: [
      'Today, Upcoming, and Overdue views',
      'Done and Snooze actions from the main flow',
      'One follow-up nudge instead of notification spam',
    ],
    visual: 'followup',
  },
  {
    eyebrow: 'Works from the system',
    title: 'Widget, Siri, and calendar sync feel like one product.',
    body:
      'Fast entry points matter. Fakarni extends from the app into the surfaces people already use, so reminders stay accessible the moment they are needed.',
    bullets: [
      'Home screen widget for quick voice capture',
      'Siri shortcuts for instant reminder entry',
      'Calendar sync when users want it',
    ],
    visual: 'system',
  },
];

const testimonials = [
  {
    quote:
      'The product makes sense immediately. It does not ask me to organize first and remember later.',
    author: 'Early tester',
  },
  {
    quote:
      'The voice capture flow feels much lighter than a normal reminder app. That is the whole advantage.',
    author: 'Founding user interview',
  },
  {
    quote:
      'The strongest part is trust. It feels calm, direct, and built around getting the reminder right.',
    author: 'Product feedback round',
  },
];

interface LandingPageProps {
  onOpenApp: () => void;
}

export function LandingPage({ onOpenApp }: LandingPageProps) {
  const { width } = useWindowDimensions();
  const detailOffsetRef = useRef(0);
  const scrollRef = useRef<ScrollView>(null);
  const isTablet = width < 1120;
  const isPhone = width < 760;

  function scrollToDetails() {
    scrollRef.current?.scrollTo({
      y: Math.max(detailOffsetRef.current - 40, 0),
      animated: true,
    });
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.page}
      contentContainerStyle={styles.pageContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.shell}>
        <View style={styles.header}>
          <View style={styles.brand}>
            <Image source={appIcon} accessibilityLabel="Fakarni logo" style={styles.brandIcon} />
            <Text style={styles.brandName}>Fakarni</Text>
          </View>

          <View style={[styles.headerLinks, isPhone && styles.headerLinksCompact]}>
            <Pressable onPress={scrollToDetails} style={({ pressed }) => [styles.headerLinkWrap, pressed && styles.pressed]}>
              <Text style={styles.headerLink}>Features</Text>
            </Pressable>
            <Pressable onPress={scrollToDetails} style={({ pressed }) => [styles.headerLinkWrap, pressed && styles.pressed]}>
              <Text style={styles.headerLink}>How it works</Text>
            </Pressable>
            <Pressable onPress={onOpenApp} style={({ pressed }) => [styles.headerCta, pressed && styles.pressed]}>
              <Text style={styles.headerCtaLabel}>Open app</Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.hero, isTablet && styles.heroStacked]}>
          <View style={styles.heroCopy}>
            <Text style={styles.kicker}>Voice reminders, made simple</Text>
            <Text style={styles.heroTitle}>Remember clearly. Speak once.</Text>
            <Text style={styles.heroBody}>
              Fakarni turns a spoken thought into a reliable reminder, then handles the timing,
              the follow-up, and the system surfaces around it.
            </Text>

            <View style={[styles.heroActions, isPhone && styles.heroActionsCompact]}>
              <Pressable onPress={onOpenApp} style={({ pressed }) => [styles.primaryCta, pressed && styles.pressed]}>
                <Text style={styles.primaryCtaLabel}>Try the live app</Text>
              </Pressable>
              <Pressable onPress={scrollToDetails} style={({ pressed }) => [styles.secondaryCta, pressed && styles.pressed]}>
                <Text style={styles.secondaryCtaLabel}>See how it works</Text>
              </Pressable>
            </View>

            <View style={[styles.heroProof, isPhone && styles.heroProofCompact]}>
              <ProofItem value="Voice-first" label="capture flow" />
              <ProofItem value="One smart" label="follow-up nudge" />
              <ProofItem value="Widget + Siri" label="system entry points" />
            </View>
          </View>

          <View style={styles.heroVisual}>
            <View style={styles.visualBackdrop} />
            <PhoneHeroMockup />
          </View>
        </View>

        <View
          onLayout={(event) => {
            detailOffsetRef.current = event.nativeEvent.layout.y;
          }}
          style={styles.introSection}
        >
          <Text style={styles.sectionEyebrow}>How it works</Text>
          <Text style={styles.sectionTitle}>A cleaner landing page, built like a product site.</Text>
          <Text style={styles.sectionBody}>
            The new direction follows a tighter App Store-style rhythm: one strong hero, one
            dominant device visual, then focused product sections that explain behavior instead
            of decorating it.
          </Text>
        </View>

        {features.map((feature, index) => (
          <FeatureSection
            key={feature.title}
            eyebrow={feature.eyebrow}
            title={feature.title}
            body={feature.body}
            bullets={feature.bullets}
            visual={feature.visual}
            reverse={index % 2 === 1 && !isTablet}
            compact={isTablet}
          />
        ))}

        <View style={styles.reviewSection}>
          <Text style={styles.sectionEyebrow}>Why this direction works better</Text>
          <Text style={styles.sectionTitle}>Less chrome, stronger hierarchy, clearer product story.</Text>

          <View style={[styles.testimonialGrid, isTablet && styles.testimonialGridCompact]}>
            {testimonials.map((item) => (
              <View key={item.author} style={styles.testimonialCard}>
                <Text style={styles.testimonialQuote}>“{item.quote}”</Text>
                <Text style={styles.testimonialAuthor}>{item.author}</Text>
              </View>
            ))}
          </View>
        </View>

        <LinearGradient
          colors={['#1C1840', '#312A73']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.finalSection}
        >
          <Text style={styles.finalEyebrow}>Launch-ready entry</Text>
          <Text style={styles.finalTitle}>Open the product, not a generic marketing template.</Text>
          <Text style={styles.finalBody}>
            This landing page now frames Fakarni more like the reference: a strong first
            impression, a centered mobile product visual, and a tighter explanation of what the
            app actually does.
          </Text>

          <Pressable onPress={onOpenApp} style={({ pressed }) => [styles.finalButton, pressed && styles.pressed]}>
            <Text style={styles.finalButtonLabel}>Open app experience</Text>
          </Pressable>
        </LinearGradient>
      </View>
    </ScrollView>
  );
}

function ProofItem({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.proofItem}>
      <Text style={styles.proofValue}>{value}</Text>
      <Text style={styles.proofLabel}>{label}</Text>
    </View>
  );
}

function FeatureSection({
  eyebrow,
  title,
  body,
  bullets,
  visual,
  reverse,
  compact,
}: {
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  visual: string;
  reverse: boolean;
  compact: boolean;
}) {
  return (
    <View
      style={[
        styles.featureSection,
        compact ? styles.featureSectionStacked : { flexDirection: reverse ? 'row-reverse' : 'row' },
      ]}
    >
      <View style={styles.featureCopy}>
        <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureBody}>{body}</Text>

        <View style={styles.bulletList}>
          {bullets.map((bullet) => (
            <View key={bullet} style={styles.bulletRow}>
              <View style={styles.bulletDot} />
              <Text style={styles.bulletText}>{bullet}</Text>
            </View>
          ))}
        </View>
      </View>

      <FeatureVisual visual={visual} />
    </View>
  );
}

function FeatureVisual({ visual }: { visual: string }) {
  if (visual === 'voice') {
    return (
      <View style={styles.visualCard}>
        <Text style={styles.visualLabel}>Screenshot placeholder</Text>
        <View style={styles.placeholderCanvas}>
          <View style={styles.placeholderHeaderRow}>
            <View style={styles.placeholderChipWide} />
            <View style={styles.placeholderChip} />
          </View>
          <View style={styles.placeholderLargeCard} />
          <View style={styles.placeholderLineLong} />
          <View style={styles.placeholderLineMedium} />
        </View>
        <Text style={styles.visualHeadline}>Voice capture screen</Text>
        <Text style={styles.visualSubhead}>Replace this block with your real onboarding or recording screenshot.</Text>
      </View>
    );
  }

  if (visual === 'followup') {
    return (
      <View style={styles.visualCard}>
        <Text style={styles.visualLabel}>Screenshot placeholder</Text>
        <View style={styles.placeholderCanvas}>
          <View style={styles.placeholderPanelTall} />
          <View style={styles.placeholderTwoUp}>
            <View style={styles.placeholderMiniCard} />
            <View style={styles.placeholderMiniCard} />
          </View>
        </View>
        <Text style={styles.visualHeadline}>Reminder list and follow-up</Text>
        <Text style={styles.visualSubhead}>Use this area for a real screenshot of Today, Upcoming, or follow-up behavior.</Text>
      </View>
    );
  }

  return (
    <View style={styles.visualCard}>
      <Text style={styles.visualLabel}>Screenshot placeholder</Text>
      <View style={styles.placeholderCanvas}>
        <View style={styles.systemPills}>
          <View style={styles.systemPill}>
            <Text style={styles.systemPillText}>Widget</Text>
          </View>
          <View style={styles.systemPill}>
            <Text style={styles.systemPillText}>Siri</Text>
          </View>
          <View style={styles.systemPill}>
            <Text style={styles.systemPillText}>Calendar</Text>
          </View>
        </View>
        <View style={styles.placeholderLargeCardSoft} />
        <View style={styles.placeholderLineMedium} />
      </View>
      <Text style={styles.visualHeadline}>System integrations</Text>
      <Text style={styles.visualSubhead}>Drop in a widget, Siri shortcut, or settings screenshot here later.</Text>
    </View>
  );
}

function PhoneHeroMockup() {
  return (
    <View style={styles.phoneFrame}>
      <View style={styles.phoneScreen}>
        <View style={styles.phoneHeader}>
          <Text style={styles.phoneBrand}>Fakarni</Text>
          <View style={styles.phonePill}>
            <Text style={styles.phonePillText}>Hero screenshot area</Text>
          </View>
        </View>

        <View style={styles.heroScreenshotPlaceholder}>
          <View style={styles.heroScreenshotInner}>
            <View style={styles.placeholderBadge} />
            <View style={styles.placeholderScreenshotFrame}>
              <Text style={styles.placeholderScreenshotText}>Drop your main app screenshot here</Text>
            </View>
            <View style={styles.placeholderCaptionBlock}>
              <View style={styles.placeholderLineLong} />
              <View style={styles.placeholderLineMedium} />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#f5f1ff',
  },
  pageContent: {
    paddingBottom: 72,
  },
  shell: {
    width: '100%',
    maxWidth: 1240,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 28,
  },
  header: {
    minHeight: 72,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandIcon: {
    width: 40,
    height: 40,
    borderRadius: 11,
  },
  brandName: {
    fontFamily: fonts.bold,
    fontSize: 24,
    color: '#19153b',
  },
  headerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerLinksCompact: {
    gap: 8,
  },
  headerLinkWrap: {
    minHeight: 42,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  headerLink: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: '#5b567d',
  },
  headerCta: {
    minHeight: 46,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: '#19153b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCtaLabel: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: '#ffffff',
  },
  hero: {
    minHeight: 760,
    borderRadius: 56,
    backgroundColor: '#211b4c',
    padding: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  heroStacked: {
    minHeight: undefined,
    flexDirection: 'column',
    gap: 32,
    paddingVertical: 36,
  },
  heroCopy: {
    flex: 0.92,
    maxWidth: 460,
    gap: 18,
  },
  kicker: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: 'rgba(255,255,255,0.72)',
  },
  heroTitle: {
    fontFamily: fonts.bold,
    fontSize: 64,
    lineHeight: 78,
    color: '#ffffff',
  },
  heroBody: {
    fontFamily: fonts.medium,
    fontSize: 19,
    lineHeight: 32,
    color: 'rgba(255,255,255,0.76)',
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  heroActionsCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  primaryCta: {
    minHeight: 56,
    paddingHorizontal: 24,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryCtaLabel: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: '#19153b',
  },
  secondaryCta: {
    minHeight: 56,
    paddingHorizontal: 24,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryCtaLabel: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: '#ffffff',
  },
  heroProof: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 12,
  },
  heroProofCompact: {
    flexDirection: 'column',
  },
  proofItem: {
    flex: 1,
    minHeight: 92,
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'space-between',
  },
  proofValue: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: '#ffffff',
  },
  proofLabel: {
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.72)',
  },
  heroVisual: {
    flex: 1,
    minHeight: 640,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  visualBackdrop: {
    position: 'absolute',
    inset: 0,
    borderRadius: 44,
    backgroundColor: '#211b4c',
  },
  introSection: {
    paddingHorizontal: 6,
    maxWidth: 760,
    gap: 10,
  },
  sectionEyebrow: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: '#635bff',
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 42,
    lineHeight: 56,
    color: '#19153b',
  },
  sectionBody: {
    fontFamily: fonts.medium,
    fontSize: 18,
    lineHeight: 31,
    color: '#615d80',
  },
  featureSection: {
    minHeight: 420,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 40,
  },
  featureSectionStacked: {
    flexDirection: 'column',
  },
  featureCopy: {
    flex: 1,
    maxWidth: 520,
    gap: 14,
  },
  featureTitle: {
    fontFamily: fonts.bold,
    fontSize: 38,
    lineHeight: 52,
    color: '#19153b',
  },
  featureBody: {
    fontFamily: fonts.medium,
    fontSize: 17,
    lineHeight: 30,
    color: '#615d80',
  },
  bulletList: {
    gap: 12,
    marginTop: 4,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  bulletDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 8,
    backgroundColor: '#635bff',
  },
  bulletText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 16,
    lineHeight: 28,
    color: '#312d55',
  },
  visualCard: {
    flex: 1,
    width: '100%',
    maxWidth: 520,
    minHeight: 340,
    borderRadius: 42,
    padding: 28,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e8e2ff',
    justifyContent: 'space-between',
  },
  placeholderCanvas: {
    minHeight: 220,
    borderRadius: 28,
    padding: 18,
    backgroundColor: '#f7f4ff',
    borderWidth: 1,
    borderColor: '#ece5ff',
    justifyContent: 'space-between',
    gap: 12,
  },
  placeholderHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  placeholderChipWide: {
    width: '46%',
    height: 26,
    borderRadius: 999,
    backgroundColor: '#e4dcff',
  },
  placeholderChip: {
    width: 92,
    height: 26,
    borderRadius: 999,
    backgroundColor: '#e4dcff',
  },
  placeholderLargeCard: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e8e2ff',
  },
  placeholderLargeCardSoft: {
    height: 120,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e8e2ff',
  },
  placeholderPanelTall: {
    height: 138,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e8e2ff',
  },
  placeholderTwoUp: {
    flexDirection: 'row',
    gap: 12,
  },
  placeholderMiniCard: {
    flex: 1,
    height: 84,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e8e2ff',
  },
  placeholderLineLong: {
    width: '100%',
    height: 14,
    borderRadius: 999,
    backgroundColor: '#ddd5ff',
  },
  placeholderLineMedium: {
    width: '68%',
    height: 14,
    borderRadius: 999,
    backgroundColor: '#e3dcff',
  },
  visualLabel: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: '#7c76a0',
  },
  visualHeadline: {
    fontFamily: fonts.bold,
    fontSize: 28,
    lineHeight: 40,
    color: '#19153b',
  },
  visualSubhead: {
    fontFamily: fonts.medium,
    fontSize: 15,
    lineHeight: 26,
    color: '#6a6688',
  },
  systemPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginVertical: 6,
  },
  systemPill: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: '#f1edff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  systemPillText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: '#4d45d6',
  },
  reviewSection: {
    gap: 20,
    paddingTop: 12,
  },
  testimonialGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  testimonialGridCompact: {
    flexDirection: 'column',
  },
  testimonialCard: {
    flex: 1,
    minHeight: 220,
    borderRadius: 32,
    padding: 24,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e8e2ff',
    justifyContent: 'space-between',
  },
  testimonialQuote: {
    fontFamily: fonts.medium,
    fontSize: 17,
    lineHeight: 31,
    color: '#312d55',
  },
  testimonialAuthor: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: '#7c76a0',
  },
  finalSection: {
    borderRadius: 44,
    padding: 36,
    gap: 14,
  },
  finalEyebrow: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: 'rgba(255,255,255,0.72)',
  },
  finalTitle: {
    maxWidth: 760,
    fontFamily: fonts.bold,
    fontSize: 44,
    lineHeight: 58,
    color: '#ffffff',
  },
  finalBody: {
    maxWidth: 720,
    fontFamily: fonts.medium,
    fontSize: 17,
    lineHeight: 30,
    color: 'rgba(255,255,255,0.76)',
  },
  finalButton: {
    alignSelf: 'flex-start',
    minHeight: 56,
    marginTop: 8,
    paddingHorizontal: 24,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  finalButtonLabel: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: '#19153b',
  },
  phoneFrame: {
    width: 560,
    maxWidth: '100%',
    minHeight: 560,
    borderRadius: 64,
    padding: 22,
    backgroundColor: '#211b4c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneScreen: {
    width: '100%',
    maxWidth: '100%',
    borderRadius: 44,
    padding: 22,
    backgroundColor: '#f8f6ff',
    borderWidth: 1,
    borderColor: '#d9d2ff',
    gap: 16,
  },
  phoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  phoneBrand: {
    fontFamily: fonts.bold,
    fontSize: 28,
    color: '#19153b',
  },
  phonePill: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: '#e4ddff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phonePillText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: '#4d45d6',
  },
  heroScreenshotPlaceholder: {
    borderRadius: 34,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e4ddff',
    padding: 18,
  },
  heroScreenshotInner: {
    gap: 16,
  },
  placeholderBadge: {
    width: 148,
    height: 18,
    borderRadius: 999,
    backgroundColor: '#ddd5ff',
  },
  placeholderScreenshotFrame: {
    height: 360,
    borderRadius: 28,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#cfc5ff',
    backgroundColor: '#f6f2ff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  placeholderScreenshotText: {
    fontFamily: fonts.bold,
    fontSize: 24,
    lineHeight: 34,
    color: '#6d61dc',
    textAlign: 'center',
  },
  placeholderCaptionBlock: {
    gap: 10,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
});
