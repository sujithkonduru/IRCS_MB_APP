
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';

import { useAuthStore } from '@/store/authStore';
import { registerPushToken } from '@/api/axios';

/**
 * Controls how notifications are displayed when the app
 * is currently open.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function usePushNotifications() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] =
    useState<Notifications.Notification | null>(null);

  const notificationListener =
    useRef<Notifications.EventSubscription | null>(null);

  const responseListener =
    useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }

    let mounted = true;

    const setupNotifications = async () => {
      try {
        const token = await registerForPushNotificationsAsync();

        if (!mounted) {
          return;
        }

        if (token) {
          setExpoPushToken(token);

          console.log(
            'Expo Push Token:',
            token
          );

          /**
           * Send the token to your backend.
           *
           * Change this payload if your backend expects
           * different field names.
           */
          try {
            await registerPushToken({
              userId:
                user.employee_id ??
                user.id ??
                user.userId,
              pushToken: token,
              platform: Platform.OS,
            });

            console.log(
              'Push token registered successfully'
            );
          } catch (error) {
            console.error(
              'Failed to register push token with backend:',
              error
            );
          }
        }
      } catch (error) {
        console.error(
          'Push notification setup failed:',
          error
        );
      }
    };

    setupNotifications();

    /**
     * Fires when a notification is received while
     * the application is running.
     */
    notificationListener.current =
      Notifications.addNotificationReceivedListener(
        (receivedNotification) => {
          console.log(
            'Notification received:',
            receivedNotification
          );

          if (mounted) {
            setNotification(receivedNotification);
          }
        }
      );

    /**
     * Fires when the user taps a notification.
     */
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener(
        (response) => {
          console.log(
            'Notification tapped:',
            response
          );

          const data =
            response.notification.request.content.data;

          console.log(
            'Notification data:',
            data
          );

          /**
           * If your backend sends:
           *
           * {
           *   "screen": "notifications"
           * }
           *
           * then open the notification screen.
           */
          if (data?.screen === 'notifications') {
            router.push('/(employee)/(tabs)/notifications');
            return;
          }

          /**
           * Default behaviour.
           */
          router.push('/(employee)/(tabs)/notifications');
        }
      );

    return () => {
      mounted = false;

      if (notificationListener.current) {
        notificationListener.current.remove();
        notificationListener.current = null;
      }

      if (responseListener.current) {
        responseListener.current.remove();
        responseListener.current = null;
      }
    };
  }, [user, router]);

  return {
    expoPushToken,
    notification,
  };
}

/**
 * Register the physical device for push notifications.
 */
async function registerForPushNotificationsAsync(): Promise<
  string | null
> {
  if (!Device.isDevice) {
    console.warn(
      'Push notifications require a physical device.'
    );

    Alert.alert(
      'Physical Device Required',
      'Push notifications must be tested on a real Android/iOS device.'
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
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#3b82f6',
        sound: 'default',
      }
    );
  }

  /**
   * Check current notification permission.
   */
  const {
    status: existingStatus,
  } = await Notifications.getPermissionsAsync();

  let finalStatus = existingStatus;

  /**
   * Ask the user if permission has not already
   * been granted.
   */
  if (existingStatus !== 'granted') {
    const {
      status,
    } = await Notifications.requestPermissionsAsync();

    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn(
      'Notification permission was not granted.'
    );

    Alert.alert(
      'Notifications Disabled',
      'Please enable notifications for this application in your device settings.'
    );

    return null;
  }

  /**
   * Get Expo/EAS project ID.
   *
   * This is required for getExpoPushTokenAsync().
   */
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  if (!projectId) {
    console.error(
      'Expo/EAS project ID is missing.'
    );

    Alert.alert(
      'Configuration Error',
      'Expo project ID is missing. Configure your EAS project before testing push notifications.'
    );

    return null;
  }

  console.log(
    'Expo Project ID:',
    projectId
  );

  /**
   * Generate the Expo Push Token.
   */
  const token =
    await Notifications.getExpoPushTokenAsync({
      projectId,
    });

  console.log(
    'Expo Push Token:',
    token.data
  );

  return token.data;
}

