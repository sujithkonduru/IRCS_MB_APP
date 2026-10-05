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
  userId?: string | number
) {
  try {
    /**
     * Android Expo Go:
     *
     * Don't even load expo-notifications.
     */
    if (Platform.OS === 'android' && isExpoGo) {
      console.log(
        '[Push Notifications] Skipped because app is running in Android Expo Go.'
      );

      return null;
    }

    /**
     * Physical device required.
     */
    if (!Device.isDevice) {
      console.warn(
        '[Push Notifications] Physical device required.'
      );

      return null;
    }

    /**
     * Dynamically load notifications.
     */
    const Notifications =
      await getNotificationsModule();

    if (!Notifications) {
      return null;
    }

    /**
     * Configure notification handler.
     */
    await configureNotificationHandler();

    /**
     * Check permission.
     */
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();

    let finalStatus = existingStatus;

    /**
     * Request permission if necessary.
     */
    if (existingStatus !== 'granted') {
      const { status } =
        await Notifications.requestPermissionsAsync();

      finalStatus = status;
    }

    /**
     * Permission denied.
     */
    if (finalStatus !== 'granted') {
      console.warn(
        '[Push Notifications] Permission not granted.'
      );

      return null;
    }

    /**
     * Android notification channel.
     */
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(
        'default',
        {
          name: 'default',
          importance:
            Notifications.AndroidImportance.MAX,
          vibrationPattern: [
            0,
            250,
            250,
            250,
          ],
        }
      );
    }

    /**
     * Get EAS project ID.
     */
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.warn(
        '[Push Notifications] Expo EAS projectId was not found.'
      );

      return null;
    }

    console.log(
      '[Push Notifications] Project ID:',
      projectId
    );

    /**
     * Get CURRENT device Expo Push Token.
     */
    const tokenResponse =
      await Notifications.getExpoPushTokenAsync({
        projectId,
      });

    const pushToken = tokenResponse.data;

    if (!pushToken) {
      console.warn(
        '[Push Notifications] No Expo Push Token received.'
      );

      return null;
    }

    console.log(
      '[Push Notifications] Current Expo Push Token:',
      pushToken
    );

    /**
     * Update backend with the current device token.
     *
     * IMPORTANT:
     *
     * This is deliberately separated from login.
     * Push registration failure must NEVER cause
     * login failure.
     */
    if (
      userId !== undefined &&
      userId !== null
    ) {
      try {
        /**
         * Dynamic import prevents circular dependency
         * problems with authStore / axios.
         */
        const {
          registerPushToken,
        } = await import('@/api/axios');

        await registerPushToken({
          userId,
          pushToken,
          platform: Platform.OS,
        });

        console.log(
          '[Push Notifications] Backend token update successful.',
          {
            userId,
            platform: Platform.OS,
          }
        );
      } catch (error) {
        console.warn(
          '[Push Notifications] Backend token update failed:',
          error
        );
      }
    } else {
      console.warn(
        '[Push Notifications] userId was not provided.'
      );
    }

    return pushToken;
  } catch (error) {
    /**
     * Never allow notification problems to
     * break authentication.
     */
    console.warn(
      '[Push Notifications] Registration failed:',
      error
    );

    return null;
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
  // No push-token authentication state is stored here.
}