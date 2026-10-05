import React, { useState } from 'react';
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
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { getApiErrorMessage, api } from '@/api/axios';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { registerForPushNotificationsAsync } from '@/lib/notifications';
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

  const {
    setAuthSuccess,
    setPendingEmail,
    pendingEmail,
  } = useAuthStore();

  const handleLogin = async () => {
    /**
     * Prevent duplicate login requests.
     */
    if (isLoading) {
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

      console.log(
        '📥 Login response:',
        response.data
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
        console.error(
          '❌ No token in login response:',
          response.data
        );

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
      const loggedInUser =
        useAuthStore.getState().user;

      console.log(
        '👤 Logged-in user:',
        loggedInUser
      );

      /**
       * Prefer user_id because your backend's
       * notification endpoint expects the user ID.
       *
       * Fall back to id / employee_id for compatibility
       * with your existing JWT structure.
       */
      const userId =
        loggedInUser?.user_id ??
        loggedInUser?.id ??
        loggedInUser?.employee_id;

      console.log(
        '👤 User ID for push token:',
        userId
      );

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
            '✅ Current device Expo Push Token registered:',
            pushToken
          );
        } else {
          console.log(
            'ℹ️ No push token registered on this device.'
          );
        }
      } catch (pushError) {
        /**
         * Do NOT show notification failure as a
         * login failure.
         */
        console.warn(
          '⚠️ Push notification registration failed:',
          pushError
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
      console.error(
        '❌ Login error:',
        error
      );

      /**
       * Server returned a response.
       */
      if (error?.response) {
        console.log(
          '📥 Server error status:',
          error.response.status
        );

        console.log(
          '📥 Server error data:',
          error.response.data
        );

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

          <TouchableOpacity
            style={[
              styles.primaryBtn,
              isLoading &&
                styles.disabledBtn,
            ]}
            onPress={handleLogin}
            disabled={isLoading}
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
            <TouchableOpacity
              style={styles.linkBtn}
              disabled={isLoading}
            >
              <Text style={styles.linkText}>
                Don't have an account? Register
              </Text>
            </TouchableOpacity>
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