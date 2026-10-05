// app/(employee)/requests/index.tsx

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  RefreshControl,
  TextInput,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import {
  REQUEST_TYPES,
  RequestType,
  STATUS_COLORS,
  RequestStatus,
  requestTypeLabel,
} from '@/constants/requests';
import {
  useMyAttendanceRequests,
  useSendAttendanceRequest,
  useSendEarlyGoingRequest,
} from '@/hooks/useEmployeeApi';
import { useAuthStore } from '@/store/authStore';
import { getApiErrorMessage } from '@/api/axios';

type SubTab = 'my' | 'new';

export default function RequestsScreen() {
  const params = useLocalSearchParams<{ tab?: string; type?: string }>();

  const [subTab, setSubTab] = useState<SubTab>(
    params.tab === 'new' ? 'new' : 'my'
  );

  useEffect(() => {
    if (params.tab === 'new' || params.tab === 'my') {
      setSubTab(params.tab);
    }
  }, [params.tab]);

  // Validate the incoming `type` param against known request types so a bad
  // or missing query param never gets passed down as a bogus RequestType.
  const validInitialType = REQUEST_TYPES.some(
    (t) => t.value === params.type
  )
    ? (params.type as RequestType)
    : undefined;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.headerArea}>
        <Text style={styles.pageTitle}>Requests</Text>

        <View style={styles.subTabBar}>
          <TouchableOpacity
            style={[
              styles.subTab,
              subTab === 'my' && styles.subTabActive,
            ]}
            onPress={() => setSubTab('my')}
          >
            <Text
              style={[
                styles.subTabText,
                subTab === 'my' && styles.subTabTextActive,
              ]}
            >
              My Requests
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.subTab,
              subTab === 'new' && styles.subTabActive,
            ]}
            onPress={() => setSubTab('new')}
          >
            <Text
              style={[
                styles.subTabText,
                subTab === 'new' && styles.subTabTextActive,
              ]}
            >
              New Request
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {subTab === 'my' ? (
        <MyRequestsView />
      ) : (
        <NewRequestView
          onSubmitted={() => setSubTab('my')}
          initialType={validInitialType}
        />
      )}

      <Toast />
    </KeyboardAvoidingView>
  );
}

/* ============================================================
   MY REQUESTS
============================================================ */

function MyRequestsView() {
  const router = useRouter();

  const [statusFilter, setStatusFilter] = useState<
    'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'
  >('ALL');

  const [page, setPage] = useState(1);

  const {
    data,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useMyAttendanceRequests({
    status: statusFilter,
    page,
  });

  const requests = data?.requests || [];

  const handleLoadMore = () => {
    if (data?.pagination?.has_next_page) {
      setPage((prev) => prev + 1);
    }
  };

  const handleRefresh = () => {
    setPage(1);
    refetch();
  };

  if (isLoading && requests.length === 0) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons
          name="alert-circle-outline"
          size={48}
          color="#ef4444"
        />

        <Text style={styles.emptyText}>
          Couldn't load your requests.
        </Text>

        <TouchableOpacity
          onPress={() => refetch()}
          style={styles.retryBtn}
        >
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.listArea}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={!!isRefetching}
          onRefresh={handleRefresh}
        />
      }
    >
      {/* Status Filter Chips */}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
      >
        {(
          ['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const
        ).map((status) => (
          <TouchableOpacity
            key={status}
            style={[
              styles.filterChip,
              statusFilter === status &&
                styles.filterChipActive,
            ]}
            onPress={() => {
              setStatusFilter(status);
              setPage(1);
            }}
          >
            <Text
              style={[
                styles.filterChipText,
                statusFilter === status &&
                  styles.filterChipTextActive,
              ]}
            >
              {status}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {requests.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons
            name="document-text-outline"
            size={48}
            color="#94a3b8"
          />

          <Text style={styles.emptyText}>
            {statusFilter === 'ALL'
              ? "You haven't submitted any requests yet."
              : `No ${statusFilter.toLowerCase()} requests found.`}
          </Text>
        </View>
      ) : (
        <>
          {requests.map((item: any) => {
            const request = item.request;

            const status: RequestStatus =
              request.status || 'PENDING';

            const colors =
              STATUS_COLORS[status] ||
              STATUS_COLORS.PENDING;

            const id = request.id;

            return (
              <TouchableOpacity
                key={id}
                style={styles.requestCard}
                onPress={() =>
                  router.push(
                    `/(employee)/request-details/${id}`
                  )
                }
              >
                <View style={styles.requestCardHeader}>
                  <View style={styles.requestTypeContainer}>
                    <Ionicons
                      name={
                        request.type === 'LATE_ARRIVAL'
                          ? 'time-outline'
                          : request.type === 'OUTSIDE_WORK'
                          ? 'location-outline'
                          : request.type === 'EARLY_GOING'
                          ? 'exit-outline'
                          : 'document-text-outline'
                      }
                      size={18}
                      color="#3b82f6"
                    />

                    <Text style={styles.requestType}>
                      {requestTypeLabel(request.type)}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.pill,
                      { backgroundColor: colors.bg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        { color: colors.text },
                      ]}
                    >
                      {status}
                    </Text>
                  </View>
                </View>

                <Text style={styles.requestDate}>
                  {new Date(
                    request.requested_time || request.created_at
                  ).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Text>

                {!!request.task && (
                  <Text
                    style={styles.requestTask}
                    numberOfLines={2}
                  >
                    Task: {request.task}
                  </Text>
                )}

                {!!request.reason && (
                  <Text
                    style={styles.requestReason}
                    numberOfLines={2}
                  >
                    {request.reason}
                  </Text>
                )}

                <Text style={styles.requestMeta}>
                  Submitted:{' '}
                  {new Date(
                    request.created_at
                  ).toLocaleString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>

                {status === 'APPROVED' &&
                  request.approved_at && (
                    <View style={styles.approvalInfo}>
                      <Ionicons
                        name="checkmark-circle"
                        size={14}
                        color="#059669"
                      />

                      <Text style={styles.approvalText}>
                        Approved:{' '}
                        {new Date(
                          request.approved_at
                        ).toLocaleDateString('en-IN')}
                      </Text>
                    </View>
                  )}

                {status === 'REJECTED' &&
                  request.rejection_reason && (
                    <View style={styles.rejectionInfo}>
                      <Ionicons
                        name="close-circle"
                        size={14}
                        color="#dc2626"
                      />

                      <Text
                        style={styles.rejectionText}
                        numberOfLines={2}
                      >
                        Rejected:{' '}
                        {request.rejection_reason}
                      </Text>
                    </View>
                  )}
              </TouchableOpacity>
            );
          })}

          {/* Load More */}

          {data?.pagination?.has_next_page && (
            <TouchableOpacity
              style={styles.loadMoreBtn}
              onPress={handleLoadMore}
            >
              <Text style={styles.loadMoreText}>
                Load More
              </Text>
            </TouchableOpacity>
          )}

          {/* Pagination Info */}

          {data?.pagination && (
            <Text style={styles.paginationInfo}>
              Showing {data.pagination.returned_records} of{' '}
              {data.pagination.total_records} requests
              {data.pagination.total_pages > 1 &&
                ` (Page ${data.pagination.current_page} of ${data.pagination.total_pages})`}
            </Text>
          )}
        </>
      )}
    </ScrollView>
  );
}

/* ============================================================
   NEW REQUEST
============================================================ */

function NewRequestView({
  onSubmitted,
  initialType,
}: {
  onSubmitted: () => void;
  initialType?: RequestType;
}) {
  const { user } = useAuthStore();

  const [requestType, setRequestType] = useState<RequestType>(
    initialType || 'LATE_ARRIVAL'
  );

  // If we arrive here (or re-arrive) with a different preselected type via
  // the query param — e.g. redirected from the dashboard's Check Out button
  // — keep the form in sync with it.
  useEffect(() => {
    if (initialType) {
      setRequestType(initialType);
    }
  }, [initialType]);

  // Time state - storing as HH:MM string
  const [time, setTime] = useState('');

  // Task state
  const [task, setTask] = useState('');

  // Selected time for picker
  const [selectedTime, setSelectedTime] = useState<Date>(
    new Date()
  );

  // Show time picker
  const [showTimePicker, setShowTimePicker] =
    useState(false);

  const [reason, setReason] = useState('');

  // Location state
  const [location, setLocation] =
    useState<Location.LocationObject | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);

  // Get location on mount
  useEffect(() => {
    getLocation();
  }, []);

  const getLocation = async () => {
    setLoadingLocation(true);
    try {
      const { status } =
        await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Toast.show({
          type: 'error',
          text1: 'Permission Denied',
          text2:
            'Location permission is required to submit a request.',
        });
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setLocation(loc);
    } catch (error) {
      console.error('Location error:', error);
    } finally {
      setLoadingLocation(false);
    }
  };

  // Use both hooks - imported from useEmployeeApi
  const { mutateAsync: sendGenericRequest, isPending: isGenericPending } = useSendAttendanceRequest();
  const { mutateAsync: sendEarlyGoing, isPending: isEarlyGoingPending } = useSendEarlyGoingRequest();
  const isPending = isGenericPending || isEarlyGoingPending;

  /* ==========================================================
     TIME PICKER - FIXED FOR WEB
  ========================================================== */

  const handleTimeChange = (
    event: any,
    selectedDate?: Date
  ) => {
    let date = selectedDate;

    if (!date && event?.nativeEvent?.timestamp) {
      date = new Date(event.nativeEvent.timestamp);
    }

    if (!date && event?.target?.value) {
      const [hours, minutes] = event.target.value.split(':').map(Number);
      if (!isNaN(hours) && !isNaN(minutes)) {
        const d = new Date();
        d.setHours(hours, minutes, 0, 0);
        date = d;
      }
    }

    setTimeout(() => {
      setShowTimePicker(false);
    }, 100);

    if (!date) {
      return;
    }

    setSelectedTime(date);

    const hours = date
      .getHours()
      .toString()
      .padStart(2, '0');

    const minutes = date
      .getMinutes()
      .toString()
      .padStart(2, '0');

    setTime(`${hours}:${minutes}`);
  };

  const openTimePicker = () => {
    setShowTimePicker(true);
  };

  /* ==========================================================
     SUBMIT - Uses separate handlers for EARLY_GOING vs others
     - EARLY_GOING: Uses sendEarlyGoing hook
     - LATE_ARRIVAL / OUTSIDE_WORK: Uses sendGenericRequest hook
  ========================================================== */

  const handleSubmit = async () => {
    if (!task.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Missing Details',
        text2: 'Task description is required.',
      });
      return;
    }

    if (!reason.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Missing Details',
        text2: 'Reason is required.',
      });
      return;
    }

    if (!time.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Missing Details',
        text2: 'Please select a time.',
      });
      return;
    }

    if (!location) {
      Toast.show({
        type: 'error',
        text1: 'Location Required',
        text2: loadingLocation
          ? 'Still getting your location, please wait a moment.'
          : 'Please enable location and try again.',
      });
      return;
    }

    // Convert HH:MM to ISO timestamp
    const [hours, minutes] = time
      .trim()
      .split(':')
      .map(Number);

    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    const isoTime = date.toISOString();

    try {
      if (requestType === 'EARLY_GOING') {
        // Use the early going specific hook
        await sendEarlyGoing({
          userId: user?.employee_id || user?.id || '',
          reason: reason.trim(),
          task: task.trim(),
          time: isoTime,
          lat: location.coords.latitude,
          lng: location.coords.longitude,
        });

        Toast.show({
          type: 'success',
          text1: 'Early Going Request Submitted',
          text2: 'Your request has been sent to HR for approval. You can check out once approved.',
        });
      } else {
        // Use the generic request hook for LATE_ARRIVAL and OUTSIDE_WORK
        await sendGenericRequest({
          userId: user?.employee_id || user?.id || '',
          reason: reason.trim(),
          task: task.trim(),
          type: requestType,
          time: isoTime,
          lat: location.coords.latitude,
          lng: location.coords.longitude,
        });

        Toast.show({
          type: 'success',
          text1: 'Request Submitted',
          text2: 'Your request has been sent to HR for approval.',
        });
      }

      // Reset form
      setTime('');
      setTask('');
      setReason('');
      setSelectedTime(new Date());

      onSubmitted();
    } catch (error: any) {
      console.error('Submit error:', error);

      Toast.show({
        type: 'error',
        text1: 'Submission Failed',
        text2: getApiErrorMessage(error),
      });
    }
  };

  const getRequestTypeDescription = () => {
    switch (requestType) {
      case 'LATE_ARRIVAL':
        return 'Submit a request for arriving late to work.';
      case 'OUTSIDE_WORK':
        return 'Submit a request for working outside the office.';
      case 'EARLY_GOING':
        return 'Submit a request for leaving early from work. HR must approve this before you can check out.';
      default:
        return '';
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.formScroll}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.subtitle}>
        Submit a request for LATE ARRIVAL, OUTSIDE WORK,
        or EARLY GOING.
      </Text>

      {requestType === 'EARLY_GOING' && (
        <View style={styles.earlyGoingBanner}>
          <Ionicons
            name="information-circle-outline"
            size={16}
            color="#b45309"
          />
          <Text style={styles.earlyGoingBannerText}>
            You'll need to wait for HR approval on this request before the
            Check Out button will let you check out early.
          </Text>
        </View>
      )}

      {/* =====================================================
          LOCATION STATUS
      ===================================================== */}
      <View style={styles.locationBanner}>
        <Ionicons
          name={location ? 'location' : 'location-outline'}
          size={16}
          color={location ? '#15803d' : '#b45309'}
        />
        <Text
          style={[
            styles.locationBannerText,
            { color: location ? '#15803d' : '#b45309' },
          ]}
        >
          {loadingLocation
            ? 'Getting your location…'
            : location
            ? 'Location captured'
            : 'Location required to submit'}
        </Text>
        {!loadingLocation && (
          <TouchableOpacity onPress={getLocation}>
            <Text style={styles.locationBannerRetry}>
              {location ? 'Refresh' : 'Retry'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* =====================================================
          REQUEST TYPE
      ===================================================== */}

      <Text style={styles.label}>Request Type</Text>

      <View style={styles.typeGrid}>
        {REQUEST_TYPES.map((t) => (
          <TouchableOpacity
            key={t.value}
            style={[
              styles.typeChip,
              requestType === t.value &&
                styles.typeChipActive,
            ]}
            onPress={() => setRequestType(t.value)}
          >
            <Text
              style={[
                styles.typeChipText,
                requestType === t.value &&
                  styles.typeChipTextActive,
              ]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Request Type Description */}
      <View style={styles.typeDescriptionContainer}>
        <Ionicons
          name="information-circle-outline"
          size={16}
          color="#3b82f6"
        />
        <Text style={styles.typeDescriptionText}>
          {getRequestTypeDescription()}
        </Text>
      </View>

      {/* =====================================================
          TIME - FIXED FOR WEB
      ===================================================== */}

      <Text style={styles.label}>Time</Text>

      {Platform.OS === 'web' ? (
        <View style={styles.webTimeContainer}>
          <Ionicons
            name="time-outline"
            size={20}
            color={time ? '#3b82f6' : '#94a3b8'}
            style={styles.webTimeIcon}
          />
          <input
            type="time"
            value={time}
            onChange={(e) => {
              const value = e.target.value;
              setTime(value);
              if (value) {
                const [hours, minutes] = value.split(':').map(Number);
                const date = new Date();
                date.setHours(hours, minutes, 0, 0);
                setSelectedTime(date);
              }
            }}
            style={{
              flex: 1,
              height: 56,
              borderWidth: 1,
              borderColor: '#e2e8f0',
              borderRadius: 12,
              paddingHorizontal: 16,
              fontSize: 15,
              color: '#0f172a',
              backgroundColor: '#ffffff',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
        </View>
      ) : (
        <>
          <TouchableOpacity
            style={styles.timeSelector}
            activeOpacity={0.7}
            onPress={openTimePicker}
          >
            <View style={styles.timeSelectorLeft}>
              <Ionicons
                name="time-outline"
                size={20}
                color={time ? '#3b82f6' : '#94a3b8'}
              />

              <Text
                style={[
                  styles.timeText,
                  !time && styles.timePlaceholder,
                ]}
              >
                {time || 'Select time'}
              </Text>
            </View>

            <Ionicons
              name="chevron-down"
              size={20}
              color="#64748b"
            />
          </TouchableOpacity>

          {time && (
            <View style={styles.selectedTimeDisplay}>
              <Ionicons name="time-outline" size={16} color="#3b82f6" />
              <Text style={styles.selectedTimeText}>
                Selected: {time}
              </Text>
              <TouchableOpacity onPress={() => setTime('')}>
                <Ionicons name="close-circle" size={16} color="#ef4444" />
              </TouchableOpacity>
            </View>
          )}

          {showTimePicker && (
            <DateTimePicker
              value={selectedTime}
              mode="time"
              is24Hour={true}
              display={
                Platform.OS === 'ios'
                  ? 'spinner'
                  : 'default'
              }
              onChange={handleTimeChange}
            />
          )}
        </>
      )}

      {Platform.OS === 'web' && time && (
        <View style={styles.selectedTimeDisplay}>
          <Ionicons name="time-outline" size={16} color="#3b82f6" />
          <Text style={styles.selectedTimeText}>
            Selected: {time}
          </Text>
          <TouchableOpacity onPress={() => setTime('')}>
            <Ionicons name="close-circle" size={16} color="#ef4444" />
          </TouchableOpacity>
        </View>
      )}

      {/* =====================================================
          TASK
      ===================================================== */}

      <Text style={styles.label}>
        Task Description {requestType === 'EARLY_GOING' && '(Required)'}
      </Text>

      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder={
          requestType === 'EARLY_GOING'
            ? 'Describe the task you need to leave early for...'
            : requestType === 'LATE_ARRIVAL'
            ? 'Describe the task that caused the delay...'
            : 'Describe the task related to this request...'
        }
        placeholderTextColor="#94a3b8"
        value={task}
        onChangeText={setTask}
        multiline
        numberOfLines={2}
        textAlignVertical="top"
      />

      {/* =====================================================
          REASON
      ===================================================== */}

      <Text style={styles.label}>
        Reason {requestType === 'EARLY_GOING' && '(Required)'}
      </Text>

      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder={
          requestType === 'EARLY_GOING'
            ? 'Please explain why you need to leave early...'
            : requestType === 'LATE_ARRIVAL'
            ? 'Please explain why you will be late...'
            : 'Please explain your request in detail...'
        }
        placeholderTextColor="#94a3b8"
        value={reason}
        onChangeText={setReason}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
      />

      {/* =====================================================
          SUBMIT
      ===================================================== */}

      <TouchableOpacity
        style={[
          styles.primaryBtn,
          isPending && styles.disabledBtn,
          requestType === 'EARLY_GOING' && styles.earlyGoingBtn,
        ]}
        onPress={handleSubmit}
        disabled={isPending}
      >
        {isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>
            {requestType === 'EARLY_GOING'
              ? 'Submit Early Going Request'
              : 'Submit Request'}
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

/* ============================================================
   STYLES
============================================================ */

const styles = StyleSheet.create({
  locationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  locationBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  locationBannerRetry: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3b82f6',
  },
  earlyGoingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  earlyGoingBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },

  headerArea: {
    paddingHorizontal: 24,
    paddingTop: 60,
  },

  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
  },

  subTabBar: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },

  subTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },

  subTabActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  subTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },

  subTabTextActive: {
    color: '#3b82f6',
  },

  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },

  emptyText: {
    color: '#94a3b8',
    fontSize: 15,
    fontWeight: '500',
    paddingHorizontal: 24,
    textAlign: 'center',
    marginTop: 12,
  },

  listArea: {
    paddingHorizontal: 24,
    flex: 1,
  },

  filterContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    marginTop: 4,
  },

  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  filterChipActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },

  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },

  filterChipTextActive: {
    color: '#ffffff',
  },

  requestCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },

  requestCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },

  requestTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  requestType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginLeft: 6,
  },

  requestDate: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
    marginBottom: 4,
  },

  requestTask: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '500',
    marginTop: 2,
  },

  requestReason: {
    fontSize: 13,
    color: '#334155',
    marginTop: 2,
  },

  requestMeta: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 6,
  },

  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },

  pillText: {
    fontSize: 11,
    fontWeight: '700',
  },

  formScroll: {
    padding: 24,
    paddingTop: 0,
    paddingBottom: 80,
  },

  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 20,
    lineHeight: 20,
  },

  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 10,
    marginTop: 4,
  },

  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },

  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  typeChipActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },

  typeChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },

  typeChipTextActive: {
    color: '#ffffff',
  },

  typeDescriptionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#eff6ff',
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
  },

  typeDescriptionText: {
    flex: 1,
    fontSize: 13,
    color: '#1e40af',
    fontWeight: '500',
  },

  webTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  webTimeIcon: {
    marginRight: 10,
  },

  timeSelector: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  timeSelectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  timeText: {
    fontSize: 15,
    color: '#0f172a',
    marginLeft: 10,
    fontWeight: '500',
  },

  timePlaceholder: {
    color: '#94a3b8',
    fontWeight: '400',
  },

  selectedTimeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 20,
    gap: 8,
  },
  selectedTimeText: {
    flex: 1,
    fontSize: 14,
    color: '#1e40af',
    fontWeight: '600',
  },

  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: '#0f172a',
    marginBottom: 20,
  },

  textArea: {
    height: 110,
    textAlignVertical: 'top',
  },

  primaryBtn: {
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },

  earlyGoingBtn: {
    backgroundColor: '#f59e0b',
  },

  disabledBtn: {
    opacity: 0.7,
  },

  btnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },

  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
  },

  retryBtnText: {
    color: '#ffffff',
    fontWeight: '600',
  },

  loadMoreBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },

  loadMoreText: {
    color: '#3b82f6',
    fontWeight: '600',
  },

  paginationInfo: {
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 20,
  },

  approvalInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },

  approvalText: {
    fontSize: 12,
    color: '#059669',
    marginLeft: 4,
  },

  rejectionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },

  rejectionText: {
    fontSize: 12,
    color: '#dc2626',
    marginLeft: 4,
    flex: 1,
  },
});