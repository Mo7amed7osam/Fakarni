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
import { LinearGradient } from 'expo-linear-gradient';
import { GhostButton } from '../components/GhostButton';
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
import { RootStackParamList } from '../types';
import { getGhostModeLabel } from '../utils/ghostPersonality';

const ghostModes = ['sassy', 'coach', 'mom', 'calm'] as const;

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export function SettingsScreen({ navigation }: Props) {
  const {
    settings,
    updateSettings,
    notificationPermission,
    pendingPermissionReminders,
    requestNotificationAccess,
    openNotificationSettings,
    setAppleCalendarAutoSync,
    connectGoogleCalendar,
    disconnectGoogleCalendar,
  } = useGhost();
  const notificationsReady = notificationPermission === 'granted';
  const notificationActionLabel =
    notificationPermission === 'blocked' ? 'افتح إعدادات النظام' : 'فعّل الإشعارات';
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

    await requestNotificationAccess();
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

  const appleCalendarEnabled = settings.appleCalendar.autoSyncEnabled;
  const appleCalendarStatus = settings.appleCalendar.permissionStatus;
  const appleCalendarStatusTitle = appleCalendarEnabled
    ? 'المزامنة شغالة'
    : appleCalendarStatus === 'write_only' ||
        appleCalendarStatus === 'full_access' ||
        appleCalendarStatus === 'authorized'
      ? 'جاهزة للتفعيل'
      : appleCalendarStatus === 'denied'
        ? 'الوصول مرفوض'
        : appleCalendarStatus === 'restricted'
          ? 'الوصول مقيّد'
          : 'غير مفعّلة';
  const appleCalendarStatusText = appleCalendarEnabled
    ? 'أي تذكير جديد سيتحفظ في Apple Calendar تلقائيًا في الخلفية.'
    : appleCalendarStatus === 'denied'
      ? 'يمكنك السماح للتطبيق من إعدادات النظام إذا أردت حفظ التذكيرات في التقويم.'
      : appleCalendarStatus === 'restricted'
        ? 'هذا الجهاز لا يسمح للتطبيق باستخدام التقويم حاليًا.'
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
      <Text style={styles.title}>إعدادات VoiceGhost</Text>
      <Text style={styles.subtitle}>
        فعّل الأساسيات مرة واحدة وخلي التطبيق يشتغل بالصوت بأقل احتكاك ممكن.
      </Text>

      <LinearGradient colors={['#0D92BF', '#18B7E8']} style={styles.heroCard}>
        <Text style={styles.heroLabel}>حالة التطبيق</Text>
        <Text style={styles.heroValue}>{notificationsReady ? 'جاهز' : 'يحتاج خطوة'}</Text>
        <View style={styles.heroRow}>
          <View style={styles.heroPill}>
            <Text style={styles.heroPillText}>صوت عربي</Text>
          </View>
          <View style={styles.heroPill}>
            <Text style={styles.heroPillText}>
              {notificationsReady ? 'إشعارات مفعّلة' : 'الإشعارات غير مكتملة'}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <SectionCard title="الصوت والتنبيهات">
        <View style={styles.row}>
          <Switch
            value={settings.ttsEnabled}
            onValueChange={(value) => updateSettings({ ttsEnabled: value })}
            trackColor={{ false: '#D9D2C5', true: colors.primary }}
          />
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>تشغيل التذكير بصوت عربي</Text>
            <Text style={styles.rowSubtitle}>
              يعمل أثناء فتح التطبيق أو عند الدخول من الإشعار.
            </Text>
          </View>
        </View>

        <View style={styles.notificationStatusCard}>
          <Text style={styles.notificationStatusTitle}>
            {notificationsReady ? 'الإشعارات شغالة' : 'الإشعارات تحتاج تفعيل'}
          </Text>
          <Text style={styles.notificationStatusText}>
            {notificationsReady
              ? 'أي تذكير جديد سيتم ربطه بالإشعار تلقائيًا.'
              : pendingPermissionReminders > 0
                ? `يوجد ${pendingPermissionReminders} تذكيرات محفوظة بانتظار الإذن ليتم جدولة إشعاراتها.`
                : 'فعّل الإشعارات حتى تصل التذكيرات في وقتها.'}
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

      {Platform.OS === 'ios' ? (
        <SectionCard
          title="Apple Calendar"
          subtitle="اختياري. فعّلها من هنا مرة واحدة وسيتم حفظ التذكيرات الجديدة تلقائيًا."
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
              <Text style={styles.rowTitle}>أضف التذكيرات إلى Apple Calendar</Text>
              <Text style={styles.rowSubtitle}>
                يتم الحفظ في الخلفية بدون فتح شاشة إنشاء حدث.
              </Text>
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
              label="افتح إعدادات النظام"
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
          subtitle="اختياري. على Android سيُستخدم Google Calendar بدل تقويم الجهاز إذا كان متصلًا."
        >
          <View style={styles.googleStatusCard}>
            <Text style={styles.googleStatusTitle}>
              {settings.googleCalendar.connected ? 'الحساب متصل' : 'الحساب غير متصل'}
            </Text>
            <Text style={styles.googleStatusText}>
              {settings.googleCalendar.connected
                ? settings.googleCalendar.email ?? 'تم حفظ صلاحية Google Calendar على هذا الجهاز.'
                : googleCalendarConfigured
                  ? 'اربط حساب Google مرة واحدة ليتم إنشاء الأحداث في الخلفية.'
                  : 'ربط Google Calendar غير متاح في هذا البناء بعد.'}
            </Text>
          </View>

          {settings.googleCalendar.connected ? (
            <GhostButton
              label={googleBusy ? 'جارِ الفصل...' : 'افصل Google Calendar'}
              variant="secondary"
              disabled={googleBusy}
              onPress={() => {
                void handleGoogleDisconnect();
              }}
            />
          ) : (
            <GhostButton
              label={googleBusy ? 'جارِ الربط...' : 'اربط Google Calendar'}
              variant="secondary"
              disabled={googleBusy || !googleCalendarConfigured || !googleRequest}
              onPress={() => {
                void handleGoogleConnect();
              }}
            />
          )}
        </SectionCard>
      )}

      <SectionCard title="شخصية الجوست" subtitle="اختار الردود اللي تناسبك أكتر">
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
                {getGhostModeLabel(mode)}
              </Text>
            </Pressable>
          ))}
        </View>
      </SectionCard>

      <SectionCard title="جاهزية النسخة">
        <View style={styles.planCard}>
          <Text style={styles.planValue}>Voice-first</Text>
          <Text style={styles.planText}>
            التجربة الأساسية الآن مبنية حول: دوس، اتكلم، راجع بسرعة، وخلاص.
          </Text>
        </View>
      </SectionCard>

      <SectionCard title="المساعدة والخصوصية">
        <Pressable onPress={() => navigation.navigate('HelpFaq')} style={styles.linkCard}>
          <Text style={styles.linkLabel}>الأسئلة الشائعة، الخصوصية، والدعم</Text>
        </Pressable>
      </SectionCard>
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
