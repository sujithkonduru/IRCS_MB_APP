import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import Toast from 'react-native-toast-message';
import {
  getApiErrorMessage,
  getCampusPresenceRequest,
  getPendingCampusPresenceRequests,
  respondToCampusPresenceRequest,
  type CampusPresenceRequest,
} from '@/api/axios';
import { useAuthStore } from '@/store/authStore';
import { subscribeToCampusPresenceAlerts } from '@/lib/notifications';

function getRequestId(request: CampusPresenceRequest): string | null {
  const value = request.id ?? request.requestId ?? request.request_id;
  return value === undefined || value === null ? null : String(value);
}

function getErrorText(error: unknown): string {
  const value = error as { response?: unknown; message?: unknown };
  if (!value?.response && typeof value?.message === 'string') {
    return value.message;
  }
  return getApiErrorMessage(error);
}

function isRequestClosed(request: CampusPresenceRequest): boolean {
  const status = String(request.status ?? '').trim().toUpperCase();
  return (
    ['COMPLETED', 'RESPONDED', 'ACCEPTED', 'CLOSED', 'EXPIRED'].includes(status) ||
    (typeof request.response === 'string' && request.response.trim().length > 0)
  );
}

function getRequestExpiry(request: CampusPresenceRequest): string | null {
  const value = request.expiresAt ?? request.expires_at;
  return typeof value === 'string' && value.trim() ? value : null;
}

function isRequestExpired(request: CampusPresenceRequest): boolean {
  const expiresAt = getRequestExpiry(request);
  if (!expiresAt) {
    return false;
  }
  const expiryTime = new Date(expiresAt).getTime();
  return Number.isFinite(expiryTime) && expiryTime <= Date.now();
}

export default function CampusPresenceScreen() {
  const router = useRouter();
  const { requestId: routeRequestId } =
    useLocalSearchParams<{ requestId?: string | string[] }>();
  const requestId = Array.isArray(routeRequestId)
    ? routeRequestId[0]
    : routeRequestId;
  const { token } = useAuthStore();
  const [requests, setRequests] = useState<CampusPresenceRequest[]>([]);
  const [request, setRequest] = useState<CampusPresenceRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submissionLock = useRef(false);
  const requestSequence = useRef(0);
  const loadInProgress = useRef(false);

  useEffect(() => {
    if (!token) {
      router.replace('/(login)');
    }
  }, [router, token]);

  const load = useCallback(
    async (showInitialLoading = false, force = false) => {
      if (!token || (loadInProgress.current && !force)) {
        return;
      }

      loadInProgress.current = true;
      const sequence = ++requestSequence.current;
      setError(null);
      if (showInitialLoading) {
        if (requestId) {
          setRequest(null);
        } else {
          setRequests([]);
        }
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      try {
        if (requestId) {
          const currentRequest = await getCampusPresenceRequest(requestId);
          if (sequence === requestSequence.current) {
            setRequest(currentRequest);
          }
        } else {
          const pendingRequests = await getPendingCampusPresenceRequests();
          if (sequence === requestSequence.current) {
            setRequests(pendingRequests);
          }
        }
      } catch (loadError) {
        if (sequence === requestSequence.current) {
          setError(getErrorText(loadError));
        }
      } finally {
        if (sequence === requestSequence.current) {
          loadInProgress.current = false;
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [requestId, token],
  );

  useFocusEffect(
    useCallback(() => {
      void load(true, true);

      const pollTimer = setInterval(() => {
        if (AppState.currentState === 'active') {
          void load(false);
        }
      }, 30000);

      const appStateSubscription = AppState.addEventListener(
        'change',
        (state) => {
          if (state === 'active') {
            void load(false, true);
          }
        },
      );

      return () => {
        clearInterval(pollTimer);
        appStateSubscription.remove();
        requestSequence.current += 1;
        loadInProgress.current = false;
      };
    }, [load]),
  );

  useEffect(
    () =>
      subscribeToCampusPresenceAlerts((alert) => {
        if (!requestId || !alert.requestId || alert.requestId === requestId) {
          void load(false, true);
        }
      }),
    [load, requestId],
  );

  const refresh = useCallback(() => {
    void load(false, true);
  }, [load]);

  const acceptAndShareLocation = useCallback(async () => {
    if (
      !requestId ||
      !request ||
      submissionLock.current ||
      isRequestClosed(request) ||
      isRequestExpired(request)
    ) {
      return;
    }

    submissionLock.current = true;
    setIsSubmitting(true);
    setError(null);

    try {
      const latestRequest = await getCampusPresenceRequest(requestId);
      setRequest(latestRequest);
      if (isRequestClosed(latestRequest) || isRequestExpired(latestRequest)) {
        setError('This request is no longer active. Its current server status is shown above.');
        return;
      }

      let permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== 'granted' && permission.canAskAgain) {
        permission = await Location.requestForegroundPermissionsAsync();
      }
      if (permission.status !== 'granted') {
        throw new Error(
          'Location permission is required. Enable location access in Settings, then retry.',
        );
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        throw new Error('Turn on device location services, then retry.');
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      await respondToCampusPresenceRequest(requestId, {
        action: 'ACCEPT',
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      });

      Toast.show({
        type: 'success',
        text1: 'Location shared',
        text2: 'Your response was accepted by the server.',
      });
      try {
        const updatedRequest = await getCampusPresenceRequest(requestId);
        setRequest(updatedRequest);
      } catch (refreshError) {
        setError(
          `Your location was accepted, but the current request status could not be refreshed: ${getErrorText(refreshError)}`,
        );
      }
    } catch (submitError) {
      const message = getErrorText(submitError);
      setError(message);
      Toast.show({
        type: 'error',
        text1: 'Unable to share location',
        text2: message,
      });
    } finally {
      submissionLock.current = false;
      setIsSubmitting(false);
    }
  }, [request, requestId]);

  if (!token) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.title}>Campus Presence Verification</Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.mutedText}>Loading your verification request...</Text>
        </View>
      ) : error && !request && requests.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={42} color="#dc2626" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={refresh}>
            <Text style={styles.primaryButtonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : requestId ? (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={refresh} />
          }
        >
          <View style={styles.card}>
            <View style={styles.cardHeading}>
              <View style={styles.iconCircle}>
                <Ionicons name="location-outline" size={24} color="#2563eb" />
              </View>
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>
                  {request?.title || 'Campus Presence Check'}
                </Text>
                <Text style={styles.statusText}>
                  Status: {request?.status || 'Unknown'}
                </Text>
              </View>
            </View>

            <Text style={styles.message}>
              {request?.message ||
                'Please confirm whether you are currently inside the campus.'}
            </Text>

            {!!request && !!getRequestExpiry(request) && (
              <Text style={styles.mutedText}>
                Expires: {new Date(getRequestExpiry(request) as string).toLocaleString()}
              </Text>
            )}

            {!!error && <Text style={styles.errorText}>{error}</Text>}

            {request && isRequestClosed(request) ? (
              <View style={styles.completedBanner}>
                <Ionicons name="checkmark-circle" size={20} color="#059669" />
                <Text style={styles.completedText}>
                  Current server status: {request.response || request.status}
                </Text>
              </View>
            ) : request && isRequestExpired(request) ? (
              <View>
                <Text style={styles.errorText}>
                  This request has expired. Refresh to load its current server status.
                </Text>
                <TouchableOpacity style={styles.retryButton} onPress={refresh}>
                  <Text style={styles.primaryButtonText}>Refresh status</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.responseButton, styles.insideButton]}
                  disabled={isSubmitting}
                  onPress={() => void acceptAndShareLocation()}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>
                      Accept &amp; Share Location
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={refresh} />
          }
        >
          <Text style={styles.sectionTitle}>Pending verification requests</Text>
          {!!error && <Text style={styles.errorText}>{error}</Text>}
          {requests.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="checkmark-done-outline" size={34} color="#059669" />
              <Text style={styles.emptyText}>There are no pending requests.</Text>
            </View>
          ) : (
            requests.map((item, index) => {
              const id = getRequestId(item);
              return (
                <TouchableOpacity
                  key={id ?? `campus-request-${index}`}
                  style={styles.listItem}
                  disabled={!id}
                  onPress={() => {
                    if (id) {
                      router.push({
                        pathname: '/(employee)/campus-presence' as any,
                        params: { requestId: id },
                      });
                    }
                  }}
                >
                  <View style={styles.iconCircle}>
                    <Ionicons name="location-outline" size={22} color="#2563eb" />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.cardTitle}>
                      {item.title || 'Campus Presence Check'}
                    </Text>
                    <Text style={styles.mutedText}>
                      {item.message || 'Please confirm your current campus presence.'}
                    </Text>
                    {!!item.status && (
                      <Text style={styles.statusText}>Status: {item.status}</Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 58,
    paddingBottom: 18,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: { padding: 6, marginRight: 10 },
  title: { flex: 1, fontSize: 19, fontWeight: '800', color: '#0f172a' },
  content: { padding: 20, flexGrow: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeading: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  flex: { flex: 1 },
  cardTitle: { color: '#0f172a', fontSize: 16, fontWeight: '700' },
  statusText: { color: '#64748b', fontSize: 12, marginTop: 4 },
  message: { color: '#334155', fontSize: 15, lineHeight: 22, marginBottom: 14 },
  mutedText: { color: '#64748b', fontSize: 13, marginTop: 6, lineHeight: 19 },
  errorText: { color: '#b91c1c', fontSize: 14, lineHeight: 20, marginTop: 12 },
  actions: { gap: 10, marginTop: 20 },
  responseButton: {
    minHeight: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  insideButton: { backgroundColor: '#2563eb' },
  outsideButton: { backgroundColor: '#475569' },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#ecfdf5',
  },
  completedText: { color: '#047857', fontSize: 14, fontWeight: '700', flex: 1 },
  sectionTitle: { color: '#0f172a', fontSize: 16, fontWeight: '700', marginBottom: 14 },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 28,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyText: { color: '#475569', fontSize: 14, marginTop: 10, textAlign: 'center' },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  retryButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 16,
  },
});
