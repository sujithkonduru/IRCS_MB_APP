
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from 'expo-router/react-navigation';

import {
  Stack,
  useRouter,
  useSegments,
  useRootNavigationState,
} from 'expo-router';

import { AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef } from 'react';
import type * as NotificationsTypes from 'expo-notifications';

import * as SplashScreen from 'expo-splash-screen';

import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
} from '@tanstack/react-query';

import Toast from 'react-native-toast-message';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/store/authStore';

import {
  clearLastNotificationResponseAsync,
  getLastNotificationResponseAsync,
  publishCampusPresenceAlert,
  registerForPushNotificationsAsync,
  setupPushTokenChangeListener,
  setupNotificationListeners,
} from '@/lib/notifications';

import {
  getApiErrorMessage,
  getPendingCampusPresenceRequests,
} from '@/api/axios';

/**
 * ----------------------------------------------------
 * KEEP SPLASH SCREEN VISIBLE
 * ----------------------------------------------------
 *
 * Authentication and routing are initialized before
 * hiding the native splash screen.
 */
SplashScreen.preventAutoHideAsync();

/**
 * ----------------------------------------------------
 * EXPO ROUTER SETTINGS
 * ----------------------------------------------------
 */
export const unstable_settings = {
  anchor: '(tabs)',
};

/**
 * ----------------------------------------------------
 * REACT QUERY CLIENT
 * ----------------------------------------------------
 *
 * Keep one QueryClient for the entire application.
 */
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      /**
       * Only show an error when there is no cached data.
       *
       * This prevents background refetch failures from
       * repeatedly showing Toast messages.
       */
      if (query.state.data === undefined) {
        Toast.show({
          type: 'error',
          text1: 'Failed to Load',
          text2: getApiErrorMessage(error),
        });
      }
    },
  }),
});

/**
 * ----------------------------------------------------
 * ROOT LAYOUT
 * ----------------------------------------------------
 */
export default function RootLayout() {
  /**
   * --------------------------------------------------
   * COLOR SCHEME
   * --------------------------------------------------
   */
  const colorScheme = useColorScheme();

  /**
   * --------------------------------------------------
   * AUTHENTICATION
   * --------------------------------------------------
   */
  const {
    checkAuth,
    isAppReady,
    token,
    user,
  } = useAuthStore();

  /**
   * --------------------------------------------------
   * EXPO ROUTER
   * --------------------------------------------------
   */
  const segments = useSegments();
  const activeRouteGroup = segments[0];
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const handledNotificationResponse = useRef<string | null>(null);
  const pendingNotificationResponse =
    useRef<NotificationsTypes.NotificationResponse | null>(null);
  const authenticatedUserId = user?.user_id;

  const handleNotificationResponse = useCallback(
    (response: NotificationsTypes.NotificationResponse) => {
      if (
        !token ||
        !navigationState?.key ||
        activeRouteGroup === '(login)'
      ) {
        pendingNotificationResponse.current = response;
        return;
      }

      const notification = response.notification;
      const data = notification.request.content.data;
      const campusRequestId =
        data?.requestId ??
        data?.request_id ??
        data?.requestID ??
        data?.id;
      const notificationType = String(data?.type ?? '')
        .toLowerCase()
        .replace(/_/g, '-');
      const notificationScreen = String(data?.screen ?? '')
        .toLowerCase()
        .replace(/_/g, '-');
      const responseKey =
        notification.request.identifier ||
        `${String(data?.screen ?? '')}:${String(campusRequestId ?? '')}`;

      if (handledNotificationResponse.current === responseKey) {
        return;
      }
      handledNotificationResponse.current = responseKey;
      void clearLastNotificationResponseAsync();

      if (
        notificationScreen.startsWith('campus-presence') ||
        notificationType.startsWith('campus-presence') ||
        campusRequestId !== undefined
      ) {
        router.push({
          pathname: '/(employee)/campus-presence',
          params: campusRequestId
            ? { requestId: String(campusRequestId) }
            : {},
        });
        return;
      }

      if (data?.screen === 'notifications') {
        router.push('/(employee)/(tabs)/notifications');
        return;
      }

      if (data?.screen === 'attendance') {
        router.push('/(employee)/(tabs)/attendance');
        return;
      }

      router.push('/(employee)/(tabs)/notifications');
    },
    [activeRouteGroup, navigationState?.key, router, token],
  );

  /**
   * ==================================================
   * 1. CHECK AUTHENTICATION
   * ==================================================
   *
   * Restore the existing login session when the
   * application starts.
   */
  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  /**
   * ==================================================
   * 2. REGISTER EXPO PUSH NOTIFICATIONS
   * ==================================================
   *
   * This runs only after:
   *
   * - Authentication initialization is complete
   * - A valid login token exists
   *
   * The function generates:
   *
   * ExponentPushToken[...]
   *
   * IMPORTANT:
   * Firebase SDK is NOT used here.
   */
  useEffect(() => {
    if (!isAppReady || !token) {
      return;
    }

    let cancelled = false;

    const registerCurrentExpoToken = async () => {
      if (cancelled || !authenticatedUserId) {
        return;
      }

      try {
        const pushToken =
          await registerForPushNotificationsAsync(
            authenticatedUserId,
            false,
          );
        if (pushToken) {
          console.log('[Push Notifications] Registered successfully.');
        } else {
          console.warn(
            '[Push Notifications] No push token returned.'
          );
        }
      } catch (error) {
        /**
         * Push notification failure must NOT prevent
         * the user from using the Attendance application.
         */
        console.error(
          '[Push Notifications] Registration failed:',
          getApiErrorMessage(error),
        );
      }
    };

    void registerCurrentExpoToken();

    let removeTokenListener: (() => void) | undefined;
    let listenerCancelled = false;
    void setupPushTokenChangeListener(() => {
      void registerCurrentExpoToken();
    }).then((cleanup) => {
      if (listenerCancelled) {
        cleanup();
      } else {
        removeTokenListener = cleanup;
      }
    }).catch((error) => {
      console.warn('[Push Notifications] Token-change listener failed:', error);
    });

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        registerCurrentExpoToken();
      }
    });

    return () => {
      cancelled = true;
      listenerCancelled = true;
      removeTokenListener?.();
      appStateSubscription.remove();
    };
  }, [authenticatedUserId, isAppReady, token]);

  /**
   * Synchronize pending requests after authentication and each time
   * the app returns to the foreground. Push remains the delivery
   * mechanism while the app is backgrounded or terminated.
   */
  useEffect(() => {
    if (!isAppReady || !token) {
      return;
    }

    let cancelled = false;
    const synchronizePendingRequests = async () => {
      try {
        if (user?.Role?.toLowerCase() !== 'head') {
          await getPendingCampusPresenceRequests();
        }
      } catch (error) {
        if (!cancelled) {
          console.warn(
            '[Campus Presence] Pending requests could not be synchronized.',
            getApiErrorMessage(error),
          );
        }
      }
    };

    void synchronizePendingRequests();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void synchronizePendingRequests();
      }
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [isAppReady, token, user?.Role]);

  /**
   * ==================================================
   * 3. NOTIFICATION LISTENERS
   * ==================================================
   *
   * Handles:
   *
   * A. Notification received while application is open
   *
   * B. User taps a notification
   */
  useEffect(() => {
    /**
     * Wait until authentication/application
     * initialization is complete.
     */
    if (!isAppReady) {
      return;
    }

    /**
     * ------------------------------------------------
     * SETUP NOTIFICATION LISTENERS
     * ------------------------------------------------
     *
     * setupNotificationListeners() must accept the
     * two callbacks below.
     */
    const cleanup = setupNotificationListeners(
      /**
       * ----------------------------------------------
       * NOTIFICATION RECEIVED
       * ----------------------------------------------
       */
      (notification) => {
        const content = notification.request.content;
        const data = content.data;
        const screen = String(data?.screen ?? '')
          .toLowerCase()
          .replace(/_/g, '-');
        const type = String(data?.type ?? '')
          .toLowerCase()
          .replace(/_/g, '-');
        const rawRequestId =
          data?.requestId ??
          data?.request_id ??
          data?.requestID ??
          data?.id;
        const isCampusPresence =
          screen.startsWith('campus-presence') ||
          type.startsWith('campus-presence') ||
          rawRequestId !== undefined;

        if (!isCampusPresence) {
          return;
        }

        const requestId =
          rawRequestId === undefined || rawRequestId === null
            ? null
            : String(rawRequestId);
        const alert = {
          requestId,
          notificationId: notification.request.identifier,
          title: content.title || String(data?.title ?? 'Campus presence check'),
          message:
            content.body ||
            String(data?.message ?? data?.body ?? 'Please respond to your campus presence request.'),
        };

        const wasPublished = publishCampusPresenceAlert(alert);
        if (wasPublished) {
          Toast.show({
            type: 'info',
            text1: alert.title,
            text2: alert.message,
          });
        }
      },

      /**
       * ----------------------------------------------
       * NOTIFICATION TAPPED
       * ----------------------------------------------
       */
      (response) => {
        handleNotificationResponse(response);
      }
    );

    let cancelled = false;
    if (token) {
      void getLastNotificationResponseAsync().then((response) => {
        if (!cancelled && response) {
          handleNotificationResponse(response);
        }
      });
    }

    /**
     * Remove notification listeners when the
     * RootLayout is unmounted.
     */
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [handleNotificationResponse, isAppReady, token]);

  useEffect(() => {
    if (
      !isAppReady ||
      !token ||
      !navigationState?.key ||
      activeRouteGroup === '(login)'
    ) {
      return;
    }
    const pendingResponse = pendingNotificationResponse.current;
    if (pendingResponse) {
      pendingNotificationResponse.current = null;
      handleNotificationResponse(pendingResponse);
    }
  }, [
    handleNotificationResponse,
    isAppReady,
    navigationState?.key,
    activeRouteGroup,
    token,
  ]);

  /**
   * ==================================================
   * 4. AUTHENTICATION / ROUTING
   * ==================================================
   *
   * Wait until:
   *
   * - Authentication has finished
   * - Expo Router navigation tree exists
   */
  useEffect(() => {
    if (
      !isAppReady ||
      !navigationState?.key
    ) {
      return;
    }

    /**
     * Determine whether the current route is
     * inside the login group.
     */
    const inAuthGroup =
      segments[0] === '(login)';

    /**
     * ==================================================
     * NOT LOGGED IN
     * ==================================================
     */
    if (!token && !inAuthGroup) {
      router.replace('/(login)');
    }

    /**
     * ==================================================
     * LOGGED IN
     * ==================================================
     */
    else if (token && inAuthGroup) {
      /**
       * ----------------------------------------------
       * HEAD / HR
       * ----------------------------------------------
       */
      if (user?.Role === 'head') {
        router.replace('/(head)/(tabs)');
      }

      /**
       * ----------------------------------------------
       * EMPLOYEE
       * ----------------------------------------------
       */
      else {
        router.replace('/(employee)/(tabs)');
      }
    }

    /**
     * ------------------------------------------------
     * HIDE SPLASH SCREEN
     * ------------------------------------------------
     *
     * Give Expo Router a short amount of time to finish
     * the initial navigation.
     */
    const splashTimer = setTimeout(() => {
      SplashScreen.hideAsync();
    }, 100);

    return () => {
      clearTimeout(splashTimer);
    };
  }, [
    isAppReady,
    navigationState?.key,
    token,
    segments,
    user,
    router,
  ]);

  /**
   * ==================================================
   * 5. WAIT FOR AUTHENTICATION INITIALIZATION
   * ==================================================
   *
   * Keep native splash screen visible until the auth
   * state has been restored.
   */
  if (!isAppReady) {
    return null;
  }

  /**
   * ==================================================
   * 6. APPLICATION UI
   * ==================================================
   */
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        value={
          colorScheme === 'dark'
            ? DarkTheme
            : DefaultTheme
        }
      >
        <Stack>
          {/* ==========================================
              LOGIN
             ========================================== */}
          <Stack.Screen
            name="(login)"
            options={{
              headerShown: false,
            }}
          />

          {/* ==========================================
              HEAD / HR
             ========================================== */}
          <Stack.Screen
            name="(head)"
            options={{
              headerShown: false,
            }}
          />

          {/* ==========================================
              EMPLOYEE
             ========================================== */}
          <Stack.Screen
            name="(employee)"
            options={{
              headerShown: false,
            }}
          />
        </Stack>

        {/* Status Bar */}
        <StatusBar style="auto" />

        {/* Toast Messages */}
        <Toast />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
