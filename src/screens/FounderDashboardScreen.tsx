import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Application from 'expo-application';
import { GhostButton } from '../components/GhostButton';
import { SectionCard } from '../components/SectionCard';
import { useGhost } from '../context/GhostContext';
import {
  flush,
  getAnalyticsDebugState,
  resetAnalytics,
  subscribeAnalyticsDebug,
} from '../services/analytics';
import { colors, fonts, radii, spacing } from '../theme';
import { RootStackParamList } from '../types';
import { toArabicDateTimeLabel } from '../utils/arabic';

type Props = NativeStackScreenProps<RootStackParamList, 'FounderDashboard'>;

function formatJsonValue(value: Record<string, unknown>) {
  const serialized = JSON.stringify(value);
  return serialized === '{}' ? '' : serialized;
}

export function FounderDashboardScreen({ navigation }: Props) {
  const {
    reminders,
    settings,
    usageState,
    notificationPermission,
    pendingPermissionReminders,
  } = useGhost();
  const [debugState, setDebugState] = useState(getAnalyticsDebugState());
  const recurringCount = reminders.filter(
    (reminder) =>
      reminder.recurrence === 'daily' ||
      reminder.recurrence === 'weekly' ||
      reminder.recurrence === 'weekdays'
  ).length;
  const syncedCalendarCount = reminders.filter(
    (reminder) => reminder.calendarSyncStatus === 'synced'
  ).length;
  const failedCalendarCount = reminders.filter(
    (reminder) => reminder.calendarSyncStatus === 'failed'
  ).length;
  const appVersion = Application.nativeApplicationVersion ?? 'dev';

  useEffect(() => {
    return subscribeAnalyticsDebug(() => {
      setDebugState(getAnalyticsDebugState());
    });
  }, []);

  function handleResetAnalytics() {
    Alert.alert(
      'Reset analytics identity',
      'This creates a new anonymous device identity for analytics on this device.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            void resetAnalytics().then(() => {
              setDebugState(getAnalyticsDebugState());
            });
          },
        },
      ]
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>Founder diagnostics</Text>
      <Text style={styles.title}>VoiceGhost Dashboard</Text>
      <Text style={styles.subtitle}>
        Snapshot for product health, analytics wiring, and local reminder behavior.
      </Text>

      <SectionCard title="Scorecard" subtitle="Quick checks before you open PostHog.">
        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{reminders.length}</Text>
            <Text style={styles.metricLabel}>Total reminders</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{usageState.createdCount}</Text>
            <Text style={styles.metricLabel}>Created today</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{pendingPermissionReminders}</Text>
            <Text style={styles.metricLabel}>Blocked by notif</Text>
          </View>
        </View>
      </SectionCard>

      <SectionCard title="Analytics" subtitle="SDK health and current session visibility.">
        <View style={styles.infoList}>
          <Text style={styles.infoText}>
            Enabled: {debugState.enabled ? 'Yes' : 'No'}
          </Text>
          <Text style={styles.infoText}>
            Mode: {debugState.mode === 'cloud' ? 'PostHog Cloud' : 'Local debug only'}
          </Text>
          <Text style={styles.infoText}>
            API key configured: {debugState.apiKeyConfigured ? 'Yes' : 'No'}
          </Text>
          <Text style={styles.infoText}>Host: {debugState.host}</Text>
          <Text style={styles.infoText}>Flush state: {debugState.flushStatus}</Text>
          <Text style={styles.infoText}>
            Buffered events estimate: {debugState.bufferedEventsEstimate}
          </Text>
          <Text style={styles.infoText}>
            Distinct ID: {debugState.distinctId ?? 'Unavailable'}
          </Text>
          {debugState.lastError ? (
            <Text style={styles.errorText}>Last error: {debugState.lastError}</Text>
          ) : null}
        </View>

        <View style={styles.actionsRow}>
          <GhostButton
            label="Flush analytics now"
            variant="secondary"
            onPress={() => {
              void flush().then(() => {
                setDebugState(getAnalyticsDebugState());
              });
            }}
          />
          <GhostButton
            label="Reset analytics identity"
            variant="ghost"
            onPress={handleResetAnalytics}
          />
        </View>
      </SectionCard>

      <SectionCard title="Local Product State" subtitle="What this device is experiencing right now.">
        <View style={styles.infoList}>
          <Text style={styles.infoText}>App version: {appVersion}</Text>
          <Text style={styles.infoText}>Notification permission: {notificationPermission}</Text>
          <Text style={styles.infoText}>
            Apple Calendar auto-sync: {settings.appleCalendar.autoSyncEnabled ? 'On' : 'Off'}
          </Text>
          <Text style={styles.infoText}>
            Apple Calendar status: {settings.appleCalendar.permissionStatus}
          </Text>
          <Text style={styles.infoText}>
            Google Calendar connected: {settings.googleCalendar.connected ? 'Yes' : 'No'}
          </Text>
          <Text style={styles.infoText}>
            Follow-up enabled: {settings.followUpEnabled ? 'Yes' : 'No'}
          </Text>
          <Text style={styles.infoText}>
            Follow-up delay: {settings.followUpDelayMinutes} minutes
          </Text>
          <Text style={styles.infoText}>Recurring reminders: {recurringCount}</Text>
          <Text style={styles.infoText}>Calendar synced reminders: {syncedCalendarCount}</Text>
          <Text style={styles.infoText}>Calendar sync failures: {failedCalendarCount}</Text>
        </View>
      </SectionCard>

      <SectionCard title="Milestones" subtitle="Useful founder checkpoints stored locally.">
        <View style={styles.infoList}>
          <Text style={styles.infoText}>
            Installed at: {toArabicDateTimeLabel(usageState.installAt)}
          </Text>
          <Text style={styles.infoText}>
            First reminder: {usageState.firstReminderCreatedAt
              ? toArabicDateTimeLabel(usageState.firstReminderCreatedAt)
              : 'Not yet'}
          </Text>
          <Text style={styles.infoText}>
            First voice reminder: {usageState.firstVoiceReminderCreatedAt
              ? toArabicDateTimeLabel(usageState.firstVoiceReminderCreatedAt)
              : 'Not yet'}
          </Text>
        </View>
      </SectionCard>

      <SectionCard title="Recent Events" subtitle="Last tracked events from this app session.">
        {debugState.recentEvents.length === 0 ? (
          <Text style={styles.emptyText}>No events captured in this session yet.</Text>
        ) : (
          debugState.recentEvents.map((entry) => (
            <View key={entry.id} style={styles.eventCard}>
              <Text style={styles.eventName}>{entry.name}</Text>
              <Text style={styles.eventTime}>{toArabicDateTimeLabel(entry.at)}</Text>
              {formatJsonValue(entry.properties as Record<string, unknown>) ? (
                <Text style={styles.eventProps}>
                  {formatJsonValue(entry.properties as Record<string, unknown>)}
                </Text>
              ) : null}
            </View>
          ))
        )}
      </SectionCard>

      <GhostButton label="Back to settings" variant="secondary" onPress={() => navigation.goBack()} />
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
  eyebrow: {
    alignSelf: 'flex-start',
    backgroundColor: colors.cardMuted,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    color: colors.primaryDark,
    fontFamily: fonts.semibold,
    fontSize: 12,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 28,
    color: colors.text,
  },
  subtitle: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 22,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.cardMuted,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 4,
  },
  metricValue: {
    fontFamily: fonts.bold,
    fontSize: 24,
    color: colors.text,
  },
  metricLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
  },
  infoList: {
    gap: spacing.xs,
  },
  infoText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.text,
    lineHeight: 21,
  },
  errorText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.danger,
    lineHeight: 20,
  },
  actionsRow: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  emptyText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
  },
  eventCard: {
    backgroundColor: '#FBFAFF',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: 4,
  },
  eventName: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.text,
  },
  eventTime: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
  },
  eventProps: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
  },
});
