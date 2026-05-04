const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

function loadNotificationsModule({
  platform = 'ios',
  permissions = { granted: false, canAskAgain: true },
} = {}) {
  const notificationsPath = require.resolve('../src/services/notifications.ts');
  delete require.cache[notificationsPath];

  const calls = {
    requestPermissionsAsync: [],
    setNotificationChannelAsync: [],
    scheduleNotificationAsync: [],
  };

  const notificationsMock = {
    SchedulableTriggerInputTypes: {
      DAILY: 'daily',
      WEEKLY: 'weekly',
      DATE: 'date',
    },
    AndroidImportance: {
      MAX: 'max',
    },
    getPermissionsAsync: async () => permissions,
    requestPermissionsAsync: async (options) => {
      calls.requestPermissionsAsync.push(options);
      return { granted: true, canAskAgain: true };
    },
    setNotificationChannelAsync: async (...args) => {
      calls.setNotificationChannelAsync.push(args);
    },
    scheduleNotificationAsync: async (request) => {
      calls.scheduleNotificationAsync.push(request);
      return 'notif-1';
    },
    setNotificationHandler: () => {},
    setNotificationCategoryAsync: async () => {},
    cancelScheduledNotificationAsync: async () => {},
    getAllScheduledNotificationsAsync: async () => [],
    getLastNotificationResponseAsync: async () => null,
    clearLastNotificationResponseAsync: async () => {},
  };

  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'expo-notifications') {
      return notificationsMock;
    }

    if (request === 'expo-speech') {
      return {
        stop() {},
        speak() {},
      };
    }

    if (request === 'react-native') {
      return {
        Platform: { OS: platform },
        Linking: {
          openSettings: async () => {},
        },
      };
    }

    return originalLoad(request, parent, isMain);
  };

  try {
    return {
      module: require(notificationsPath),
      calls,
    };
  } finally {
    Module._load = originalLoad;
  }
}

test('iOS notification permission request explicitly asks for sound', async () => {
  const { module, calls } = loadNotificationsModule({
    platform: 'ios',
    permissions: { granted: false, canAskAgain: true },
  });

  const result = await module.requestNotificationPermission();

  assert.equal(result, 'granted');
  assert.deepEqual(calls.requestPermissionsAsync[0], {
    ios: {
      allowAlert: true,
      allowBadge: false,
      allowSound: true,
    },
  });
});

test('scheduled reminder notifications carry default sound', async () => {
  const { module, calls } = loadNotificationsModule({
    platform: 'ios',
    permissions: { granted: true, canAskAgain: true },
  });

  await module.scheduleReminderNotification({
    id: 'r1',
    title: 'روح للدكتور',
    remindAt: '2026-04-20T09:00:00.000Z',
    recurrence: 'none',
  });

  assert.equal(calls.scheduleNotificationAsync.length, 1);
  assert.equal(calls.scheduleNotificationAsync[0].content.sound, 'default');
});

test('android reminder channel keeps default sound', async () => {
  const { module, calls } = loadNotificationsModule({
    platform: 'android',
    permissions: { granted: true, canAskAgain: true },
  });

  await module.configureAndroidChannel();

  assert.equal(calls.setNotificationChannelAsync.length, 1);
  assert.equal(calls.setNotificationChannelAsync[0][0], 'voiceghost-reminders');
  assert.equal(calls.setNotificationChannelAsync[0][1].sound, 'default');
});
