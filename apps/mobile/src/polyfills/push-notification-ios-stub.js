/**
 * Dummy PushNotificationIOS. The real RN module crashes on iOS when
 * NativePushNotificationManagerIOS is missing (Expo uses expo-notifications).
 * Metro redirects the RN export here so `import * from 'react-native'` cannot
 * take down boot.
 */
const noop = () => {};
const PushNotificationIOS = {
  addEventListener: noop,
  removeEventListener: noop,
  requestPermissions: async () => ({}),
  abandonPermissions: noop,
  checkPermissions: (cb) => {
    if (typeof cb === 'function') cb({ alert: false, badge: false, sound: false });
  },
  getInitialNotification: async () => null,
  getBadgeCount: (cb) => {
    if (typeof cb === 'function') cb(0);
  },
  setApplicationIconBadgeNumber: noop,
  presentLocalNotification: noop,
  scheduleLocalNotification: noop,
  cancelAllLocalNotifications: noop,
  cancelLocalNotifications: noop,
  getScheduledLocalNotifications: (cb) => {
    if (typeof cb === 'function') cb([]);
  },
};

module.exports = PushNotificationIOS;
module.exports.default = PushNotificationIOS;
