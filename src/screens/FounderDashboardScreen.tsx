import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
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
import { AdsProvider, RootStackParamList } from '../types';
import { toArabicDateTimeLabel } from '../utils/arabic';

type Props = NativeStackScreenProps<RootStackParamList, 'FounderDashboard'>;
const adsProviders: AdsProvider[] = ['none', 'admob'];
const interstitialOptions = [0, 3, 5, 10];

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
    updateSettings,
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
      <Text style={styles.title}>Fakarni Dashboard</Text>
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
          <Text style={styles.infoText}>Ads enabled: {settings.ads.enabled ? 'Yes' : 'No'}</Text>
          <Text style={styles.infoText}>Ads provider: {settings.ads.provider}</Text>
          <Text style={styles.infoText}>Recurring reminders: {recurringCount}</Text>
          <Text style={styles.infoText}>Calendar synced reminders: {syncedCalendarCount}</Text>
          <Text style={styles.infoText}>Calendar sync failures: {failedCalendarCount}</Text>
        </View>
      </SectionCard>

      <SectionCard
        title="Monetization Controls"
        subtitle="Internal-only ad config. Keep this out of the public settings surface."
      >
        <View style={styles.controlRow}>
          <Switch
            value={settings.ads.enabled}
            onValueChange={(value) =>
              updateSettings({
                ads: {
                  ...settings.ads,
                  enabled: value,
                },
              })
            }
            trackColor={{ false: '#D9D2C5', true: colors.primary }}
          />
          <View style={styles.controlText}>
            <Text style={styles.controlTitle}>Enable ads</Text>
            <Text style={styles.controlSubtitle}>
              Founder toggle for future monetization behavior.
            </Text>
          </View>
        </View>

        <View style={styles.controlCard}>
          <Text style={styles.controlCardTitle}>Ads provider</Text>
          <Text style={styles.controlCardSubtitle}>
            Prepared only. No real SDK is wired in this build.
          </Text>
        </View>
        <View style={styles.chipRow}>
          {adsProviders.map((provider) => (
            <Pressable
              key={provider}
              onPress={() =>
                updateSettings({
                  ads: {
                    ...settings.ads,
                    provider,
                  },
                })
              }
              style={[
                styles.chip,
                settings.ads.provider === provider && styles.chipActive,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  settings.ads.provider === provider && styles.chipTextActive,
                ]}
              >
                {provider === 'none' ? 'None' : 'AdMob'}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.controlRow}>
          <Switch
            value={settings.ads.homeBannerEnabled}
            onValueChange={(value) =>
              updateSettings({
                ads: {
                  ...settings.ads,
                  homeBannerEnabled: value,
                },
              })
            }
            trackColor={{ false: '#D9D2C5', true: colors.primary }}
          />
          <View style={styles.controlText}>
            <Text style={styles.controlTitle}>Home banner</Text>
            <Text style={styles.controlSubtitle}>
              Reserved for a future banner placement on Home.
            </Text>
          </View>
        </View>

        <View style={styles.controlCard}>
          <Text style={styles.controlCardTitle}>Interstitial every X actions</Text>
          <Text style={styles.controlCardSubtitle}>
            Controls future pacing for interstitial experiments.
          </Text>
        </View>
        <View style={styles.chipRow}>
          {interstitialOptions.map((value) => (
            <Pressable
              key={value}
              onPress={() =>
                updateSettings({
                  ads: {
                    ...settings.ads,
                    interstitialEveryActions: value,
                  },
                })
              }
              style={[
                styles.chip,
                settings.ads.interstitialEveryActions === value && styles.chipActive,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  settings.ads.interstitialEveryActions === value &&
                    styles.chipTextActive,
                ]}
              >
                {value === 0 ? 'None' : String(value)}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.controlRow}>
          <Switch
            value={settings.ads.hideAdsForFutureSubscribers}
            onValueChange={(value) =>
              updateSettings({
                ads: {
                  ...settings.ads,
                  hideAdsForFutureSubscribers: value,
                },
              })
            }
            trackColor={{ false: '#D9D2C5', true: colors.primary }}
          />
          <View style={styles.controlText}>
            <Text style={styles.controlTitle}>Hide ads for future subscribers</Text>
            <Text style={styles.controlSubtitle}>
              Keeps a clean premium path ready without another data migration.
            </Text>
          </View>
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
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  controlText: {
    flex: 1,
    gap: spacing.xs,
  },
  controlTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.text,
  },
  controlSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 20,
  },
  controlCard: {
    backgroundColor: '#EEF4FF',
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: '#D7E3FF',
  },
  controlCardTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.primaryDark,
  },
  controlCardSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 20,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    minWidth: 76,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.cardMuted,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  chipTextActive: {
    color: colors.white,
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
