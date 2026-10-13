import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  AppState,
  Linking,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { getApiErrorMessage, api } from '@/api/axios';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAuthStore } from '@/store/authStore';
import {
  getNotificationPermissionStatusAsync,
  registerForPushNotificationsAsync,
  requestNotificationPermissionAsync,
} from '@/lib/notifications';
import OTPModal from '@/components/OTPModal';
import { Image } from 'expo-image';
import logo from '@/assets/images/logo.png';

export default function LoginScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [permissionConsent, setPermissionConsent] = useState(false);
  const [locationPermissionStatus, setLocationPermissionStatus] = useState<string | null>(null);
  const [notificationPermissionStatus, setNotificationPermissionStatus] = useState<string | null>(null);
  const [permissionFlowInProgress, setPermissionFlowInProgress] = useState(false);
  const permissionFlowLock = React.useRef(false);

  const {
    setAuthSuccess,
    setPendingEmail,
    pendingEmail,
  } = useAuthStore();

  const syncPermissionStatuses = useCallback(async () => {
    try {
      const locationPermission =
        await Location.getForegroundPermissionsAsync();
      setLocationPermissionStatus(locationPermission.status);
    } catch {
      setLocationPermissionStatus('unavailable');
    }

    const notificationPermission =
      await getNotificationPermissionStatusAsync();
    setNotificationPermissionStatus(notificationPermission.status);
  }, []);

  const requestLocationPermission = useCallback(async () => {
    try {
      const { status, canAskAgain } =
        await Location.getForegroundPermissionsAsync();

      if (status === 'granted') {
        setLocationPermissionStatus(status);
        return status;
      }

      if (status === 'denied' && !canAskAgain) {
        setLocationPermissionStatus(status);
        Toast.show({
          type: 'info',
          text1: 'Location Access Needed',
          text2: 'Please enable location permission in device settings for attendance tracking.',
        });
        return status;
      }

      const result = await Location.requestForegroundPermissionsAsync();
      setLocationPermissionStatus(result.status);

      if (result.status !== 'granted') {
        Toast.show({
          type: 'info',
          text1: 'Location Permission Denied',
          text2: 'Attendance location checks may be unavailable until you enable it in Settings.',
        });
      }

      return result.status;
    } catch {
      setLocationPermissionStatus('unavailable');
      return 'unavailable';
    }
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    const result = await requestNotificationPermissionAsync();
    setNotificationPermissionStatus(result.status);

    if (result.status === 'denied' && !result.canAskAgain) {
      Toast.show({
        type: 'info',
        text1: 'Notifications Disabled',
        text2: 'Enable notifications in Settings to receive attendance alerts.',
      });
    } else if (result.status === 'denied') {
      Toast.show({
        type: 'info',
        text1: 'Notification Permission Denied',
        text2: 'You can enable notifications later from the device settings.',
      });
    }

    return result.status;
  }, []);

  const handlePermissionConsentChange = useCallback(
    async (nextValue: boolean) => {
      setPermissionConsent(nextValue);

      if (!nextValue) {
        return;
      }

      if (permissionFlowLock.current) {
        return;
      }

      permissionFlowLock.current = true;
      setPermissionFlowInProgress(true);

      try {
        await requestLocationPermission();
        await requestNotificationPermission();
      } finally {
        permissionFlowLock.current = false;
        setPermissionFlowInProgress(false);
      }
    },
    [requestLocationPermission, requestNotificationPermission]
  );

  useEffect(() => {
    const initialCheck = setTimeout(() => {
      void syncPermissionStatuses();
    }, 0);

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        setTimeout(() => {
          void syncPermissionStatuses();
        }, 0);
      }
    });

    return () => {
      clearTimeout(initialCheck);
      subscription?.remove();
    };
  }, [syncPermissionStatuses]);

  const formatPermissionState = (status: string | null) => {
    switch (status) {
      case 'granted':
        return 'Granted';
      case 'denied':
        return 'Denied';
      case 'restricted':
        return 'Restricted';
      case 'limited':
        return 'Limited';
      case 'undetermined':
        return 'Not yet requested';
      case 'unavailable':
        return 'Unavailable';
      default:
        return 'Not checked';
    }
  };

  const handleLogin = async () => {
    /**
     * Prevent duplicate login requests.
     */
    if (isLoading) {
      return;
    }

    if (!permissionConsent) {
      Toast.show({
        type: 'error',
        text1: 'Permission Required',
        text2: 'Please agree to the required permissions before logging in.',
      });

      return;
    }

    /**
     * Normalize input.
     */
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();

    /**
     * Validate email/password.
     */
    if (!normalizedEmail || !normalizedPassword) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Please enter both email and password',
      });

      return;
    }

    if (!normalizedEmail.includes('@')) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Email',
        text2: 'Please enter a valid email address',
      });

      return;
    }

    setIsLoading(true);

    try {
      console.log(
        '📤 Login attempt for:',
        normalizedEmail
      );

      const payload = {
        email: normalizedEmail,
        password: normalizedPassword,
      };

      console.log('📤 Login payload:', {
        email: normalizedEmail,
        password: '***',
      });

      /**
       * Login API.
       */
      const response = await api.post(
        '/api/hr/userLogin',
        payload
      );

      /**
       * Support the different token names that
       * your backend may return.
       */
      const token =
        response.data?.Logintoken ||
        response.data?.token ||
        response.data?.data?.token ||
        response.data?.accessToken;

      /**
       * Token is required for authenticated requests.
       */
      if (!token) {
        throw new Error(
          'No authentication token returned from server.'
        );
      }

      console.log(
        '✅ Login successful. Token received.'
      );

      /**
       * Save JWT locally on THIS device.
       *
       * Mobile A → its own SecureStore
       * Mobile B → its own SecureStore
       *
       * This does not log out another mobile.
       */
      await setAuthSuccess(token);

      /**
       * Get the logged-in user from Zustand.
       *
       * This is important because the push token must be
       * associated with the USER, while the token itself
       * belongs to the CURRENT DEVICE.
       */
      const userId = response.data?.data?.user_id;

      /**
       * IMPORTANT:
       *
       * Push notification registration must NEVER
       * make login fail.
       *
       * On Android Expo Go this function will simply
       * return null because remote push notifications
       * require a development/standalone build.
       */
      try {
        const pushToken =
          await registerForPushNotificationsAsync(
            userId
          );

        if (pushToken) {
          console.log(
            '✅ Current device Expo Push Token registration confirmed.'
          );
        } else {
          console.log(
            'ℹ️ No push token registered on this device.'
          );
        }
      } catch (registrationError) {
        /**
         * Do NOT show notification failure as a
         * login failure.
         */
        console.warn(
          '⚠️ Push notification registration failed:',
          getApiErrorMessage(registrationError),
        );
      }

      /**
       * Login successful.
       */
      Toast.show({
        type: 'success',
        text1: 'Login Successful',
        text2: 'Welcome back!',
      });

      /**
       * Navigate to employee dashboard.
       */
      router.replace('/(employee)/(tabs)');
    } catch (error: any) {
      /**
       * Server returned a response.
       */
      if (error?.response) {
        const responseMessage = String(
          error.response.data?.message ?? ''
        ).toLowerCase();

        /**
         * Email verification required.
         */
        const verificationRequired =
          error.response.status === 401 &&
          (
            responseMessage.includes(
              'verification'
            ) ||
            !!error.response.data?.Verification_token
          );

        if (verificationRequired) {
          setPendingEmail(normalizedEmail);

          Toast.show({
            type: 'info',
            text1: 'Verification Required',
            text2:
              'Please verify your email with the OTP sent to your inbox.',
          });

          setShowOtpModal(true);

          return;
        }

        /**
         * Normal backend login error.
         */
        Toast.show({
          type: 'error',
          text1: 'Login Failed',
          text2: getApiErrorMessage(error),
          visibilityTime: 5000,
        });
      } else {
        /**
         * Network/setup error.
         */
        Toast.show({
          type: 'error',
          text1: error?.request
            ? 'Network Error'
            : 'Error',
          text2: getApiErrorMessage(error),
          visibilityTime: 5000,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * OTP verification succeeded.
   *
   * Login is attempted again using the same
   * email/password entered by the user.
   */
  const handleVerifyOTPSuccess = async () => {
    setShowOtpModal(false);

    await handleLogin();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : 'height'
      }
    >
      <ScrollView
        contentContainerStyle={
          styles.scrollContainer
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Image
          source={logo}
          style={styles.logo}
          contentFit="contain"
        />

        <View style={styles.formContainer}>
          <Text style={styles.title}>
            Attendance Login
          </Text>

          <TextInput
            style={styles.input}
            placeholderTextColor="#94a3b8"
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
            autoComplete="email"
            editable={!isLoading}
          />

          <View
            style={styles.passwordContainer}
          >
            <TextInput
              style={styles.passwordInput}
              placeholderTextColor="#94a3b8"
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCorrect={false}
              autoComplete="password"
              editable={!isLoading}
            />

            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() =>
                setShowPassword(
                  !showPassword
                )
              }
              disabled={isLoading}
            >
              <Ionicons
                name={
                  showPassword
                    ? 'eye-off'
                    : 'eye'
                }
                size={22}
                color="#94a3b8"
              />
            </TouchableOpacity>
          </View>

          <View style={styles.permissionContainer}>
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() =>
                handlePermissionConsentChange(!permissionConsent)
              }
              disabled={permissionFlowInProgress || isLoading}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.checkbox,
                  permissionConsent && styles.checkboxChecked,
                ]}
              >
                {permissionConsent && (
                  <Ionicons
                    name="checkmark"
                    size={16}
                    color="#fff"
                  />
                )}
              </View>

              <Text style={styles.permissionText}>
                I agree to grant the required Location and Notification permissions for attendance tracking and alerts.
                {'\n'}
                <Text style={styles.permissionRequired}>Required to continue</Text>
              </Text>
            </TouchableOpacity>

            <View style={styles.permissionStatusBlock}>
              <Text style={styles.permissionStatusText}>
                Location: {formatPermissionState(locationPermissionStatus)}
              </Text>
              <Text style={styles.permissionStatusText}>
                Notifications: {formatPermissionState(notificationPermissionStatus)}
              </Text>
            </View>

            {(locationPermissionStatus === 'denied' ||
              notificationPermissionStatus === 'denied') && (
              <TouchableOpacity
                style={styles.settingsButton}
                onPress={() => Linking.openSettings()}
              >
                <Text style={styles.settingsButtonText}>
                  Open device settings
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.primaryBtn,
              (isLoading ||
                permissionFlowInProgress ||
                !permissionConsent) &&
                styles.disabledBtn,
            ]}
            onPress={handleLogin}
            disabled={
              isLoading ||
              permissionFlowInProgress ||
              !permissionConsent
            }
            activeOpacity={0.7}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>
                Login
              </Text>
            )}
          </TouchableOpacity>

          <Link
            href="/(login)/register"
            asChild
          >
            {/* <TouchableOpacity
              style={styles.linkBtn}
              disabled={isLoading}
            > 
              <Text style={styles.linkText}>
                Don&apos;t have an account? Register
              </Text>
            </TouchableOpacity> */}
          </Link>
        </View>
      </ScrollView>

      <OTPModal
        visible={showOtpModal}
        email={
          pendingEmail || email
        }
        onClose={() =>
          setShowOtpModal(false)
        }
        onSuccess={
          handleVerifyOTPSuccess
        }
      />

      <Toast />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },

  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  logo: {
    width: 150,
    height: 80,
    alignSelf: 'center',
    marginBottom: 20,
  },

  formContainer: {
    width: '100%',
  },

  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 32,
    textAlign: 'center',
  },

  input: {
    backgroundColor: '#fff',
    color: '#0f172a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    fontSize: 16,
  },

  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  passwordInput: {
    flex: 1,
    color: '#0f172a',
    padding: 16,
    fontSize: 16,
  },

  eyeIcon: {
    padding: 16,
  },

  permissionContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    marginBottom: 18,
  },

  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },

  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },

  checkboxChecked: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },

  permissionText: {
    flex: 1,
    color: '#0f172a',
    fontSize: 14,
    lineHeight: 20,
  },

  permissionRequired: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '600',
  },

  permissionStatusBlock: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 4,
  },

  permissionStatusText: {
    color: '#475569',
    fontSize: 12,
  },

  settingsButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },

  settingsButtonText: {
    color: '#1d4ed8',
    fontWeight: '600',
    fontSize: 12,
  },

  primaryBtn: {
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },

  disabledBtn: {
    opacity: 0.7,
  },

  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },

  linkBtn: {
    marginTop: 24,
    alignItems: 'center',
  },

  linkText: {
    color: '#3b82f6',
    fontSize: 15,
    fontWeight: '500',
  },
});