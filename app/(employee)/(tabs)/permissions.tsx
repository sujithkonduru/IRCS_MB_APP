// app/(employee)/(tabs)/permissions.tsx

import React, { useState } from 'react';
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
  Modal,
  Alert,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import DateTimePicker from '@react-native-community/datetimepicker';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';

import {
  PERMISSION_STATUS_COLORS,
  PermissionStatus,
  permissionTypeLabel,
  MONTHLY_PERMISSION_LIMIT,
} from '@/constants/permission';

import {
  usePermissionRequests,
  useCreatePermissionRequest,
} from '@/hooks/useEmployeeApi';

import { useAuthStore } from '@/store/authStore';
import { getApiErrorMessage } from '@/api/axios';

type SubTab = 'my' | 'new';
type TimeTarget = 'from' | 'to' | null;

/* ============================================================
   DATE / TIME HELPERS
============================================================ */

function toDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function dateStringToDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);

  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);

  return date;
}

function formatDateToDisplay(date: Date) {
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getToday() {
  const today = new Date();

  today.setHours(0, 0, 0, 0);

  return today;
}

function formatTimeDisplay(value: string) {
  if (!value) return '';

  const [hours, minutes] = value.split(':').map(Number);

  const d = new Date();

  d.setHours(hours, minutes, 0, 0);

  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateTime(value: string) {
  const d = new Date(value);

  if (Number.isNaN(d.getTime())) {
    return value;
  }

  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function combineDateAndTime(date: Date, time: string) {
  const [hours, minutes] = time.split(':').map(Number);

  const combined = new Date(date);

  combined.setHours(hours, minutes, 0, 0);

  return combined;
}

/* ============================================================
   MAIN SCREEN
============================================================ */

export default function PermissionsScreen() {
  const [subTab, setSubTab] = useState<SubTab>('my');

  /*
   * Previous early-going logic:
   *
   * permissions screen can be opened with:
   *
   * ?type=EARLY_GOING&reasonRequired=true
   *
   * In that case the Request Permission screen behaves as
   * an Early Going request and the reason is mandatory.
   */
  const params = useLocalSearchParams<{
    type?: string | string[];
    reasonRequired?: string | string[];
  }>();

  const typeParam = Array.isArray(params.type)
    ? params.type[0]
    : params.type;

  const reasonRequiredParam = Array.isArray(params.reasonRequired)
    ? params.reasonRequired[0]
    : params.reasonRequired;

  const isEarlyGoingRequest =
    typeParam === 'EARLY_GOING' &&
    reasonRequiredParam === 'true';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ======================================================
          HEADER
      ====================================================== */}

      <View style={styles.headerArea}>
        <Text style={styles.pageTitle}>Permissions</Text>

        <View style={styles.subTabBar}>
          <TouchableOpacity
            style={[
              styles.subTab,
              subTab === 'my' && styles.subTabActive,
            ]}
            onPress={() => setSubTab('my')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.subTabText,
                subTab === 'my' && styles.subTabTextActive,
              ]}
            >
              My Permissions
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.subTab,
              subTab === 'new' && styles.subTabActive,
            ]}
            onPress={() => setSubTab('new')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.subTabText,
                subTab === 'new' && styles.subTabTextActive,
              ]}
            >
              Request Permission
            </Text>
          </TouchableOpacity>
        </View>

        {/* ====================================================
            EARLY GOING BANNER
        ==================================================== */}

        {subTab === 'new' && isEarlyGoingRequest && (
          <View style={styles.earlyGoingBanner}>
            <View style={styles.earlyGoingIcon}>
              <Ionicons
                name="exit-outline"
                size={20}
                color="#d97706"
              />
            </View>

            <View style={styles.earlyGoingContent}>
              <Text style={styles.earlyGoingTitle}>
                Early Going Request
              </Text>

              <Text style={styles.earlyGoingText}>
                Please select your leaving time and provide a reason
                for leaving before your shift ends.
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* ======================================================
          CONTENT
      ====================================================== */}

      {subTab === 'my' ? (
        <MyPermissionsView />
      ) : (
        <NewPermissionView
          onSubmitted={() => setSubTab('my')}
          isEarlyGoingRequest={isEarlyGoingRequest}
        />
      )}

      <Toast />
    </KeyboardAvoidingView>
  );
}

/* ============================================================
   MY PERMISSIONS
============================================================ */

function MyPermissionsView() {
  const router = useRouter();

  const [statusFilter, setStatusFilter] =
    useState<PermissionStatus | 'ALL'>('ALL');

  const {
    data,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = usePermissionRequests({
    status: statusFilter,
  });

  const requests = data?.requests || [];

  const handleRefresh = () => {
    refetch();
  };

  /* ==========================================================
     NAVIGATION
  ========================================================== */

  const navigateToDetails = (permissionId: string) => {
    try {
      console.log(
        '📱 Navigating to permission details:',
        permissionId,
      );

      router.push({
        pathname: '/permission-details/[id]',
        params: {
          id: permissionId,
        },
      });
    } catch (error) {
      console.error('❌ Navigation error:', error);

      Toast.show({
        type: 'error',
        text1: 'Navigation Error',
        text2:
          'Could not open permission details. Please try again.',
      });
    }
  };

  /* ==========================================================
     LOADING
  ========================================================== */

  if (isLoading && requests.length === 0) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator
          size="large"
          color="#3b82f6"
        />
      </View>
    );
  }

  /* ==========================================================
     ERROR
  ========================================================== */

  if (isError) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons
          name="alert-circle-outline"
          size={48}
          color="#ef4444"
        />

        <Text style={styles.emptyText}>
          Couldn't load your permissions.
        </Text>

        <TouchableOpacity
          onPress={() => refetch()}
          style={styles.retryBtn}
          activeOpacity={0.8}
        >
          <Text style={styles.retryBtnText}>
            Retry
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  /* ==========================================================
     LIST
  ========================================================== */

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
      {/* ====================================================
          FILTERS
      ==================================================== */}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
      >
        {(
          [
            'ALL',
            'PENDING',
            'APPROVED',
            'REJECTED',
          ] as const
        ).map((status) => (
          <TouchableOpacity
            key={status}
            style={[
              styles.filterChip,
              statusFilter === status &&
                styles.filterChipActive,
            ]}
            onPress={() => setStatusFilter(status)}
            activeOpacity={0.7}
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

      {/* ====================================================
          EMPTY
      ==================================================== */}

      {requests.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons
            name="exit-outline"
            size={48}
            color="#94a3b8"
          />

          <Text style={styles.emptyText}>
            {statusFilter === 'ALL'
              ? "You haven't requested any permission yet."
              : `No ${statusFilter.toLowerCase()} permissions found.`}
          </Text>
        </View>
      ) : (
        /* ==================================================
           REQUEST CARDS
        ================================================== */

        requests.map((item: any) => {
          const permission = item.permission;

          const status: PermissionStatus =
            permission.status || 'PENDING';

          const colors =
            PERMISSION_STATUS_COLORS[status] ||
            PERMISSION_STATUS_COLORS.PENDING;

          return (
            <TouchableOpacity
              key={permission.id}
              style={styles.requestCard}
              activeOpacity={0.8}
              onPress={() =>
                navigateToDetails(permission.id)
              }
            >
              {/* Header */}

              <View style={styles.requestCardHeader}>
                <View style={styles.requestTypeContainer}>
                  <Ionicons
                    name="exit-outline"
                    size={18}
                    color="#3b82f6"
                  />

                  <Text style={styles.requestType}>
                    {permissionTypeLabel(
                      permission.type,
                    )}
                  </Text>
                </View>

                <View
                  style={[
                    styles.pill,
                    {
                      backgroundColor: colors.bg,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.pillText,
                      {
                        color: colors.text,
                      },
                    ]}
                  >
                    {status}
                  </Text>
                </View>
              </View>

              {/* Date */}

              <Text style={styles.requestDate}>
                {formatDateTime(
                  permission.requested_from,
                )}{' '}
                -{' '}
                {formatDateTime(
                  permission.requested_to,
                )}

                {permission.requested_minutes
                  ? `  (${permission.requested_minutes} min)`
                  : ''}
              </Text>

              {/* Reason */}

              {!!permission.reason && (
                <Text
                  style={styles.requestReason}
                  numberOfLines={3}
                >
                  {permission.reason}
                </Text>
              )}

              {/* Submitted */}

              <Text style={styles.requestMeta}>
                Submitted:{' '}
                {new Date(
                  permission.created_at,
                ).toLocaleString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>

              {/* Approved */}

              {status === 'APPROVED' &&
                permission.approved_from &&
                permission.approved_to && (
                  <View
                    style={styles.approvalInfo}
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={14}
                      color="#059669"
                    />

                    <Text
                      style={styles.approvalText}
                    >
                      Approved:{' '}
                      {formatDateTime(
                        permission.approved_from,
                      )}{' '}
                      -{' '}
                      {formatDateTime(
                        permission.approved_to,
                      )}
                    </Text>
                  </View>
                )}

              {/* Rejected */}

              {status === 'REJECTED' &&
                !!permission.rejection_reason && (
                  <View
                    style={styles.rejectionInfo}
                  >
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
                      {permission.rejection_reason}
                    </Text>
                  </View>
                )}

              {/* Details */}

              <View style={styles.viewPassBtn}>
                <Ionicons
                  name="information-circle-outline"
                  size={16}
                  color="#3b82f6"
                />

                <Text
                  style={styles.viewPassBtnText}
                >
                  View Details
                </Text>
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
}

/* ============================================================
   NEW PERMISSION
============================================================ */

function NewPermissionView({
  onSubmitted,
  isEarlyGoingRequest,
}: {
  onSubmitted: () => void;
  isEarlyGoingRequest: boolean;
}) {
  const { user } = useAuthStore();

  const [date, setDate] =
    useState<Date>(getToday());

  const [fromTime, setFromTime] =
    useState('');

  const [toTime, setToTime] =
    useState('');

  const [reason, setReason] =
    useState('');

  /* ==========================================================
     MODALS
  ========================================================== */

  const [calendarVisible, setCalendarVisible] =
    useState(false);

  const [timeTarget, setTimeTarget] =
    useState<TimeTarget>(null);

  /* ==========================================================
     API
  ========================================================== */

  const {
    mutateAsync,
    isPending,
  } = useCreatePermissionRequest();

  /* ==========================================================
     CALENDAR
  ========================================================== */

  const openCalendar = () => {
    setCalendarVisible(true);
  };

  const closeCalendar = () => {
    setCalendarVisible(false);
  };

  const handleCalendarDateSelect = (
    dateString: string,
  ) => {
    setDate(
      dateStringToDate(dateString),
    );

    closeCalendar();
  };

  /* ==========================================================
     NATIVE TIME PICKER
  ========================================================== */

  const handleNativeTimeChange = (
    event: any,
    selectedDate?: Date,
  ) => {
    setTimeTarget(null);

    if (!selectedDate) {
      return;
    }

    const hours = selectedDate
      .getHours()
      .toString()
      .padStart(2, '0');

    const minutes = selectedDate
      .getMinutes()
      .toString()
      .padStart(2, '0');

    const value = `${hours}:${minutes}`;

    /*
     * IMPORTANT:
     *
     * We check the target before setting the value.
     */
    if (timeTarget === 'from') {
      setFromTime(value);
    }

    if (timeTarget === 'to') {
      setToTime(value);
    }
  };

  /* ==========================================================
     WEB TIME PICKER
  ========================================================== */

  const handleWebTimeChange = (
    target: 'from' | 'to',
    value: string,
  ) => {
    if (target === 'from') {
      setFromTime(value);
    }

    if (target === 'to') {
      setToTime(value);
    }
  };

  /* ==========================================================
     SUBMIT
  ========================================================== */

  const handleSubmit = async () => {
    /*
     * ========================================================
     * EARLY GOING VALIDATION
     *
     * This was the source of the previous error.
     *
     * `isEarlyGoingRequest` is now received through props,
     * so it is available inside this component.
     * ========================================================
     */

    if (
      isEarlyGoingRequest &&
      !reason.trim()
    ) {
      Alert.alert(
        'Reason required',
        'Please provide a reason for leaving before shift end.',
      );

      return;
    }

    /* ========================================================
       TIME VALIDATION
    ======================================================== */

    if (!fromTime || !toTime) {
      Toast.show({
        type: 'error',
        text1: 'Missing Details',
        text2:
          'Please select a from and to time.',
      });

      return;
    }

    /* ========================================================
       REASON VALIDATION
    ======================================================== */

    if (!reason.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Missing Details',
        text2: 'Reason is required.',
      });

      return;
    }

    /* ========================================================
       COMBINE DATE + TIME
    ======================================================== */

    const requestedFrom =
      combineDateAndTime(
        date,
        fromTime,
      );

    const requestedTo =
      combineDateAndTime(
        date,
        toTime,
      );

    /* ========================================================
       RANGE VALIDATION
    ======================================================== */

    if (
      requestedFrom.getTime() >=
      requestedTo.getTime()
    ) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Time Range',
        text2:
          'From time must be before to time.',
      });

      return;
    }

    /* ========================================================
       USER ID
    ======================================================== */

    const userId =
      user?.employee_id ||
      user?.id;

    if (!userId) {
      Toast.show({
        type: 'error',
        text1: 'Authentication Error',
        text2:
          'User ID not found. Please login again.',
      });

      return;
    }

    /* ========================================================
       SUBMIT API REQUEST
    ======================================================== */

    try {
      console.log(
        '📤 Submitting permission request:',
        {
          userId,
          requested_from:
            requestedFrom.toISOString(),
          requested_to:
            requestedTo.toISOString(),
          reason: reason.trim(),
          isEarlyGoingRequest,
        },
      );

      await mutateAsync({
        userId,
        requested_from:
          requestedFrom.toISOString(),
        requested_to:
          requestedTo.toISOString(),
        reason: reason.trim(),
      });

      /* ======================================================
         SUCCESS
      ====================================================== */

      Toast.show({
        type: 'success',
        text1: isEarlyGoingRequest
          ? 'Early Going Requested'
          : 'Permission Requested',
        text2:
          'Your permission request has been sent for approval.',
      });

      /* ======================================================
         RESET FORM
      ====================================================== */

      setDate(getToday());
      setFromTime('');
      setToTime('');
      setReason('');

      /* ======================================================
         RETURN TO MY PERMISSIONS
      ====================================================== */

      onSubmitted();
    } catch (error: any) {
      console.error(
        'Permission submit error:',
        error,
      );

      Toast.show({
        type: 'error',
        text1: 'Submission Failed',
        text2: getApiErrorMessage(error),
      });
    }
  };

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <>
      <ScrollView
        contentContainerStyle={
          styles.formScroll
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ====================================================
            EARLY GOING INFORMATION
        ==================================================== */}

        {isEarlyGoingRequest && (
          <View style={styles.earlyGoingFormCard}>
            <View
              style={styles.earlyGoingFormIcon}
            >
              <Ionicons
                name="alert-circle-outline"
                size={22}
                color="#d97706"
              />
            </View>

            <View
              style={styles.earlyGoingFormContent}
            >
              <Text
                style={styles.earlyGoingFormTitle}
              >
                Early Going
              </Text>

              <Text
                style={styles.earlyGoingFormText}
              >
                Select your expected leaving time
                and provide a reason. The reason is
                required for early-going requests.
              </Text>
            </View>
          </View>
        )}

        {/* ====================================================
            DESCRIPTION
        ==================================================== */}

        <Text style={styles.subtitle}>
          {isEarlyGoingRequest
            ? 'Request to leave before your scheduled shift end time.'
            : `Request time off within your shift (e.g. a doctor's visit). Up to ${MONTHLY_PERMISSION_LIMIT} permissions are allowed per month.`}
        </Text>

        {/* ====================================================
            DATE
        ==================================================== */}

        <Text style={styles.label}>
          Date
        </Text>

        <TouchableOpacity
          style={styles.dateSelector}
          activeOpacity={0.7}
          onPress={openCalendar}
        >
          <View
            style={styles.dateSelectorLeft}
          >
            <View
              style={
                styles.calendarIconContainer
              }
            >
              <Ionicons
                name="calendar-outline"
                size={22}
                color="#3b82f6"
              />
            </View>

            <View>
              <Text
                style={styles.dateSmallLabel}
              >
                Permission Date
              </Text>

              <Text
                style={styles.dateText}
              >
                {formatDateToDisplay(date)}
              </Text>
            </View>
          </View>

          <Ionicons
            name="chevron-forward"
            size={20}
            color="#64748b"
          />
        </TouchableOpacity>

        {/* ====================================================
            FROM TIME
        ==================================================== */}

        <Text style={styles.label}>
          From Time
        </Text>

        {Platform.OS === 'web' ? (
          <View
            style={styles.webTimeContainer}
          >
            <Ionicons
              name="time-outline"
              size={20}
              color={
                fromTime
                  ? '#3b82f6'
                  : '#94a3b8'
              }
              style={styles.webTimeIcon}
            />

            {/* @ts-ignore - web only */}
            <input
              type="time"
              value={fromTime}
              onChange={(e: any) =>
                handleWebTimeChange(
                  'from',
                  e.target.value,
                )
              }
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                fontSize: 15,
                padding: 16,
                backgroundColor:
                  'transparent',
                color: '#0f172a',
              }}
            />
          </View>
        ) : (
          <TouchableOpacity
            style={styles.timeSelector}
            activeOpacity={0.7}
            onPress={() =>
              setTimeTarget('from')
            }
          >
            <View
              style={
                styles.timeSelectorLeft
              }
            >
              <Ionicons
                name="time-outline"
                size={20}
                color={
                  fromTime
                    ? '#3b82f6'
                    : '#94a3b8'
                }
              />

              <Text
                style={[
                  styles.timeText,
                  !fromTime &&
                    styles.timePlaceholder,
                ]}
              >
                {fromTime
                  ? formatTimeDisplay(
                      fromTime,
                    )
                  : 'Select from time'}
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={20}
              color="#64748b"
            />
          </TouchableOpacity>
        )}

        {/* ====================================================
            TO TIME
        ==================================================== */}

        <Text style={styles.label}>
          To Time
        </Text>

        {Platform.OS === 'web' ? (
          <View
            style={styles.webTimeContainer}
          >
            <Ionicons
              name="time-outline"
              size={20}
              color={
                toTime
                  ? '#3b82f6'
                  : '#94a3b8'
              }
              style={styles.webTimeIcon}
            />

            {/* @ts-ignore - web only */}
            <input
              type="time"
              value={toTime}
              onChange={(e: any) =>
                handleWebTimeChange(
                  'to',
                  e.target.value,
                )
              }
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                fontSize: 15,
                padding: 16,
                backgroundColor:
                  'transparent',
                color: '#0f172a',
              }}
            />
          </View>
        ) : (
          <TouchableOpacity
            style={styles.timeSelector}
            activeOpacity={0.7}
            onPress={() =>
              setTimeTarget('to')
            }
          >
            <View
              style={
                styles.timeSelectorLeft
              }
            >
              <Ionicons
                name="time-outline"
                size={20}
                color={
                  toTime
                    ? '#3b82f6'
                    : '#94a3b8'
                }
              />

              <Text
                style={[
                  styles.timeText,
                  !toTime &&
                    styles.timePlaceholder,
                ]}
              >
                {toTime
                  ? formatTimeDisplay(
                      toTime,
                    )
                  : 'Select to time'}
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={20}
              color="#64748b"
            />
          </TouchableOpacity>
        )}

        {/* ====================================================
            SELECTED RANGE
        ==================================================== */}

        {!!fromTime && !!toTime && (
          <View
            style={styles.dateSummary}
          >
            <View
              style={styles.dateSummaryIcon}
            >
              <Ionicons
                name="checkmark-circle"
                size={18}
                color="#059669"
              />
            </View>

            <View
              style={styles.dateSummaryContent}
            >
              <Text
                style={
                  styles.dateSummaryTitle
                }
              >
                {isEarlyGoingRequest
                  ? 'Selected Early Going'
                  : 'Selected Permission'}
              </Text>

              <Text
                style={styles.dateSummaryText}
              >
                {formatDateToDisplay(
                  date,
                )}
                ,{' '}
                {formatTimeDisplay(
                  fromTime,
                )}{' '}
                -{' '}
                {formatTimeDisplay(
                  toTime,
                )}
              </Text>
            </View>
          </View>
        )}

        {/* ====================================================
            REASON
        ==================================================== */}

        <View style={styles.reasonLabelRow}>
          <Text style={styles.label}>
            Reason
          </Text>

          {isEarlyGoingRequest && (
            <Text
              style={
                styles.requiredText
              }
            >
              Required
            </Text>
          )}
        </View>

        <TextInput
          style={[
            styles.input,
            styles.textArea,
          ]}
          placeholder={
            isEarlyGoingRequest
              ? 'Please explain why you need to leave before shift end...'
              : 'Please explain the reason for your permission...'
          }
          placeholderTextColor="#94a3b8"
          value={reason}
          onChangeText={setReason}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        {/* ====================================================
            SUBMIT
        ==================================================== */}

        <TouchableOpacity
          style={[
            styles.primaryBtn,
            isPending &&
              styles.disabledBtn,
          ]}
          onPress={handleSubmit}
          disabled={isPending}
          activeOpacity={0.8}
        >
          {isPending ? (
            <ActivityIndicator
              color="#ffffff"
            />
          ) : (
            <>
              <Ionicons
                name="send-outline"
                size={19}
                color="#ffffff"
              />

              <Text
                style={styles.btnText}
              >
                {isEarlyGoingRequest
                  ? 'Submit Early Going Request'
                  : 'Submit Permission Request'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* ======================================================
          CALENDAR MODAL
      ====================================================== */}

      <Modal
        visible={calendarVisible}
        transparent
        animationType="fade"
        onRequestClose={
          closeCalendar
        }
      >
        <View
          style={
            styles.calendarModalOverlay
          }
        >
          <View
            style={
              styles.calendarModal
            }
          >
            {/* Header */}

            <View
              style={
                styles.calendarModalHeader
              }
            >
              <View>
                <Text
                  style={
                    styles.calendarModalTitle
                  }
                >
                  Select Date
                </Text>

                <Text
                  style={
                    styles.calendarModalSubtitle
                  }
                >
                  Choose the permission date
                </Text>
              </View>

              <TouchableOpacity
                onPress={
                  closeCalendar
                }
                style={
                  styles.closeButton
                }
                activeOpacity={0.7}
              >
                <Ionicons
                  name="close"
                  size={22}
                  color="#475569"
                />
              </TouchableOpacity>
            </View>

            {/* Calendar */}

            <Calendar
              current={toDateString(date)}
              markedDates={{
                [toDateString(date)]: {
                  selected: true,
                  selectedColor:
                    '#3b82f6',
                  selectedTextColor:
                    '#ffffff',
                },
              }}
              onDayPress={(day) =>
                handleCalendarDateSelect(
                  day.dateString,
                )
              }
              enableSwipeMonths
              hideExtraDays={false}
              firstDay={1}
              theme={{
                backgroundColor:
                  '#ffffff',
                calendarBackground:
                  '#ffffff',
                textSectionTitleColor:
                  '#64748b',
                selectedDayBackgroundColor:
                  '#3b82f6',
                selectedDayTextColor:
                  '#ffffff',
                todayTextColor:
                  '#3b82f6',
                dayTextColor:
                  '#0f172a',
                textDisabledColor:
                  '#cbd5e1',
                arrowColor:
                  '#3b82f6',
                monthTextColor:
                  '#0f172a',
                textMonthFontWeight:
                  '700',
                textDayFontWeight:
                  '500',
                textDayHeaderFontWeight:
                  '600',
                textDayFontSize: 14,
                textMonthFontSize: 17,
                textDayHeaderFontSize: 12,
              }}
              style={
                styles.calendar
              }
            />

            {/* Cancel */}

            <TouchableOpacity
              style={
                styles.calendarCancelBtn
              }
              onPress={
                closeCalendar
              }
              activeOpacity={0.7}
            >
              <Text
                style={
                  styles.calendarCancelText
                }
              >
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ======================================================
          NATIVE TIME PICKER
      ====================================================== */}

      {timeTarget &&
        Platform.OS !== 'web' && (
          <DateTimePicker
            value={
              timeTarget === 'from'
                ? fromTime
                  ? combineDateAndTime(
                      date,
                      fromTime,
                    )
                  : new Date()
                : toTime
                ? combineDateAndTime(
                    date,
                    toTime,
                  )
                : new Date()
            }
            mode="time"
            is24Hour={false}
            display={
              Platform.OS === 'ios'
                ? 'spinner'
                : 'default'
            }
            onChange={
              handleNativeTimeChange
            }
          />
        )}
    </>
  );
}

/* ============================================================
   STYLES
============================================================ */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },

  /* ==========================================================
     HEADER
  ========================================================== */

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

  /* ==========================================================
     EARLY GOING HEADER BANNER
  ========================================================== */

  earlyGoingBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },

  earlyGoingIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },

  earlyGoingContent: {
    flex: 1,
    marginLeft: 10,
  },

  earlyGoingTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400e',
    marginBottom: 3,
  },

  earlyGoingText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#a16207',
  },

  /* ==========================================================
     LOADING / EMPTY
  ========================================================== */

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

  /* ==========================================================
     LIST
  ========================================================== */

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
    flexShrink: 1,
  },

  requestType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginLeft: 6,
    flexShrink: 1,
  },

  requestDate: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
    marginBottom: 4,
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

  /* ==========================================================
     FORM
  ========================================================== */

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

  /* ==========================================================
     EARLY GOING FORM CARD
  ========================================================== */

  earlyGoingFormCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },

  earlyGoingFormIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },

  earlyGoingFormContent: {
    flex: 1,
    marginLeft: 10,
  },

  earlyGoingFormTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400e',
    marginBottom: 3,
  },

  earlyGoingFormText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#a16207',
  },

  /* ==========================================================
     LABEL
  ========================================================== */

  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 10,
    marginTop: 4,
  },

  reasonLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  requiredText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#dc2626',
    marginBottom: 10,
  },

  /* ==========================================================
     DATE
  ========================================================== */

  dateSelector: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    minHeight: 68,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  dateSelectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  calendarIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  dateSmallLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
    marginBottom: 2,
  },

  dateText: {
    fontSize: 15,
    color: '#0f172a',
    fontWeight: '700',
  },

  /* ==========================================================
     TIME
  ========================================================== */

  webTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
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
    marginBottom: 20,
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

  /* ==========================================================
     SELECTED RANGE
  ========================================================== */

  dateSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#d1fae5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },

  dateSummaryIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },

  dateSummaryContent: {
    marginLeft: 10,
    flex: 1,
  },

  dateSummaryTitle: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '700',
    marginBottom: 2,
  },

  dateSummaryText: {
    fontSize: 13,
    color: '#065f46',
    fontWeight: '600',
  },

  /* ==========================================================
     INPUT
  ========================================================== */

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

  /* ==========================================================
     SUBMIT BUTTON
  ========================================================== */

  primaryBtn: {
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    flexDirection: 'row',
    gap: 8,
  },

  disabledBtn: {
    opacity: 0.7,
  },

  btnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },

  /* ==========================================================
     RETRY
  ========================================================== */

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

  /* ==========================================================
     APPROVAL / REJECTION
  ========================================================== */

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

  /* ==========================================================
     DETAILS BUTTON
  ========================================================== */

  viewPassBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#dbeafe',
  },

  viewPassBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3b82f6',
  },

  /* ==========================================================
     CALENDAR MODAL
  ========================================================== */

  calendarModalOverlay: {
    flex: 1,
    backgroundColor:
      'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  calendarModal: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },

  calendarModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },

  calendarModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },

  calendarModalSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 3,
  },

  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },

  calendar: {
    paddingHorizontal: 10,
    paddingBottom: 10,
  },

  calendarCancelBtn: {
    marginHorizontal: 20,
    marginBottom: 20,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },

  calendarCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
});