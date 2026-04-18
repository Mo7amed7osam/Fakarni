import { useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as AuthSession from 'expo-auth-session';
import { GhostButton } from '../components/GhostButton';
import { getAppCopy } from '../content/appCopy';
import { SectionCard } from '../components/SectionCard';
import { useGhost } from '../context/GhostContext';
import {
  fetchGoogleCalendarProfile,
  getGoogleCalendarAuthConfig,
  getGoogleCalendarDiscovery,
  getGoogleCalendarScope,
  isGoogleCalendarConfigured,
} from '../services/calendar';
import { isAnalyticsConfigured } from '../services/analytics';
import { colors, fonts, radii, spacing } from '../theme';
import { RootStackParamList } from '../types';
import { getResponsiveContentWidth, isTabletWidth } from '../utils/layout';

const followUpDelayOptions = [10, 20, 30, 60];

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export function SettingsScreen({ navigation }: Props) {
  const {
    settings,
    acknowledgeAnalyticsNotice,
    updateSettings,
    setAnalyticsEnabled,
    notificationPermission,
    pendingPermissionReminders,
    requestNotificationAccess,
    openNotificationSettings,
    setAppleCalendarAutoSync,
    connectGoogleCalendar,
    disconnectGoogleCalendar,
  } = useGhost();
  const copy = getAppCopy(settings.uiLanguage);
  const { width } = useWindowDimensions();
  const tabletLayout = isTabletWidth(width);
  const contentMaxWidth = getResponsiveContentWidth(width, 980);
  const notificationsReady = notificationPermission === 'granted';
  const notificationActionLabel =
    notificationPermission === 'blocked'
      ? copy.settings.notificationActionBlocked
      : copy.settings.notificationActionAsk;
  const googleCalendarConfigured = isGoogleCalendarConfigured();
  const analyticsConfigured = isAnalyticsConfigured();
  const googleClientId =
    Platform.OS === 'ios'
      ? getGoogleCalendarAuthConfig().iosClientId
      : getGoogleCalendarAuthConfig().androidClientId;
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'voiceghost',
    path: 'oauthredirect',
  });
  const [googleBusy, setGoogleBusy] = useState(false);
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [analyticsBusy, setAnalyticsBusy] = useState(false);
  const [calendarNotice, setCalendarNotice] = useState('');
  const lastHandledGoogleCodeRef = useRef<string | null>(null);
  const [googleRequest, googleResponse, promptGoogleAuth] = AuthSession.useAuthRequest(
    {
      clientId: googleClientId ?? 'voiceghost-google-not-configured',
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      scopes: [
        'openid',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
        getGoogleCalendarScope(),
      ],
      usePKCE: true,
      extraParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
    googleCalendarConfigured ? getGoogleCalendarDiscovery() : null
  );

  async function handleNotificationAction() {
    if (notificationPermission === 'blocked') {
      await openNotificationSettings();
      return;
    }

    await requestNotificationAccess('settings');
  }

  async function handleGoogleConnect() {
    if (!googleCalendarConfigured || !googleRequest) {
      return;
    }

    setGoogleBusy(true);
    const result = await promptGoogleAuth();
    if (result.type !== 'success') {
      setGoogleBusy(false);
    }
  }

  async function handleGoogleDisconnect() {
    setGoogleBusy(true);
    await disconnectGoogleCalendar();
    setGoogleBusy(false);
  }

  async function handleAppleCalendarToggle(value: boolean) {
    setCalendarBusy(true);
    const result = await setAppleCalendarAutoSync(value);
    setCalendarBusy(false);
    setCalendarNotice(result.message ?? '');
  }

  async function handleAnalyticsToggle(value: boolean) {
    setAnalyticsBusy(true);
    await setAnalyticsEnabled(value);
    setAnalyticsBusy(false);
  }

  const appleCalendarEnabled = settings.appleCalendar.autoSyncEnabled;
  const appleCalendarStatus = settings.appleCalendar.permissionStatus;
  const appleCalendarStatusTitle = appleCalendarEnabled
    ? settings.uiLanguage === 'en'
      ? 'Sync is on'
      : 'المزامنة شغالة'
    : appleCalendarStatus === 'write_only' ||
        appleCalendarStatus === 'full_access' ||
        appleCalendarStatus === 'authorized'
      ? settings.uiLanguage === 'en'
        ? 'Ready to enable'
        : 'جاهزة للتفعيل'
      : appleCalendarStatus === 'denied'
        ? settings.uiLanguage === 'en'
          ? 'Access denied'
          : 'الوصول مرفوض'
        : appleCalendarStatus === 'restricted'
          ? settings.uiLanguage === 'en'
            ? 'Access restricted'
            : 'الوصول مقيّد'
          : settings.uiLanguage === 'en'
            ? 'Disabled'
            : 'غير مفعّلة';
  const appleCalendarStatusText = appleCalendarEnabled
    ? settings.uiLanguage === 'en'
      ? 'Every new reminder will save to Apple Calendar automatically in the background.'
      : 'أي تذكير جديد سيتحفظ في Apple Calendar تلقائيًا في الخلفية.'
    : appleCalendarStatus === 'denied'
      ? settings.uiLanguage === 'en'
        ? 'You can allow calendar access from system settings if you want reminders saved there.'
        : 'يمكنك السماح للتطبيق من إعدادات النظام إذا أردت حفظ التذكيرات في التقويم.'
      : appleCalendarStatus === 'restricted'
        ? settings.uiLanguage === 'en'
          ? 'This device currently does not allow calendar access for the app.'
          : 'هذا الجهاز لا يسمح للتطبيق باستخدام التقويم حاليًا.'
        : settings.uiLanguage === 'en'
          ? 'Enable it once and future reminders will save automatically without opening event UI.'
          : 'فعّلها مرة واحدة وسيتم حفظ التذكيرات القادمة تلقائيًا بدون فتح شاشة الحدث.';

  useEffect(() => {
    if (
      googleResponse?.type !== 'success' ||
      !googleResponse.params.code ||
      !googleRequest?.codeVerifier ||
      !googleClientId
    ) {
      return;
    }

    if (lastHandledGoogleCodeRef.current === googleResponse.params.code) {
      return;
    }

    lastHandledGoogleCodeRef.current = googleResponse.params.code;
    let cancelled = false;
    setGoogleBusy(true);

    void AuthSession.exchangeCodeAsync(
      {
        clientId: googleClientId,
        code: googleResponse.params.code,
        redirectUri,
        extraParams: {
          code_verifier: googleRequest.codeVerifier,
        },
      },
      getGoogleCalendarDiscovery()
    )
      .then(async (tokenResponse) => {
        const credentials = {
          accessToken: tokenResponse.accessToken,
          refreshToken: tokenResponse.refreshToken ?? undefined,
          expiresAt: Date.now() + (tokenResponse.expiresIn ?? 3600) * 1000,
        };
        const profile = await fetchGoogleCalendarProfile(tokenResponse.accessToken).catch(
          () => undefined
        );
        await connectGoogleCalendar(credentials, profile?.email);
      })
      .catch((error) => {
        if (__DEV__) {
          console.warn('Google Calendar auth failed', error);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setGoogleBusy(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [connectGoogleCalendar, googleClientId, googleRequest, googleResponse, redirectUri]);

  useEffect(() => {
    if (!settings.analytics.consentShown) {
      acknowledgeAnalyticsNotice();
    }
  }, [acknowledgeAnalyticsNotice, settings.analytics.consentShown]);

  useEffect(() => {
    if (!calendarNotice) {
      return;
    }

    const timeout = setTimeout(() => {
      setCalendarNotice('');
    }, 3200);

    return () => clearTimeout(timeout);
  }, [calendarNotice]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={[styles.contentInner, { maxWidth: contentMaxWidth }]}>
      <View style={styles.titleWrap}>
        <Text style={[styles.title, tabletLayout && styles.titleTablet]}>{copy.settings.title}</Text>
        <Text style={[styles.subtitle, tabletLayout && styles.subtitleTablet]}>{copy.settings.subtitle}</Text>
      </View>

      <SectionCard title={copy.settings.languageTitle} subtitle={copy.settings.languageSubtitle}>
        <View style={[styles.followUpCard, tabletLayout && styles.infoCardTablet]}>
          <Text style={[styles.followUpCardTitle, tabletLayout && styles.infoCardTitleTablet]}>
            {copy.settings.languageRowTitle}
          </Text>
          <Text style={[styles.followUpCardText, tabletLayout && styles.infoCardTextTablet]}>
            {copy.settings.languageRowSubtitle}
          </Text>
        </View>

        <View style={[styles.followUpChipRow, tabletLayout && styles.followUpChipRowTablet]}>
          {[
            { id: 'ar-EG', label: copy.settings.egyptianArabic },
            { id: 'en', label: copy.settings.english },
          ].map((option) => (
            <Pressable
              key={option.id}
              onPress={() => updateSettings({ uiLanguage: option.id as 'ar-EG' | 'en' })}
              style={[
                styles.followUpChip,
                tabletLayout && styles.followUpChipTablet,
                settings.uiLanguage === option.id && styles.followUpChipActive,
              ]}
            >
              <Text
                style={[
                  styles.followUpChipText,
                  tabletLayout && styles.followUpChipTextTablet,
                  settings.uiLanguage === option.id && styles.followUpChipTextActive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </SectionCard>

      <SectionCard title={copy.settings.soundAlertsTitle}>
        <View style={styles.row}>
          <Switch
            value={settings.ttsEnabled}
            onValueChange={(value) => updateSettings({ ttsEnabled: value })}
            trackColor={{ false: '#D9D2C5', true: colors.primary }}
          />
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, tabletLayout && styles.rowTitleTablet]}>{copy.settings.ttsTitle}</Text>
            <Text style={[styles.rowSubtitle, tabletLayout && styles.rowSubtitleTablet]}>{copy.settings.ttsSubtitle}</Text>
          </View>
        </View>

        <View style={[styles.notificationStatusCard, tabletLayout && styles.infoCardTablet]}>
          <Text style={[styles.notificationStatusTitle, tabletLayout && styles.infoCardTitleTablet]}>
            {notificationsReady
              ? copy.settings.notificationReady
              : copy.settings.notificationNeedEnable}
          </Text>
          <Text style={[styles.notificationStatusText, tabletLayout && styles.infoCardTextTablet]}>
            {notificationsReady
              ? copy.settings.notificationsOn
              : pendingPermissionReminders > 0
                ? copy.settings.notificationWaitingMany(pendingPermissionReminders)
                : copy.settings.notificationNeedText}
          </Text>
        </View>

        <GhostButton
          label={notificationActionLabel}
          variant="secondary"
          onPress={() => {
            void handleNotificationAction();
          }}
        />
      </SectionCard>

      <SectionCard
        title={copy.settings.smartFollowTitle}
        subtitle={copy.settings.smartFollowSubtitle}
      >
        <View style={styles.row}>
          <Switch
            value={settings.followUpEnabled}
            onValueChange={(value) => updateSettings({ followUpEnabled: value })}
            trackColor={{ false: '#D9D2C5', true: colors.primary }}
          />
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, tabletLayout && styles.rowTitleTablet]}>{copy.settings.oneNudge}</Text>
            <Text style={[styles.rowSubtitle, tabletLayout && styles.rowSubtitleTablet]}>{copy.settings.oneNudgeSubtitle}</Text>
          </View>
        </View>

        <View style={[styles.followUpCard, tabletLayout && styles.infoCardTablet]}>
          <Text style={[styles.followUpCardTitle, tabletLayout && styles.infoCardTitleTablet]}>
            {copy.settings.followDelayTitle}
          </Text>
          <Text style={[styles.followUpCardText, tabletLayout && styles.infoCardTextTablet]}>
            {copy.settings.followDelayText(settings.followUpDelayMinutes)}
          </Text>
        </View>

        <View style={[styles.followUpChipRow, tabletLayout && styles.followUpChipRowTablet]}>
          {followUpDelayOptions.map((minutes) => (
            <Pressable
              key={minutes}
              onPress={() => updateSettings({ followUpDelayMinutes: minutes })}
              style={[
                styles.followUpChip,
                tabletLayout && styles.followUpChipTablet,
                settings.followUpDelayMinutes === minutes && styles.followUpChipActive,
              ]}
            >
              <Text
                style={[
                  styles.followUpChipText,
                  tabletLayout && styles.followUpChipTextTablet,
                  settings.followUpDelayMinutes === minutes &&
                    styles.followUpChipTextActive,
                ]}
              >
                {minutes === 60
                  ? settings.uiLanguage === 'en'
                    ? '1h'
                    : 'ساعة'
                  : settings.uiLanguage === 'en'
                    ? `${minutes}m`
                    : `${minutes} د`}
              </Text>
            </Pressable>
          ))}
        </View>
      </SectionCard>

      {Platform.OS === 'ios' ? (
        <SectionCard
          title="Apple Calendar"
          subtitle={copy.settings.appleCalendarSubtitle}
        >
          <View style={styles.row}>
            <Switch
              value={appleCalendarEnabled}
              onValueChange={(value) => {
                void handleAppleCalendarToggle(value);
              }}
              disabled={calendarBusy}
              trackColor={{ false: '#D9D2C5', true: colors.primary }}
            />
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, tabletLayout && styles.rowTitleTablet]}>{copy.settings.appleCalendarTitle}</Text>
              <Text style={[styles.rowSubtitle, tabletLayout && styles.rowSubtitleTablet]}>{copy.settings.appleCalendarHint}</Text>
            </View>
          </View>

          <View style={[styles.calendarStatusCard, tabletLayout && styles.infoCardTablet]}>
            <Text style={[styles.calendarStatusTitle, tabletLayout && styles.infoCardTitleTablet]}>
              {appleCalendarStatusTitle}
            </Text>
            <Text style={[styles.calendarStatusText, tabletLayout && styles.infoCardTextTablet]}>
              {appleCalendarStatusText}
            </Text>
          </View>

          {calendarNotice ? (
            <View style={[styles.inlineNotice, tabletLayout && styles.inlineNoticeTablet]}>
              <Text style={[styles.inlineNoticeText, tabletLayout && styles.inlineNoticeTextTablet]}>
                {calendarNotice}
              </Text>
            </View>
          ) : null}

          {appleCalendarStatus === 'denied' || appleCalendarStatus === 'restricted' ? (
            <GhostButton
              label={copy.common.openSystemSettings}
              variant="secondary"
              onPress={() => {
                void openNotificationSettings();
              }}
            />
          ) : null}
        </SectionCard>
      ) : (
        <SectionCard
          title="Google Calendar"
          subtitle={copy.settings.googleCalendarSubtitle}
        >
          <View style={[styles.googleStatusCard, tabletLayout && styles.infoCardTablet]}>
            <Text style={[styles.googleStatusTitle, tabletLayout && styles.infoCardTitleTablet]}>
              {settings.googleCalendar.connected
                ? settings.uiLanguage === 'en'
                  ? 'Account connected'
                  : 'الحساب متصل'
                : settings.uiLanguage === 'en'
                  ? 'Account not connected'
                  : 'الحساب غير متصل'}
            </Text>
            <Text style={[styles.googleStatusText, tabletLayout && styles.infoCardTextTablet]}>
              {settings.googleCalendar.connected
                ? settings.googleCalendar.email ??
                  (settings.uiLanguage === 'en'
                    ? 'Google Calendar access is saved on this device.'
                    : 'تم حفظ صلاحية Google Calendar على هذا الجهاز.')
                : googleCalendarConfigured
                  ? settings.uiLanguage === 'en'
                    ? 'Connect Google once and events will be created in the background.'
                    : 'اربط حساب Google مرة واحدة ليتم إنشاء الأحداث في الخلفية.'
                  : settings.uiLanguage === 'en'
                    ? 'Google Calendar connection is not configured in this build yet.'
                    : 'ربط Google Calendar غير متاح في هذا البناء بعد.'}
            </Text>
          </View>

          {settings.googleCalendar.connected ? (
            <GhostButton
              label={googleBusy ? copy.settings.disconnecting : copy.settings.disconnectGoogle}
              variant="secondary"
              disabled={googleBusy}
              onPress={() => {
                void handleGoogleDisconnect();
              }}
            />
          ) : (
            <GhostButton
              label={googleBusy ? copy.settings.connecting : copy.settings.connectGoogle}
              variant="secondary"
              disabled={googleBusy || !googleCalendarConfigured || !googleRequest}
              onPress={() => {
                void handleGoogleConnect();
              }}
            />
          )}
        </SectionCard>
      )}

      <SectionCard
        title={copy.settings.trustTitle}
        subtitle={copy.settings.trustSubtitle}
      >
        <View style={styles.row}>
          <Switch
            value={settings.analytics.enabled}
            onValueChange={(value) => {
              void handleAnalyticsToggle(value);
            }}
            disabled={analyticsBusy || !analyticsConfigured}
            trackColor={{ false: '#D9D2C5', true: colors.primary }}
          />
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, tabletLayout && styles.rowTitleTablet]}>{copy.settings.analyticsToggleTitle}</Text>
            <Text style={[styles.rowSubtitle, tabletLayout && styles.rowSubtitleTablet]}>{copy.settings.analyticsToggleSubtitle}</Text>
          </View>
        </View>

        <View style={[styles.analyticsCard, tabletLayout && styles.infoCardTablet]}>
            <Text style={[styles.analyticsCardTitle, tabletLayout && styles.infoCardTitleTablet]}>
            {!analyticsConfigured
              ? settings.uiLanguage === 'en'
                ? 'Analytics unavailable in this build'
                : 'التحليلات غير متاحة في هذه النسخة'
              : settings.analytics.enabled
              ? settings.uiLanguage === 'en'
                ? 'Analytics enabled'
                : 'التحليلات مفعّلة'
              : settings.uiLanguage === 'en'
                ? 'Analytics disabled'
                : 'التحليلات متوقفة'}
          </Text>
          <Text style={[styles.analyticsCardText, tabletLayout && styles.infoCardTextTablet]}>
            {!analyticsConfigured
              ? settings.uiLanguage === 'en'
                ? 'This release build is not configured to send anonymous analytics.'
                : 'هذه النسخة غير مهيأة لإرسال تحليلات مجهولة.'
              : settings.uiLanguage === 'en'
              ? 'Raw speech text and reminder titles are not sent. You can turn analytics off here at any time.'
              : 'لا يتم إرسال النص الخام أو اسم التذكير. ويمكنك إيقاف التحليلات في أي وقت من هنا.'}
          </Text>
        </View>
        <Pressable
          onPress={() => navigation.navigate('HelpFaq')}
          style={[styles.linkCard, tabletLayout && styles.linkCardTablet]}
        >
          <Text style={[styles.linkLabel, tabletLayout && styles.linkLabelTablet]}>
            {copy.settings.supportTitle}
          </Text>
          <Text style={[styles.linkMeta, tabletLayout && styles.linkMetaTablet]}>
            {copy.settings.supportSubtitle}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => navigation.navigate('HelpFaq', { openFeedback: true })}
          style={[styles.linkCard, tabletLayout && styles.linkCardTablet]}
        >
          <Text style={[styles.linkLabel, tabletLayout && styles.linkLabelTablet]}>
            {copy.settings.feedbackTitle}
          </Text>
          <Text style={[styles.linkMeta, tabletLayout && styles.linkMetaTablet]}>
            {copy.settings.feedbackSubtitle}
          </Text>
        </Pressable>
      </SectionCard>

      <View style={[styles.signatureBlock, tabletLayout && styles.signatureBlockTablet]}>
        <Text style={[styles.signatureLabel, tabletLayout && styles.signatureLabelTablet]}>
          {copy.settings.signatureLabel}
        </Text>
        <Text style={[styles.signatureName, tabletLayout && styles.signatureNameTablet]}>
          Mohamed Hosam
        </Text>
        <Text style={[styles.signatureCompany, tabletLayout && styles.signatureCompanyTablet]}>
          Quantara Tech
        </Text>
      </View>
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
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: 48,
  },
  contentInner: {
    width: '100%',
    gap: spacing.md,
  },
  titleWrap: {
    gap: 4,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.text,
    maxWidth: 280,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  titleTablet: {
    fontSize: 28,
    lineHeight: 40,
    maxWidth: 420,
  },
  subtitle: {
    fontFamily: fonts.medium,
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
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  rowText: {
    flex: 1,
    gap: spacing.xs,
  },
  rowTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  rowTitleTablet: {
    fontSize: 20,
    lineHeight: 30,
  },
  rowSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  rowSubtitleTablet: {
    fontSize: 16,
    lineHeight: 26,
  },
  notificationStatusCard: {
    backgroundColor: '#FFF9ED',
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(154,107,0,0.08)',
  },
  notificationStatusTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.warning,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  notificationStatusText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.warning,
    textAlign: 'right',
    lineHeight: 20,
    writingDirection: 'rtl',
  },
  followUpCard: {
    backgroundColor: '#F6FAFF',
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: '#E3EFFC',
  },
  followUpCardTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.primaryDark,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  followUpCardText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'right',
    lineHeight: 20,
    writingDirection: 'rtl',
  },
  followUpChipRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  followUpChipRowTablet: {
    gap: spacing.md,
  },
  followUpChip: {
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
  followUpChipTablet: {
    minWidth: 108,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  followUpChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  followUpChipText: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 13,
    writingDirection: 'rtl',
  },
  followUpChipTextTablet: {
    fontSize: 17,
  },
  followUpChipTextActive: {
    color: colors.white,
  },
  analyticsCard: {
    backgroundColor: '#F7FAFF',
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: '#E6ECFB',
  },
  analyticsCardTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.primaryDark,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  analyticsCardText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'right',
    lineHeight: 20,
    writingDirection: 'rtl',
  },
  googleStatusCard: {
    backgroundColor: '#F7FAFF',
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: '#E6ECFB',
  },
  googleStatusTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.primaryDark,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  googleStatusText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'right',
    lineHeight: 20,
    writingDirection: 'rtl',
  },
  calendarStatusCard: {
    backgroundColor: '#F7FBFA',
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: '#E2ECE8',
  },
  calendarStatusTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  calendarStatusText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'right',
    lineHeight: 20,
    writingDirection: 'rtl',
  },
  inlineNotice: {
    backgroundColor: colors.warningSoft,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(154,107,0,0.12)',
  },
  inlineNoticeTablet: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  inlineNoticeText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.warning,
    textAlign: 'right',
    lineHeight: 20,
    writingDirection: 'rtl',
  },
  inlineNoticeTextTablet: {
    fontSize: 16,
    lineHeight: 26,
  },
  linkCard: {
    backgroundColor: colors.cardMuted,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: spacing.xs,
  },
  linkCardTablet: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  linkLabel: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  linkLabelTablet: {
    fontSize: 20,
    lineHeight: 30,
  },
  linkMeta: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  linkMetaTablet: {
    fontSize: 16,
    lineHeight: 26,
  },
  versionRow: {
    marginTop: spacing.sm,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  versionLabel: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  versionChip: {
    backgroundColor: colors.cardMuted,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.line,
  },
  versionChipText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
  },
  signatureBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    gap: 4,
  },
  signatureBlockTablet: {
    paddingVertical: spacing.xl,
    gap: spacing.xs,
  },
  signatureLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 0.3,
  },
  signatureLabelTablet: {
    fontSize: 14,
  },
  signatureName: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.text,
  },
  signatureNameTablet: {
    fontSize: 22,
    lineHeight: 32,
  },
  signatureCompany: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
  },
  signatureCompanyTablet: {
    fontSize: 16,
    lineHeight: 26,
  },
  infoCardTablet: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  infoCardTitleTablet: {
    fontSize: 18,
    lineHeight: 28,
  },
  infoCardTextTablet: {
    fontSize: 16,
    lineHeight: 26,
  },
});
