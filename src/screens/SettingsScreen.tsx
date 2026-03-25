import { useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as AuthSession from 'expo-auth-session';
import * as Application from 'expo-application';
import { LinearGradient } from 'expo-linear-gradient';
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
import { colors, fonts, radii, spacing } from '../theme';
import { AdsProvider, RootStackParamList } from '../types';
import { getGhostModeLabel } from '../utils/ghostPersonality';

const ghostModes = ['sassy', 'coach', 'mom', 'calm'] as const;
const followUpDelayOptions = [10, 20, 30, 60];
const adsProviders: AdsProvider[] = ['none', 'admob'];
const interstitialOptions = [0, 3, 5, 10];

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
  const notificationsReady = notificationPermission === 'granted';
  const notificationActionLabel =
    notificationPermission === 'blocked'
      ? copy.settings.notificationActionBlocked
      : copy.settings.notificationActionAsk;
  const googleCalendarConfigured = isGoogleCalendarConfigured();
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
  const founderTapCountRef = useRef(0);
  const founderTapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appVersion = Application.nativeApplicationVersion ?? 'dev';
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

  function handleFounderTap() {
    founderTapCountRef.current += 1;
    if (founderTapTimeoutRef.current) {
      clearTimeout(founderTapTimeoutRef.current);
    }

    if (founderTapCountRef.current >= 7) {
      founderTapCountRef.current = 0;
      navigation.navigate('FounderDashboard');
      return;
    }

    founderTapTimeoutRef.current = setTimeout(() => {
      founderTapCountRef.current = 0;
      founderTapTimeoutRef.current = null;
    }, 1600);
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

  useEffect(() => {
    return () => {
      if (founderTapTimeoutRef.current) {
        clearTimeout(founderTapTimeoutRef.current);
      }
    };
  }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable onPress={handleFounderTap} style={styles.titleWrap}>
        <Text style={styles.title}>{copy.settings.title}</Text>
        <Text style={styles.subtitle}>{copy.settings.subtitle}</Text>
      </Pressable>

      <LinearGradient colors={['#0D92BF', '#18B7E8']} style={styles.heroCard}>
        <Text style={styles.heroLabel}>{copy.settings.appStatus}</Text>
        <Text style={styles.heroValue}>
          {notificationsReady ? copy.settings.ready : copy.settings.needsStep}
        </Text>
        <View style={styles.heroRow}>
          <View style={styles.heroPill}>
            <Text style={styles.heroPillText}>{copy.settings.egyptianVoice}</Text>
          </View>
          <View style={styles.heroPill}>
            <Text style={styles.heroPillText}>
              {notificationsReady
                ? copy.settings.notificationsOn
                : copy.settings.notificationsOff}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <SectionCard
        title={copy.settings.essentialsTitle}
        subtitle={copy.settings.essentialsSubtitle}
      >
        <View style={styles.planCard}>
          <Text style={styles.planValue}>{copy.settings.promiseTitle}</Text>
          <Text style={styles.planText}>{copy.settings.promiseText}</Text>
        </View>
      </SectionCard>

      <SectionCard title={copy.settings.languageTitle} subtitle={copy.settings.languageSubtitle}>
        <View style={styles.followUpCard}>
          <Text style={styles.followUpCardTitle}>{copy.settings.languageRowTitle}</Text>
          <Text style={styles.followUpCardText}>{copy.settings.languageRowSubtitle}</Text>
        </View>

        <View style={styles.followUpChipRow}>
          {[
            { id: 'ar-EG', label: copy.settings.egyptianArabic },
            { id: 'en', label: copy.settings.english },
          ].map((option) => (
            <Pressable
              key={option.id}
              onPress={() => updateSettings({ uiLanguage: option.id as 'ar-EG' | 'en' })}
              style={[
                styles.followUpChip,
                settings.uiLanguage === option.id && styles.followUpChipActive,
              ]}
            >
              <Text
                style={[
                  styles.followUpChipText,
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
            <Text style={styles.rowTitle}>{copy.settings.ttsTitle}</Text>
            <Text style={styles.rowSubtitle}>{copy.settings.ttsSubtitle}</Text>
          </View>
        </View>

        <View style={styles.notificationStatusCard}>
          <Text style={styles.notificationStatusTitle}>
            {notificationsReady
              ? copy.settings.notificationReady
              : copy.settings.notificationNeedEnable}
          </Text>
          <Text style={styles.notificationStatusText}>
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
            <Text style={styles.rowTitle}>{copy.settings.oneNudge}</Text>
            <Text style={styles.rowSubtitle}>{copy.settings.oneNudgeSubtitle}</Text>
          </View>
        </View>

        <View style={styles.followUpCard}>
          <Text style={styles.followUpCardTitle}>{copy.settings.followDelayTitle}</Text>
          <Text style={styles.followUpCardText}>
            {copy.settings.followDelayText(settings.followUpDelayMinutes)}
          </Text>
        </View>

        <View style={styles.followUpChipRow}>
          {followUpDelayOptions.map((minutes) => (
            <Pressable
              key={minutes}
              onPress={() => updateSettings({ followUpDelayMinutes: minutes })}
              style={[
                styles.followUpChip,
                settings.followUpDelayMinutes === minutes && styles.followUpChipActive,
              ]}
            >
              <Text
                style={[
                  styles.followUpChipText,
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
              <Text style={styles.rowTitle}>{copy.settings.appleCalendarTitle}</Text>
              <Text style={styles.rowSubtitle}>{copy.settings.appleCalendarHint}</Text>
            </View>
          </View>

          <View style={styles.calendarStatusCard}>
            <Text style={styles.calendarStatusTitle}>{appleCalendarStatusTitle}</Text>
            <Text style={styles.calendarStatusText}>{appleCalendarStatusText}</Text>
          </View>

          {calendarNotice ? (
            <View style={styles.inlineNotice}>
              <Text style={styles.inlineNoticeText}>{calendarNotice}</Text>
            </View>
          ) : null}

          {appleCalendarStatus === 'denied' ? (
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
          <View style={styles.googleStatusCard}>
            <Text style={styles.googleStatusTitle}>
              {settings.googleCalendar.connected
                ? settings.uiLanguage === 'en'
                  ? 'Account connected'
                  : 'الحساب متصل'
                : settings.uiLanguage === 'en'
                  ? 'Account not connected'
                  : 'الحساب غير متصل'}
            </Text>
            <Text style={styles.googleStatusText}>
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
        title={copy.settings.analyticsTitle}
        subtitle={copy.settings.analyticsSubtitle}
      >
        <View style={styles.row}>
          <Switch
            value={settings.analytics.enabled}
            onValueChange={(value) => {
              void handleAnalyticsToggle(value);
            }}
            disabled={analyticsBusy}
            trackColor={{ false: '#D9D2C5', true: colors.primary }}
          />
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{copy.settings.analyticsToggleTitle}</Text>
            <Text style={styles.rowSubtitle}>{copy.settings.analyticsToggleSubtitle}</Text>
          </View>
        </View>

        <View style={styles.analyticsCard}>
          <Text style={styles.analyticsCardTitle}>
            {settings.analytics.enabled
              ? settings.uiLanguage === 'en'
                ? 'Analytics enabled'
                : 'التحليلات مفعّلة'
              : settings.uiLanguage === 'en'
                ? 'Analytics disabled'
                : 'التحليلات متوقفة'}
          </Text>
          <Text style={styles.analyticsCardText}>
            {settings.uiLanguage === 'en'
              ? 'Raw speech text and reminder titles are not sent. You can turn analytics off here at any time.'
              : 'لا يتم إرسال النص الخام أو اسم التذكير. ويمكنك إيقاف التحليلات في أي وقت من هنا.'}
          </Text>
        </View>
      </SectionCard>

      <SectionCard
        title={copy.settings.internalToolsTitle}
        subtitle={copy.settings.internalToolsSubtitle}
      >
        <GhostButton
          label={copy.settings.openFounderDashboard}
          variant="secondary"
          onPress={() => navigation.navigate('FounderDashboard')}
        />
      </SectionCard>

      <SectionCard
        title={copy.settings.ghostPersonalityTitle}
        subtitle={copy.settings.ghostPersonalitySubtitle}
      >
        <View style={styles.modeRow}>
          {ghostModes.map((mode) => (
            <Pressable
              key={mode}
              onPress={() => updateSettings({ ghostMode: mode })}
              style={[
                styles.modeChip,
                settings.ghostMode === mode && styles.modeChipActive,
              ]}
            >
              <Text
                style={[
                  styles.modeChipText,
                  settings.ghostMode === mode && styles.modeChipTextActive,
                ]}
              >
                {getGhostModeLabel(mode, settings.uiLanguage)}
              </Text>
            </Pressable>
          ))}
        </View>
      </SectionCard>

      <SectionCard title={copy.settings.helpPrivacyTitle}>
        <Pressable onPress={() => navigation.navigate('HelpFaq')} style={styles.linkCard}>
          <Text style={styles.linkLabel}>{copy.settings.helpPrivacyLink}</Text>
        </Pressable>
      </SectionCard>

      <SectionCard title={copy.settings.adsTitle} subtitle={copy.settings.adsSubtitle}>
        <View style={styles.row}>
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
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{copy.settings.adsEnabled}</Text>
            <Text style={styles.rowSubtitle}>{copy.settings.adsEnabledSubtitle}</Text>
          </View>
        </View>

        <View style={styles.followUpCard}>
          <Text style={styles.followUpCardTitle}>{copy.settings.adsProvider}</Text>
        </View>
        <View style={styles.followUpChipRow}>
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
                styles.followUpChip,
                settings.ads.provider === provider && styles.followUpChipActive,
              ]}
            >
              <Text
                style={[
                  styles.followUpChipText,
                  settings.ads.provider === provider && styles.followUpChipTextActive,
                ]}
              >
                {provider === 'none' ? 'None' : 'AdMob'}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.row}>
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
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{copy.settings.homeBanner}</Text>
            <Text style={styles.rowSubtitle}>{copy.settings.homeBannerSubtitle}</Text>
          </View>
        </View>

        <View style={styles.followUpCard}>
          <Text style={styles.followUpCardTitle}>{copy.settings.interstitialEvery}</Text>
        </View>
        <View style={styles.followUpChipRow}>
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
                styles.followUpChip,
                settings.ads.interstitialEveryActions === value && styles.followUpChipActive,
              ]}
            >
              <Text
                style={[
                  styles.followUpChipText,
                  settings.ads.interstitialEveryActions === value &&
                    styles.followUpChipTextActive,
                ]}
              >
                {value === 0 ? copy.settings.noInterstitial : value}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.row}>
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
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{copy.settings.hideForSubscribers}</Text>
            <Text style={styles.rowSubtitle}>{copy.settings.hideForSubscribersSubtitle}</Text>
          </View>
        </View>
      </SectionCard>

      <Pressable onPress={handleFounderTap} style={styles.versionChip}>
        <Text style={styles.versionChipText}>v{appVersion}</Text>
      </Pressable>
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
  titleWrap: {
    gap: spacing.xs,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.text,
    maxWidth: 280,
    textAlign: 'right',
    writingDirection: 'rtl',
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
    gap: spacing.md,
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
  },
  heroValue: {
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 34,
  },
  heroRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  heroPill: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  heroPillText: {
    color: colors.white,
    fontFamily: fonts.semibold,
    fontSize: 12,
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
  rowSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  notificationStatusCard: {
    backgroundColor: colors.warningSoft,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(154,107,0,0.12)',
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
    backgroundColor: '#EEF7FF',
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: '#D3E9FF',
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
  followUpChipTextActive: {
    color: colors.white,
  },
  analyticsCard: {
    backgroundColor: '#EEF4FF',
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: '#D7E3FF',
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
    backgroundColor: '#EEF4FF',
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: '#D7E3FF',
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
    backgroundColor: '#F2F7F6',
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: '#D5E7E0',
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
  inlineNoticeText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.warning,
    textAlign: 'right',
    lineHeight: 20,
    writingDirection: 'rtl',
  },
  planCard: {
    backgroundColor: '#E9F8FE',
    borderRadius: radii.md,
    padding: spacing.lg,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: '#CBEAF7',
  },
  planValue: {
    fontFamily: fonts.bold,
    fontSize: 24,
    color: colors.primaryDark,
    textAlign: 'right',
  },
  planText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'right',
    lineHeight: 22,
    writingDirection: 'rtl',
  },
  linkCard: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
  },
  linkLabel: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  versionChip: {
    alignSelf: 'center',
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
  modeRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  modeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.cardMuted,
  },
  modeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modeChipText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.text,
    writingDirection: 'rtl',
  },
  modeChipTextActive: {
    color: colors.white,
  },
});
