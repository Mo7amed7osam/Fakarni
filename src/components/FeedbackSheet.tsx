import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { getAppCopy } from '../content/appCopy';
import {
  FeedbackReason,
  FeedbackSentiment,
  FeedbackTriggerSource,
  UiLanguage,
} from '../types';
import { colors, fonts, radii, spacing } from '../theme';

type FeedbackSheetStep = 'gate' | 'positive' | 'form';

interface FeedbackSheetProps {
  visible: boolean;
  language: UiLanguage;
  source: FeedbackTriggerSource | null;
  onClose: () => void;
  onSentimentSelect: (sentiment: FeedbackSentiment) => void;
  onSubmit: (input: {
    source: FeedbackTriggerSource;
    reason: FeedbackReason;
    note?: string;
  }) => Promise<void> | void;
  onRequestReview: (source: FeedbackTriggerSource) => Promise<boolean> | boolean;
  onShareSuggested: (source: FeedbackTriggerSource) => void;
}

const reasonOrder: FeedbackReason[] = [
  'parsing',
  'timing',
  'notifications',
  'calendar',
  'other',
];

export function FeedbackSheet({
  visible,
  language,
  source,
  onClose,
  onSentimentSelect,
  onSubmit,
  onRequestReview,
  onShareSuggested,
}: FeedbackSheetProps) {
  const copy = getAppCopy(language);
  const [step, setStep] = useState<FeedbackSheetStep>('gate');
  const [selectedReason, setSelectedReason] = useState<FeedbackReason>('other');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setStep(source === 'settings_manual' ? 'form' : 'gate');
    setSelectedReason('other');
    setNote('');
    setSubmitting(false);
  }, [visible, source]);

  const reasonLabels = useMemo(
    () => ({
      parsing: copy.feedback.reasonParsing,
      timing: copy.feedback.reasonTiming,
      notifications: copy.feedback.reasonNotifications,
      calendar: copy.feedback.reasonCalendar,
      other: copy.feedback.reasonOther,
    }),
    [copy.feedback]
  );

  if (!visible || !source) {
    return null;
  }

  const activeSource = source;

  async function handleReview() {
    const requested = await onRequestReview(activeSource);

    if (!requested) {
      Alert.alert(copy.feedback.reviewUnavailableTitle, copy.feedback.reviewUnavailableBody);
    }
  }

  async function handleShare() {
    onShareSuggested(activeSource);
    await Share.share({
      message: copy.feedback.shareMessage,
    });
  }

  async function handleSubmit() {
    if (!selectedReason) {
      return;
    }

    setSubmitting(true);

    try {
      await onSubmit({
        source: activeSource,
        reason: selectedReason,
        note: note.trim() || undefined,
      });
      Alert.alert(copy.feedback.thanksTitle, copy.feedback.thanksBody);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {step === 'positive'
                ? copy.feedback.happyTitle
                : step === 'form'
                  ? copy.feedback.formTitle
                  : copy.feedback.promptTitle}
            </Text>
            <Pressable onPress={onClose} style={styles.closeChip}>
              <Text style={styles.closeChipText}>{copy.feedback.dismiss}</Text>
            </Pressable>
          </View>

          <Text style={styles.subtitle}>
            {step === 'positive'
              ? copy.feedback.happySubtitle
              : step === 'form'
                ? copy.feedback.formSubtitle
                : copy.feedback.promptSubtitle}
          </Text>

          {step === 'gate' ? (
            <View style={styles.actionsColumn}>
              <Pressable
                onPress={() => {
                  onSentimentSelect('helpful');
                  setStep('positive');
                }}
                style={[styles.actionButton, styles.primaryButton]}
              >
                <Text style={styles.primaryButtonText}>{copy.feedback.helpfulAction}</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  onSentimentSelect('not_helpful');
                  setStep('form');
                }}
                style={styles.actionButton}
              >
                <Text style={styles.secondaryButtonText}>
                  {copy.feedback.notHelpfulAction}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {step === 'positive' ? (
            <View style={styles.actionsColumn}>
              <Pressable onPress={() => void handleReview()} style={[styles.actionButton, styles.primaryButton]}>
                <Text style={styles.primaryButtonText}>{copy.feedback.reviewAction}</Text>
              </Pressable>

              <Pressable onPress={() => void handleShare()} style={styles.actionButton}>
                <Text style={styles.secondaryButtonText}>{copy.feedback.shareAction}</Text>
              </Pressable>
            </View>
          ) : null}

          {step === 'form' ? (
            <View style={styles.formWrap}>
              <View style={styles.reasonWrap}>
                {reasonOrder.map((reason) => {
                  const active = selectedReason === reason;
                  return (
                    <Pressable
                      key={reason}
                      onPress={() => setSelectedReason(reason)}
                      style={[styles.reasonChip, active && styles.reasonChipActive]}
                    >
                      <Text style={[styles.reasonChipText, active && styles.reasonChipTextActive]}>
                        {reasonLabels[reason]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <TextInput
                multiline
                textAlignVertical="top"
                value={note}
                onChangeText={setNote}
                placeholder={copy.feedback.notePlaceholder}
                placeholderTextColor={colors.textMuted}
                style={styles.noteInput}
              />

              <Pressable
                onPress={() => void handleSubmit()}
                disabled={submitting}
                style={[styles.actionButton, styles.primaryButton, submitting && styles.buttonDisabled]}
              >
                <Text style={styles.primaryButtonText}>
                  {submitting ? copy.feedback.submitting : copy.feedback.submitAction}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(17,14,39,0.18)',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  sheet: {
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(219,214,255,0.9)',
    shadowColor: colors.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  subtitle: {
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textMuted,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  closeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(108,92,231,0.08)',
  },
  closeChipText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.primaryDark,
    writingDirection: 'rtl',
  },
  actionsColumn: {
    gap: spacing.sm,
  },
  actionButton: {
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  primaryButtonText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: '#FFFFFF',
    writingDirection: 'rtl',
  },
  secondaryButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.text,
    writingDirection: 'rtl',
  },
  formWrap: {
    gap: spacing.md,
  },
  reasonWrap: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  reasonChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: '#F6F4FF',
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.14)',
  },
  reasonChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  reasonChipText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.primaryDark,
    writingDirection: 'rtl',
  },
  reasonChipTextActive: {
    color: '#FFFFFF',
  },
  noteInput: {
    minHeight: 108,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#FAF9FF',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
