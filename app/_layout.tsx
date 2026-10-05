
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

import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

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
  registerForPushNotificationsAsync,
  setupNotificationListeners,
} from '@/lib/notifications';

import { getApiErrorMessage } from '@/api/axios';

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
  const router = useRouter();
  const navigationState = useRootNavigationState();

  /**
   * ==================================================
   * 1. CHECK AUTHENTICATION
   * ==================================================
   *
   * Restore the existing login session when the
   * application starts.
   */
  useEffect(() => {
    checkAuth();
  }, []);

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

    const registerPush = async () => {
      try {
        console.log(
          '[Push Notifications] Starting registration...'
        );

        const pushToken =
          await registerForPushNotificationsAsync();

        /**
         * Component may have unmounted while the
         * asynchronous registration was running.
         */
        if (cancelled) {
          return;
        }

        if (pushToken) {
          console.log(
            '[Push Notifications] Registered successfully:',
            pushToken
          );

          /**
           * ------------------------------------------------
           * IMPORTANT
           * ------------------------------------------------
           *
           * This is where you can send the Expo Push Token
           * to your Stackenzo backend.
           *
           * Example:
           *
           * await saveExpoPushToken(pushToken);
           *
           * Do not add Firebase code here.
           */
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
          error
        );
      }
    };

    registerPush();

    return () => {
      cancelled = true;
    };
  }, [isAppReady, token]);

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
        console.log(
          '[Push Notifications] Received while app is open:',
          notification
        );

        const content =
          notification.request.content;

        console.log(
          '[Push Notifications] Title:',
          content.title
        );

        console.log(
          '[Push Notifications] Body:',
          content.body
        );

        console.log(
          '[Push Notifications] Data:',
          content.data
        );
      },

      /**
       * ----------------------------------------------
       * NOTIFICATION TAPPED
       * ----------------------------------------------
       */
      (response) => {
        console.log(
          '[Push Notifications] Notification tapped:',
          response
        );

        const data =
          response.notification.request.content.data;

        console.log(
          '[Push Notifications] Notification data:',
          data
        );

        /**
         * --------------------------------------------
         * NOTIFICATION -> NOTIFICATIONS SCREEN
         * --------------------------------------------
         *
         * Backend example:
         *
         * {
         *   "screen": "notifications"
         * }
         */
        if (data?.screen === 'notifications') {
          router.push(
            '/(employee)/(tabs)/notifications'
          );

          return;
        }

        /**
         * --------------------------------------------
         * NOTIFICATION -> ATTENDANCE SCREEN
         * --------------------------------------------
         *
         * Backend example:
         *
         * {
         *   "screen": "attendance"
         * }
         */
        if (data?.screen === 'attendance') {
          router.push(
            '/(employee)/(tabs)/attendance'
          );

          return;
        }

        /**
         * --------------------------------------------
         * DEFAULT
         * --------------------------------------------
         */
        router.push(
          '/(employee)/(tabs)/notifications'
        );
      }
    );

    /**
     * Remove notification listeners when the
     * RootLayout is unmounted.
     */
    return cleanup;
  }, [isAppReady, router]);

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
