import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Import only TypeScript types.
 *
 * IMPORTANT:
 * This does NOT load expo-notifications at runtime.
 */
import type * as NotificationsTypes from 'expo-notifications';

/**
 * Expo Go detection.
 */
const isExpoGo = Constants.appOwnership === 'expo';

/**
 * Runtime notification module.
 *
 * It stays null in Android Expo Go.
 */
let NotificationsModule:
  typeof import('expo-notifications') | null = null;

/**
 * Load expo-notifications only when it is safe to do so.
 */
async function getNotificationsModule() {
  /**
   * Android Expo Go does NOT support remote push notifications.
   *
   * Most importantly, we don't import expo-notifications here.
   */
  if (Platform.OS === 'android' && isExpoGo) {
    console.log(
      '[Push Notifications] Android Expo Go detected. ' +
      'Remote push notifications are disabled in Expo Go.'
    );

    return null;
  }

  /**
   * Already loaded.
   */
  if (NotificationsModule) {
    return NotificationsModule;
  }

  /**
   * Dynamically import the module.
   */
  try {
    NotificationsModule = await import(
      'expo-notifications'
    );

    return NotificationsModule;
  } catch (error) {
    console.warn(
      '[Push Notifications] Unable to load expo-notifications:',
      error
    );

    return null;
  }
}

export type NotificationPermissionState = {
  status: string;
  canAskAgain: boolean;
};

export interface CampusPresenceAlert {
  requestId: string | null;
  notificationId: string;
  title: string;
  message: string;
}

const campusPresenceAlertListeners = new Set<
  (alert: CampusPresenceAlert) => void
>();
const recentCampusPresenceAlertKeys = new Map<string, number>();
const registeredPushTokenKeys = new Set<string>();
const pushTokenRegistrationPromises = new Map<string, Promise<void>>();

async function registerPushTokenForUser(
  userId: string | number,
  pushToken: string,
): Promise<void> {
  const registrationKey = `${String(userId)}:${pushToken}`;
  if (registeredPushTokenKeys.has(registrationKey)) {
    return;
  }

  const existingRegistration =
    pushTokenRegistrationPromises.get(registrationKey);
  if (existingRegistration) {
    return existingRegistration;
  }

  const registration = (async () => {
    const { registerPushToken } = await import('@/api/axios');
    await registerPushToken({
      userId,
      pushToken,
    });
    registeredPushTokenKeys.add(registrationKey);
    console.info('[Push Notifications] Backend confirmed token registration.');
  })();

  pushTokenRegistrationPromises.set(registrationKey, registration);
  try {
    await registration;
  } finally {
    pushTokenRegistrationPromises.delete(registrationKey);
  }
}

export function subscribeToCampusPresenceAlerts(
  listener: (alert: CampusPresenceAlert) => void,
) {
  campusPresenceAlertListeners.add(listener);
  return () => {
    campusPresenceAlertListeners.delete(listener);
  };
}

export function publishCampusPresenceAlert(
  alert: CampusPresenceAlert,
): boolean {
  const now = Date.now();
  const notificationKey = `notification:${alert.notificationId}`;
  const requestKey = alert.requestId
    ? `request:${alert.requestId}`
    : null;
  const lastRequestAlert = requestKey
    ? recentCampusPresenceAlertKeys.get(requestKey)
    : undefined;

  if (
    recentCampusPresenceAlertKeys.has(notificationKey) ||
    (lastRequestAlert !== undefined && now - lastRequestAlert < 5000)
  ) {
    return false;
  }

  recentCampusPresenceAlertKeys.set(notificationKey, now);
  if (requestKey) {
    recentCampusPresenceAlertKeys.set(requestKey, now);
  }
  for (const [key, timestamp] of recentCampusPresenceAlertKeys) {
    if (now - timestamp > 60_000) {
      recentCampusPresenceAlertKeys.delete(key);
    }
  }
  if (recentCampusPresenceAlertKeys.size > 100) {
    const oldestKey = recentCampusPresenceAlertKeys.keys().next().value;
    if (oldestKey) {
      recentCampusPresenceAlertKeys.delete(oldestKey);
    }
  }

  campusPresenceAlertListeners.forEach((listener) => listener(alert));
  return true;
}

export async function getNotificationPermissionStatusAsync(): Promise<NotificationPermissionState> {
  try {
    const Notifications = await getNotificationsModule();
    if (!Notifications) {
      return { status: 'unavailable', canAskAgain: false };
    }

    const permission = await Notifications.getPermissionsAsync();
    return {
      status: permission.status,
      canAskAgain: permission.canAskAgain,
    };
  } catch (error) {
    console.warn(
      '[Push Notifications] Unable to read permission status:',
      error
    );
    return { status: 'unavailable', canAskAgain: false };
  }
}

export async function requestNotificationPermissionAsync(): Promise<NotificationPermissionState> {
  try {
    const Notifications = await getNotificationsModule();
    if (!Notifications) {
      return { status: 'unavailable', canAskAgain: false };
    }

    const current = await Notifications.getPermissionsAsync();
    if (current.status === 'granted' || !current.canAskAgain) {
      return {
        status: current.status,
        canAskAgain: current.canAskAgain,
      };
    }

    const requested = await Notifications.requestPermissionsAsync();
    return {
      status: requested.status,
      canAskAgain: requested.canAskAgain,
    };
  } catch (error) {
    console.warn(
      '[Push Notifications] Unable to request permission:',
      error
    );
    return { status: 'unavailable', canAskAgain: false };
  }
}

/**
 * Configure notification behavior.
 *
 * This is done asynchronously so Android Expo Go
 * never loads expo-notifications.
 */
async function configureNotificationHandler() {
  const Notifications =
    await getNotificationsModule();

  if (!Notifications) {
    return;
  }

  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch (error) {
    console.warn(
      '[Push Notifications] Failed to configure handler:',
      error
    );
  }
}

/**
 * Register the current device and get the current
 * Expo Push Token.
 *
 * IMPORTANT:
 *
 * userId = logged-in user
 *
 * pushToken = current physical device
 *
 * Therefore:
 *
 * Employee EMP003
 *
 * Mobile A
 *   userId    = 123
 *   pushToken = ExpoTokenA
 *
 * Mobile B
 *   userId    = 123
 *   pushToken = ExpoTokenB
 */
export async function registerForPushNotificationsAsync(
  userId?: string | number,
  requestPermission = true,
) {
  if (userId === undefined || userId === null || String(userId).trim() === '') {
    throw new Error(
      'The authenticated users.id is missing; the Expo Push Token cannot be registered.',
    );
  }

  if (Platform.OS === 'android' && isExpoGo) {
    console.info(
      '[Push Notifications] Skipped because Android Expo Go does not support remote push notifications.',
    );
    return null;
  }

  if (!Device.isDevice) {
    console.warn('[Push Notifications] A physical device is required.');
    return null;
  }

  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return null;
  }

  await configureNotificationHandler();

  let permission = await Notifications.getPermissionsAsync();
  console.info('[Push Notifications] Permission status:', permission.status);
  if (
    permission.status !== 'granted' &&
    permission.canAskAgain &&
    requestPermission
  ) {
    permission = await Notifications.requestPermissionsAsync();
    console.info(
      '[Push Notifications] Permission status after request:',
      permission.status,
    );
  }
  if (permission.status !== 'granted') {
    console.warn('[Push Notifications] Permission was not granted.');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Attendance',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    });
    await Notifications.setNotificationChannelAsync('campus-presence', {
      name: 'Campus presence alerts',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (!projectId) {
    throw new Error('Expo EAS projectId is not configured.');
  }

  const tokenResponse = await Notifications.getExpoPushTokenAsync({
    projectId,
  });
  const pushToken =
    typeof tokenResponse.data === 'string'
      ? tokenResponse.data.trim()
      : '';
  if (!pushToken || pushToken === 'null' || pushToken === 'undefined') {
    throw new Error('Expo did not return a valid push token.');
  }
  if (!/^Expo(?:nent)?PushToken\[[^\]]+\]$/.test(pushToken)) {
    throw new Error(
      'The notification SDK returned a native or invalid token instead of an Expo Push Token.',
    );
  }
  console.info('[Push Notifications] Expo Push Token generated.');

  await registerPushTokenForUser(userId, pushToken);
  return pushToken;
}

export async function setupPushTokenChangeListener(
  onTokenChanged: () => void,
): Promise<() => void> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return () => {};
  }

  const subscription = Notifications.addPushTokenListener(() => {
    // This event carries the native APNs/FCM device token. Re-fetch the
    // Expo Push Token rather than sending the native token to the backend.
    console.info('[Push Notifications] Native device token changed.');
    onTokenChanged();
  });
  return () => subscription.remove();
}

export async function getLastNotificationResponseAsync() {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return null;
  }

  try {
    return await Notifications.getLastNotificationResponseAsync();
  } catch (error) {
    console.warn(
      '[Push Notifications] Unable to read the launch notification response:',
      error
    );
    return null;
  }
}

export async function clearLastNotificationResponseAsync() {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return;
  }

  try {
    await Notifications.clearLastNotificationResponseAsync();
  } catch (error) {
    console.warn(
      '[Push Notifications] Unable to clear the launch notification response:',
      error
    );
  }
}

/**
 * Setup notification listeners.
 */
export function setupNotificationListeners(
  onNotificationReceived?: (
    notification: NotificationsTypes.Notification
  ) => void,

  onNotificationResponse?: (
    response: NotificationsTypes.NotificationResponse
  ) => void
) {
  /**
   * Android Expo Go:
   *
   * No import, no listener.
   */
  if (
    Platform.OS === 'android' &&
    isExpoGo
  ) {
    console.log(
      '[Push Notifications] Listeners disabled in Android Expo Go.'
    );

    return () => {};
  }

  /**
   * The listener API is asynchronous now because
   * expo-notifications is dynamically loaded.
   */
  let cleanup:
    | (() => void)
    | undefined;

  let cancelled = false;

  (async () => {
    try {
      const Notifications =
        await getNotificationsModule();

      if (!Notifications || cancelled) {
        return;
      }

      /**
       * Configure handler.
       */
      await configureNotificationHandler();

      if (cancelled) {
        return;
      }

      /**
       * Notification received while app is open.
       */
      const notificationSubscription =
        Notifications.addNotificationReceivedListener(
          (notification) => {
            onNotificationReceived?.(
              notification
            );
          }
        );

      /**
       * User taps notification.
       */
      const responseSubscription =
        Notifications.addNotificationResponseReceivedListener(
          (response) => {
            onNotificationResponse?.(
              response
            );
          }
        );

      cleanup = () => {
        notificationSubscription.remove();
        responseSubscription.remove();
      };
    } catch (error) {
      console.warn(
        '[Push Notifications] Listener setup failed:',
        error
      );
    }
  })();

  /**
   * Return cleanup function immediately.
   */
  return () => {
    cancelled = true;
    cleanup?.();
  };
}

/**
 * Kept for compatibility with authStore.
 *
 * Authentication is controlled by JWT.
 * Push tokens are device-specific and are NOT
 * authentication credentials.
 */
export function resetPushRegistrationGuard() {
  registeredPushTokenKeys.clear();
}