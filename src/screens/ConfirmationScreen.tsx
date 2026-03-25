import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import { LinearGradient } from 'expo-linear-gradient';
import { GhostButton } from '../components/GhostButton';
import { SectionCard } from '../components/SectionCard';
import { useGhost } from '../context/GhostContext';
import {
  buildReminderAnalyticsProperties,
  getCalendarMode,
  track,
} from '../services/analytics';
import { colors, fonts, radii, spacing } from '../theme';
import { Recurrence, ReminderCategory, RootStackParamList } from '../types';
import {
  relativeReminderLabel,
  toArabicDateLabel,
  toArabicTimeLabel,
} from '../utils/arabic';
import { getReminderCategoryLabel } from '../utils/categorization';
import { getRecurrenceLabel } from '../utils/reminders';

type Props = NativeStackScreenProps<RootStackParamList, 'Confirmation'>;

const offsetOptions = [0, 30, 60, 120];
const recurrenceOptions: Recurrence[] = ['none', 'daily', 'weekly', 'weekdays'];
const categoryOptions: ReminderCategory[] = [
  'study',
  'work',
  'meeting',
  'health',
  'shopping',
  'finance',
  'personal',
  'other',
];

export function ConfirmationScreen({ navigation, route }: Props) {
  const { createReminder, updateReminder, settings, notificationPermission } = useGhost();
  const { draft, transcript, confidence, missingFields, mode, reminderId } = route.params;
  const isEdit = mode === 'edit';
  const isManualCreate = !isEdit && !transcript.trim();
  const entryPoint = isEdit
    ? 'edit'
    : isManualCreate
      ? 'manual_confirmation'
      : 'voice_home';
  const isVoiceFlow = !isEdit && Boolean(transcript.trim());
  const [title, setTitle] = useState(draft.title);
  const [category, setCategory] = useState<ReminderCategory>(draft.category);
  const [eventDate, setEventDate] = useState(new Date(draft.eventAt));
  const [offsetMinutes, setOffsetMinutes] = useState(draft.offsetMinutes);
  const [recurrence, setRecurrence] = useState<Recurrence>(draft.recurrence);
  const [addToCalendar, setAddToCalendar] = useState(Boolean(draft.addToCalendar));
  const [showMode, setShowMode] = useState<'date' | 'time' | null>(null);
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState('');
  const showAndroidCalendarToggle = !isEdit && Platform.OS === 'android';
  const showAppleCalendarSyncHint =
    !isEdit && Platform.OS === 'ios' && settings.appleCalendar.autoSyncEnabled;
  const calendarSubtitle = settings.googleCalendar.connected
    ? 'سيُضاف إلى Google Calendar في الخلفية.'
    : 'سيُضاف إلى تقويم الجهاز إذا كانت الصلاحية متاحة.';
  const calendarMode = getCalendarMode({
    settings,
    addToCalendar,
  });

  const reminderAt = useMemo(
    () => dayjs(eventDate).subtract(offsetMinutes, 'minute').toDate(),
    [eventDate, offsetMinutes]
  );

  const confidenceLabel =
    confidence >= 0.8 ? 'واضح' : confidence >= 0.6 ? 'متوسط' : 'يحتاج مراجعة';

  useEffect(() => {
    track('reminder confirmation shown', {
      entry_point: entryPoint,
      ...buildReminderAnalyticsProperties({
        draft: {
          category,
          eventAt: eventDate.toISOString(),
          offsetMinutes,
          recurrence,
        },
        entryPoint: entryPoint,
        isVoiceFlow,
        notificationPermissionState: notificationPermission,
        calendarMode,
        parseConfidence: confidence,
        missingFields,
        confirmationMode: 'full',
      }),
    });
    // Track once when the screen is first opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getEditedFieldsCount(nextDraft: typeof draft) {
    let count = 0;
    const normalizedOriginalEventAt = dayjs(draft.eventAt)
      .second(0)
      .millisecond(0)
      .toISOString();
    const normalizedNextEventAt = dayjs(nextDraft.eventAt)
      .second(0)
      .millisecond(0)
      .toISOString();

    if (draft.title.trim() !== nextDraft.title.trim()) {
      count += 1;
    }
    if (draft.category !== nextDraft.category) {
      count += 1;
    }
    if (normalizedOriginalEventAt !== normalizedNextEventAt) {
      count += 1;
    }
    if (draft.offsetMinutes !== nextDraft.offsetMinutes) {
      count += 1;
    }
    if (draft.recurrence !== nextDraft.recurrence) {
      count += 1;
    }
    if (showAndroidCalendarToggle && Boolean(draft.addToCalendar) !== Boolean(nextDraft.addToCalendar)) {
      count += 1;
    }

    return count;
  }

  function handleDateTimeChange(
    _event: DateTimePickerEvent,
    selectedDate?: Date
  ) {
    if (selectedDate) {
      setEventDate(selectedDate);
    }

    if (Platform.OS !== 'ios') {
      setShowMode(null);
    }
  }

  async function handleSave() {
    setValidationError('');
    const nextDraft = {
      title,
      category,
      eventAt: eventDate.toISOString(),
      offsetMinutes,
      recurrence,
      addToCalendar: showAndroidCalendarToggle ? addToCalendar : undefined,
    };
    const editedFieldsCount = getEditedFieldsCount(nextDraft);
    if (!title.trim()) {
      if (!isEdit) {
        track('reminder create failed', {
          entry_point: entryPoint,
          ...buildReminderAnalyticsProperties({
            draft: nextDraft,
            entryPoint,
            isVoiceFlow,
            notificationPermissionState: notificationPermission,
            calendarMode,
            parseConfidence: confidence,
            missingFields,
            confirmationMode: 'full',
            editedFieldsCount,
            resultReason: 'missing_title',
          }),
        });
      }
      setValidationError('لازم يكون فيه اسم للمهمة.');
      return;
    }

    if (dayjs(reminderAt).isBefore(dayjs())) {
      if (!isEdit) {
        track('reminder create failed', {
          entry_point: entryPoint,
          ...buildReminderAnalyticsProperties({
            draft: nextDraft,
            entryPoint,
            isVoiceFlow,
            notificationPermissionState: notificationPermission,
            calendarMode,
            parseConfidence: confidence,
            missingFields,
            confirmationMode: 'full',
            editedFieldsCount,
            resultReason: 'past_reminder_time',
          }),
        });
      }
      setValidationError('وقت التذكير لازم يكون في المستقبل.');
      return;
    }

    setSaving(true);
    const result =
      isEdit && reminderId
        ? await updateReminder(reminderId, nextDraft, transcript)
        : await createReminder(nextDraft, transcript);
    setSaving(false);

    if (!result.ok) {
      if (!isEdit) {
        track('reminder create failed', {
          entry_point: entryPoint,
          ...buildReminderAnalyticsProperties({
            draft: nextDraft,
            entryPoint,
            isVoiceFlow,
            notificationPermissionState: notificationPermission,
            calendarMode,
            parseConfidence: confidence,
            missingFields,
            confirmationMode: 'full',
            editedFieldsCount,
            resultReason: result.reason,
          }),
        });
      }
      setValidationError(result.reason ?? 'فيه حاجة محتاجة تتراجع.');
      return;
    }

    if (isEdit) {
      track('reminder updated', {
        entry_point: entryPoint,
        notification_status: result.warning ? 'warning' : 'ok',
        ...buildReminderAnalyticsProperties({
          draft: nextDraft,
          entryPoint,
          isVoiceFlow,
          notificationPermissionState: notificationPermission,
          calendarMode,
          parseConfidence: confidence,
          missingFields,
          confirmationMode: 'full',
          editedFieldsCount,
        }),
      });
    } else {
      track('reminder create succeeded', {
        entry_point: entryPoint,
        notification_status: result.warning ? 'warning' : 'ok',
        ...buildReminderAnalyticsProperties({
          draft: nextDraft,
          entryPoint,
          isVoiceFlow,
          notificationPermissionState: notificationPermission,
          calendarMode,
          parseConfidence: confidence,
          missingFields,
          confirmationMode: 'full',
          editedFieldsCount,
        }),
      });
    }

    if (result.warning) {
      Alert.alert('التذكير اتحفظ', result.warning, [
        {
          text: 'تمام',
          onPress: () => {
            navigation.reset({
              index: 0,
              routes: [{ name: 'Home' }],
            });
          },
        },
      ]);
      return;
    }

    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>
        {isEdit ? 'عدّل التذكير' : isManualCreate ? 'أضف تذكيرًا يدويًا' : 'ظبطها بسرعة'}
      </Text>
      <Text style={styles.subtitle}>
        {isEdit
          ? 'غيّر اللي محتاجه واحفظ التعديل.'
          : isManualCreate
            ? 'اكتب المهمة وحدّد الوقت ثم احفظها بدون خطوات زائدة.'
            : 'عدّل الضروري فقط ثم احفظ.'}
      </Text>

      <LinearGradient colors={['#0D92BF', '#18B7E8']} style={styles.heroCard}>
        <Text style={styles.heroLabel}>
          {isEdit ? 'التعديل' : isManualCreate ? 'إضافة يدوية' : 'فهمناها'}
        </Text>
        <Text style={styles.heroValue}>{confidenceLabel}</Text>
        <Text style={styles.heroCaption}>
          {isEdit
            ? 'حدّث الوقت أو الاسم أو التكرار.'
            : isManualCreate
              ? 'سنرتب التوقيت والتنبيه بناءً على اختيارك هنا.'
            : missingFields.length
              ? `راجع: ${missingFields.join(' / ')}`
              : 'لمسة أخيرة ثم تُحفظ وتُتابَع.'}
        </Text>
      </LinearGradient>

      {transcript.trim() ? (
        <SectionCard title={isEdit ? 'النص الأصلي' : 'النص المسموع'}>
          <Text style={styles.bodyText}>{transcript}</Text>
        </SectionCard>
      ) : null}

      <SectionCard title="اسم المهمة">
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="مثال: ميعاد الدكتور"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          textAlign="right"
        />
      </SectionCard>

      <SectionCard title="تصنيف المهمة" subtitle="اقتراح سريع يساعد التنظيم، ويمكنك تغييره فورًا.">
        <View style={styles.choiceRow}>
          {categoryOptions.map((value) => (
            <Pressable
              key={value}
              onPress={() => setCategory(value)}
              style={[
                styles.choiceChip,
                value === category && styles.choiceChipActive,
              ]}
            >
              <Text
                style={[
                  styles.choiceText,
                  value === category && styles.choiceTextActive,
                ]}
              >
                {getReminderCategoryLabel(value)}
              </Text>
            </Pressable>
          ))}
        </View>
      </SectionCard>

      <SectionCard title="الموعد">
        <View style={styles.row}>
          <Pressable onPress={() => setShowMode('time')} style={styles.fieldChip}>
            <Text style={styles.fieldChipLabel}>الوقت</Text>
            <Text style={styles.fieldChipValue}>{toArabicTimeLabel(eventDate)}</Text>
          </Pressable>
          <Pressable onPress={() => setShowMode('date')} style={styles.fieldChip}>
            <Text style={styles.fieldChipLabel}>اليوم</Text>
            <Text style={styles.fieldChipValue}>{toArabicDateLabel(eventDate)}</Text>
          </Pressable>
        </View>

        {showMode ? (
          <DateTimePicker
            mode={showMode}
            value={eventDate}
            is24Hour={false}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDateTimeChange}
          />
        ) : null}
      </SectionCard>

      <SectionCard title="وقت التذكير">
        <View style={styles.choiceRow}>
          {offsetOptions.map((value) => (
            <Pressable
              key={value}
              onPress={() => setOffsetMinutes(value)}
              style={[
                styles.choiceChip,
                value === offsetMinutes && styles.choiceChipActive,
              ]}
            >
              <Text
                style={[
                  styles.choiceText,
                  value === offsetMinutes && styles.choiceTextActive,
                ]}
              >
                {relativeReminderLabel(value)}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.bodyText}>
          سيصل التنبيه في: {toArabicDateLabel(reminderAt)} - {toArabicTimeLabel(reminderAt)}
        </Text>
      </SectionCard>

      <SectionCard title="التكرار">
        <View style={styles.choiceRow}>
          {recurrenceOptions.map((value) => (
            <Pressable
              key={value}
              onPress={() => setRecurrence(value)}
              style={[
                styles.choiceChip,
                value === recurrence && styles.choiceChipActive,
              ]}
            >
              <Text
                style={[
                  styles.choiceText,
                  value === recurrence && styles.choiceTextActive,
                ]}
              >
                {getRecurrenceLabel(value)}
              </Text>
            </Pressable>
          ))}
        </View>
      </SectionCard>

      {showAppleCalendarSyncHint ? (
        <View style={styles.inlineCalendarHint}>
          <Text style={styles.inlineCalendarHintText}>
            سيُحفظ هذا التذكير أيضًا في Apple Calendar تلقائيًا.
          </Text>
        </View>
      ) : null}

      {showAndroidCalendarToggle ? (
        <SectionCard title="التقويم" subtitle={calendarSubtitle}>
          <View style={styles.calendarRow}>
            <Pressable
              onPress={() => setAddToCalendar((current) => !current)}
              style={[styles.calendarToggle, addToCalendar && styles.calendarToggleActive]}
            >
              <View
                style={[
                  styles.calendarToggleKnob,
                  addToCalendar && styles.calendarToggleKnobActive,
                ]}
              />
            </Pressable>
            <View style={styles.calendarText}>
              <Text style={styles.calendarTitle}>أضف إلى التقويم</Text>
              <Text style={styles.calendarHint}>
                يحفظ الموعد في التقويم مع نفس منطق التنبيه الذي اخترته هنا.
              </Text>
            </View>
          </View>
        </SectionCard>
      ) : null}

      {validationError ? <Text style={styles.errorText}>{validationError}</Text> : null}

      <View style={styles.footer}>
        <GhostButton
          label={saving ? 'جارِ الحفظ...' : isEdit ? 'احفظ التعديل' : 'احفظ التذكير'}
          onPress={handleSave}
          disabled={saving}
        />
        <GhostButton
          label="رجوع"
          variant="secondary"
          onPress={() => navigation.goBack()}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: 48,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.text,
    maxWidth: 260,
  },
  subtitle: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'right',
    lineHeight: 22,
    writingDirection: 'rtl',
  },
  heroCard: {
    borderRadius: radii.lg,
    padding: spacing.xl,
    gap: spacing.sm,
    shadowColor: colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 5,
  },
  heroLabel: {
    color: 'rgba(255,255,255,0.76)',
    fontFamily: fonts.medium,
    fontSize: 13,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  heroValue: {
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 34,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  heroCaption: {
    color: 'rgba(255,255,255,0.86)',
    fontFamily: fonts.medium,
    fontSize: 14,
    textAlign: 'right',
    lineHeight: 22,
    writingDirection: 'rtl',
  },
  bodyText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.text,
    textAlign: 'right',
    lineHeight: 22,
    writingDirection: 'rtl',
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    minHeight: 56,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.text,
    writingDirection: 'rtl',
  },
  row: {
    gap: spacing.sm,
  },
  fieldChip: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
  },
  fieldChipLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  fieldChipValue: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  choiceRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  choiceChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  choiceChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  choiceText: {
    fontFamily: fonts.semibold,
    color: colors.text,
    writingDirection: 'rtl',
  },
  choiceTextActive: {
    color: colors.white,
  },
  errorText: {
    color: colors.danger,
    fontFamily: fonts.semibold,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  calendarRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  calendarToggle: {
    width: 54,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: '#D9D2C5',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  calendarToggleActive: {
    backgroundColor: colors.primary,
  },
  calendarToggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.white,
  },
  calendarToggleKnobActive: {
    alignSelf: 'flex-end',
  },
  calendarText: {
    flex: 1,
    gap: spacing.xs,
  },
  calendarTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  calendarHint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'right',
    lineHeight: 20,
    writingDirection: 'rtl',
  },
  inlineCalendarHint: {
    backgroundColor: '#F2F7F6',
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: '#D5E7E0',
  },
  inlineCalendarHintText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.text,
    textAlign: 'right',
    lineHeight: 20,
    writingDirection: 'rtl',
  },
  footer: {
    gap: spacing.md,
  },
});
