// app/(employee)/(tabs)/leave.tsx

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
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import {
  LEAVE_TYPES,
  LeaveType,
  LEAVE_STATUS_COLORS,
  LeaveStatus,
  isSingleDayLeave,
} from '@/constants/leave';
import {
  useMyLeaveRequests,
  useCreateLeaveRequest,
  useEmployeeStatus,
} from '@/hooks/useEmployeeApi';
import { useAuthStore } from '@/store/authStore';
import {
  getApiErrorMessage,
  getRemainingLeaveBalance,
  toFiniteNumber,
  type LeaveBalance,
} from '@/api/axios';

type SubTab = 'my' | 'new';
type CalendarTarget = 'from' | 'to' | null;

/* ============================================================
   DATE HELPERS
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

function formatDisplayDate(value: string) {
  const date = dateStringToDate(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
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

function isDateBefore(date1: Date, date2: Date) {
  const first = new Date(date1);
  const second = new Date(date2);
  first.setHours(0, 0, 0, 0);
  second.setHours(0, 0, 0, 0);
  return first.getTime() < second.getTime();
}

/* ============================================================
   MAIN SCREEN
============================================================ */

export default function LeaveScreen() {
  const [subTab, setSubTab] = useState<SubTab>('my');
  const [submittedRemaining, setSubmittedRemaining] = useState<number | null>(null);

  const handleLeaveSubmitted = (remainingAfterApproval: number | null) => {
    setSubmittedRemaining(remainingAfterApproval);
    setSubTab('my');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.headerArea}>
        <Text style={styles.pageTitle}>Leave</Text>

        <View style={styles.subTabBar}>
          <TouchableOpacity
            style={[styles.subTab, subTab === 'my' && styles.subTabActive]}
            onPress={() => setSubTab('my')}
            activeOpacity={0.7}
          >
            <Text style={[styles.subTabText, subTab === 'my' && styles.subTabTextActive]}>
              My Leaves
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.subTab, subTab === 'new' && styles.subTabActive]}
            onPress={() => setSubTab('new')}
            activeOpacity={0.7}
          >
            <Text style={[styles.subTabText, subTab === 'new' && styles.subTabTextActive]}>
              Apply for Leave
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {subTab === 'my' ? (
        <MyLeavesView submittedRemaining={submittedRemaining} />
      ) : (
        <NewLeaveView onSubmitted={handleLeaveSubmitted} />
      )}

      <Toast />
    </KeyboardAvoidingView>
  );
}

/* ============================================================
   MY LEAVES
============================================================ */

function MyLeavesView({ submittedRemaining }: { submittedRemaining: number | null }) {
  const [statusFilter, setStatusFilter] = useState<LeaveStatus | 'ALL'>('ALL');

  const { data, isLoading, isError, refetch, isRefetching } = useMyLeaveRequests({
    status: statusFilter,
  });
  const { data: employeeStatus, refetch: refetchStatus } = useEmployeeStatus();

  const requests = data?.requests || [];
  const listBalance = requests.find((item) => item.leave_balance)?.leave_balance || null;
  const balance = employeeStatus?.statistics?.leaves?.balance || listBalance;

  const handleRefresh = () => {
    refetch();
    refetchStatus();
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
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text style={styles.emptyText}>Couldn't load your leaves.</Text>
        <TouchableOpacity onPress={() => refetch()} style={styles.retryBtn} activeOpacity={0.8}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.listArea}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={!!isRefetching} onRefresh={handleRefresh} />}
    >
      <LeaveBalanceCard balance={balance} submittedRemaining={submittedRemaining} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
        {([ 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const).map((status) => (
          <TouchableOpacity
            key={status}
            style={[styles.filterChip, statusFilter === status && styles.filterChipActive]}
            onPress={() => setStatusFilter(status)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterChipText, statusFilter === status && styles.filterChipTextActive]}>
              {status}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {requests.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="airplane-outline" size={48} color="#94a3b8" />
         <Text style={styles.emptyText}>
            {statusFilter === 'ALL'
          //     // {/* ? "You haven't applied for any leave yet." */}
                    ? "You haven't applied for any leave yet."
          : `No ${statusFilter.toLowerCase()} leaves found.`} 
          </Text> 
        </View>
      ) : (
        requests.map((item: any) => {
          const leave = item.leave;
          const status: LeaveStatus = leave.status || 'PENDING';
          const colors = LEAVE_STATUS_COLORS[status] || LEAVE_STATUS_COLORS.PENDING;

          return (
            <View key={leave.id} style={styles.requestCard}>
              <View style={styles.requestCardHeader}>
                <View style={styles.requestTypeContainer}>
                  <Ionicons name="airplane-outline" size={18} color="#3b82f6" />
                  <Text style={styles.requestType}>
                    {leave.from_date === leave.to_date
                      ? formatDisplayDate(leave.from_date)
                      : `${formatDisplayDate(leave.from_date)} - ${formatDisplayDate(leave.to_date)}`}
                  </Text>
                </View>
                <View style={[styles.pill, { backgroundColor: colors.bg }]}>
                  <Text style={[styles.pillText, { color: colors.text }]}>{status}</Text>
                </View>
              </View>

              <Text style={styles.requestDate}>
                {leave.total_days} day{leave.total_days === 1 ? '' : 's'}
              </Text>

              {!!leave.reason && (
                <Text style={styles.requestReason} numberOfLines={3}>
                  {leave.reason}
                </Text>
              )}

              <Text style={styles.requestMeta}>
                Submitted:{' '}
                {new Date(leave.created_at).toLocaleString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                   hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>

              {status === 'APPROVED' && leave.approved_at && (
                <View style={styles.approvalInfo}>
                  <Ionicons name="checkmark-circle" size={14} color="#059669" />
                  <Text style={styles.approvalText}>
                    Approved: {new Date(leave.approved_at).toLocaleDateString('en-IN')}
                  </Text>
                </View>
              )}

              {status === 'REJECTED' && leave.rejection_reason && (
                <View style={styles.rejectionInfo}>
                  <Ionicons name="close-circle" size={14} color="#dc2626" />
                  <Text style={styles.rejectionText} numberOfLines={2}>
                    Rejected: {leave.rejection_reason}
                  </Text>
                </View>
              )}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

function formatBalanceDays(value: number | null) {
  if (value === null) return 'Unavailable';
  return `${value} day${value === 1 ? '' : 's'}`;
}

function LeaveBalanceCard({
  balance,
  submittedRemaining,
}: {
  balance: LeaveBalance | null;
  submittedRemaining: number | null;
}) {
  const remaining = getRemainingLeaveBalance(balance, submittedRemaining);

  const openingBalance = toFiniteNumber(balance?.opening_balance);
  const monthlyAllocation = toFiniteNumber(balance?.monthly_allocation);
  const allocatedBalance = toFiniteNumber(balance?.allocated_balance);
  const used = toFiniteNumber(balance?.leave_used);

  const hasImmediateValue = submittedRemaining !== null;

  return (
    <View style={styles.balanceCard} accessibilityLabel="Leave balance">
      {/* Header */}
      <View style={styles.balanceHeader}>
        <View style={styles.balanceIcon}>
          <Ionicons name="leaf-outline" size={20} color="#059669" />
        </View>

        <View style={styles.balanceHeaderText}>
          <Text style={styles.balanceTitle}>Leave Balance</Text>

          <Text style={styles.balanceSubtitle}>
            {hasImmediateValue
              ? 'Updated from your latest request'
              : 'Current monthly entitlement'}
          </Text>
        </View>
      </View>

      {/* Balance Statistics */}
      <View style={styles.balanceStats}>
        {/* Opening Balance */}
        <View style={styles.balanceStat}>
          <Text style={styles.balanceValue}>
            {openingBalance === null
              ? '—'
              : formatBalanceDays(openingBalance)}
          </Text>

          <Text style={styles.balanceLabel}>
            Opening
          </Text>
        </View>

        <View style={styles.balanceDivider} />

        {/* Monthly Allocation */}
        <View style={styles.balanceStat}>
          <Text style={styles.balanceValue}>
            {monthlyAllocation === null
              ? '—'
              : formatBalanceDays(monthlyAllocation)}
          </Text>

          <Text style={styles.balanceLabel}>
            Monthly
          </Text>
        </View>

        <View style={styles.balanceDivider} />

        {/* Allocated Balance */}
        <View style={styles.balanceStat}>
          <Text style={styles.balanceValue}>
            {allocatedBalance === null
              ? '—'
              : formatBalanceDays(allocatedBalance)}
          </Text>

          <Text style={styles.balanceLabel}>
            Allocated
          </Text>
        </View>
      </View>

      {/* Second Row */}
      <View style={[styles.balanceStats, styles.balanceStatsSecondRow]}>
        {/* Used */}
        <View style={styles.balanceStat}>
          <Text style={styles.balanceValue}>
            {used === null
              ? '—'
              : formatBalanceDays(used)}
          </Text>

          <Text style={styles.balanceLabel}>
            Used
          </Text>
        </View>

        <View style={styles.balanceDivider} />

        {/* Remaining */}
        <View style={styles.balanceStat}>
          <Text style={styles.balanceRemainingValue}>
            {formatBalanceDays(remaining)}
          </Text>

          <Text style={styles.balanceLabel}>
            Remaining
          </Text>
        </View>
      </View>

      {/* Information */}
      {hasImmediateValue && remaining !== null && (
        <Text style={styles.balanceNotice}>
          Remaining after this request:{' '}
          {formatBalanceDays(remaining)}
        </Text>
      )}

      {remaining === null && (
        <Text style={styles.balanceUnavailable}>
          Balance is not available yet. Pull to refresh after your
          account is synced.
        </Text>
      )}
    </View>
  );
}

/* ============================================================
   NEW LEAVE
============================================================ */

function NewLeaveView({
  onSubmitted,
}: {
  onSubmitted: (remainingAfterApproval: number | null) => void;
}) {
  const { user } = useAuthStore(); // Get user from auth store
  const [leaveType, setLeaveType] = useState<LeaveType>('FULL_DAY');
  const [fromDate, setFromDate] = useState<Date>(getToday());
  const [toDate, setToDate] = useState<Date>(getToday());
  const [reason, setReason] = useState('');

  // Calendar
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calendarTarget, setCalendarTarget] = useState<CalendarTarget>(null);

  const { mutateAsync, isPending } = useCreateLeaveRequest();
  const singleDay = isSingleDayLeave(leaveType);

  const openCalendar = (target: 'from' | 'to') => {
    setCalendarTarget(target);
    setCalendarVisible(true);
  };

  const closeCalendar = () => {
    setCalendarVisible(false);
    setCalendarTarget(null);
  };

  const handleTypeChange = (type: LeaveType) => {
    setLeaveType(type);
    if (isSingleDayLeave(type)) {
      setToDate(fromDate);
    }
  };

  const handleCalendarDateSelect = (dateString: string) => {
    const selectedDate = dateStringToDate(dateString);

    if (calendarTarget === 'from') {
      setFromDate(selectedDate);
      if (singleDay) {
        setToDate(selectedDate);
      } else if (isDateBefore(toDate, selectedDate)) {
        setToDate(selectedDate);
      }
      closeCalendar();
      return;
    }

    if (calendarTarget === 'to') {
      if (isDateBefore(selectedDate, fromDate)) {
        Toast.show({
          type: 'error',
          text1: 'Invalid Date',
          text2: 'To Date cannot be before From Date.',
        });
        return;
      }
      setToDate(selectedDate);
      closeCalendar();
    }
  };

  const getMarkedDates = () => {
    const marked: any = {};
    const from = toDateString(fromDate);
    const to = toDateString(toDate);
    const today = toDateString(getToday());

    marked[today] = { marked: true, dotColor: '#3b82f6' };

    if (singleDay) {
      marked[from] = { selected: true, selectedColor: '#3b82f6', selectedTextColor: '#ffffff' };
      return marked;
    }

    if (from === to) {
      marked[from] = { selected: true, selectedColor: '#3b82f6', selectedTextColor: '#ffffff' };
      return marked;
    }

    marked[from] = { selected: true, startingDay: true, selectedColor: '#3b82f6', selectedTextColor: '#ffffff' };
    marked[to] = { selected: true, endingDay: true, selectedColor: '#3b82f6', selectedTextColor: '#ffffff' };

    return marked;
  };

  const getMinimumDate = () => {
    if (calendarTarget === 'to') {
      return toDateString(fromDate);
    }
    return toDateString(getToday());
  };

  const handleSubmit = async () => {
    if (!reason.trim()) {
      Toast.show({ type: 'error', text1: 'Missing Details', text2: 'Reason is required.' });
      return;
    }

    if (!singleDay && isDateBefore(toDate, fromDate)) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Dates',
        text2: 'End date must be on or after the start date.',
      });
      return;
    }

    // Get userId from auth store
    const userId = user?.employee_id || user?.id;
    if (!userId) {
      Toast.show({
        type: 'error',
        text1: 'Authentication Error',
        text2: 'User ID not found. Please login again.',
      });
      return;
    }

    try {
      // Include userId in the payload
      const response = await mutateAsync({
        userId,
        from_date: toDateString(fromDate),
        to_date: toDateString(singleDay ? fromDate : toDate),
        leave_type: leaveType,
        reason: reason.trim(),
      });
      const remainingAfterApproval = toFiniteNumber(
        response?.balance?.remaining_after_approval,
      );

      Toast.show({
        type: 'success',
        text1: 'Leave Submitted',
        text2:
          remainingAfterApproval === null
            ? 'Your leave request has been sent for approval.'
            : `Request sent. Remaining after this request: ${formatBalanceDays(remainingAfterApproval)}.`,
      });

      const today = getToday();
      setReason('');
      setFromDate(today);
      setToDate(today);
      setLeaveType('FULL_DAY');
      onSubmitted(remainingAfterApproval);
    } catch (error: any) {
      console.error('Leave submit error:', error);
      Toast.show({
        type: 'error',
        text1: 'Submission Failed',
        text2: getApiErrorMessage(error),
      });
    }
  };

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.formScroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>Apply for HALF DAY, FULL DAY, or MULTI DAY leave.</Text>

        {/* Leave Type */}
        <Text style={styles.label}>Leave Type</Text>
        <View style={styles.typeGrid}>
          {LEAVE_TYPES.map((type) => (
            <TouchableOpacity
              key={type.value}
              style={[styles.typeChip, leaveType === type.value && styles.typeChipActive]}
              onPress={() => handleTypeChange(type.value)}
              activeOpacity={0.7}
            >
              <Text style={[styles.typeChipText, leaveType === type.value && styles.typeChipTextActive]}>
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* From Date */}
        <Text style={styles.label}>{singleDay ? 'Select Date' : 'From Date'}</Text>
        <TouchableOpacity style={styles.dateSelector} activeOpacity={0.7} onPress={() => openCalendar('from')}>
          <View style={styles.dateSelectorLeft}>
            <View style={styles.calendarIconContainer}>
              <Ionicons name="calendar-outline" size={22} color="#3b82f6" />
            </View>
            <View>
              <Text style={styles.dateSmallLabel}>{singleDay ? 'Leave Date' : 'Start Date'}</Text>
              <Text style={styles.dateText}>{formatDateToDisplay(fromDate)}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#64748b" />
        </TouchableOpacity>

        {/* To Date */}
        {!singleDay && (
          <>
            <Text style={styles.label}>To Date</Text>
            <TouchableOpacity style={styles.dateSelector} activeOpacity={0.7} onPress={() => openCalendar('to')}>
              <View style={styles.dateSelectorLeft}>
                <View style={styles.calendarIconContainer}>
                  <Ionicons name="calendar-outline" size={22} color="#3b82f6" />
                </View>
                <View>
                  <Text style={styles.dateSmallLabel}>End Date</Text>
                  <Text style={styles.dateText}>{formatDateToDisplay(toDate)}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#64748b" />
            </TouchableOpacity>
          </>
        )}

        {/* Selected Date Summary */}
        <View style={styles.dateSummary}>
          <View style={styles.dateSummaryIcon}>
            <Ionicons name="checkmark-circle" size={18} color="#059669" />
          </View>
          <View style={styles.dateSummaryContent}>
            <Text style={styles.dateSummaryTitle}>Selected Leave</Text>
            <Text style={styles.dateSummaryText}>
              {singleDay
                ? formatDateToDisplay(fromDate)
                : `${formatDateToDisplay(fromDate)} - ${formatDateToDisplay(toDate)}`}
            </Text>
          </View>
        </View>

        {/* Reason */}
        <Text style={styles.label}>Reason</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Please explain the reason for your leave..."
          placeholderTextColor="#94a3b8"
          value={reason}
          onChangeText={setReason}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        {/* Submit */}
        <TouchableOpacity
          style={[styles.primaryBtn, isPending && styles.disabledBtn]}
          onPress={handleSubmit}
          disabled={isPending}
          activeOpacity={0.8}
        >
          {isPending ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Ionicons name="send-outline" size={19} color="#ffffff" />
              <Text style={styles.btnText}>Submit Leave Request</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Calendar Modal */}
      <Modal visible={calendarVisible} transparent animationType="fade" onRequestClose={closeCalendar}>
        <View style={styles.calendarModalOverlay}>
          <View style={styles.calendarModal}>
            <View style={styles.calendarModalHeader}>
              <View>
                <Text style={styles.calendarModalTitle}>
                  {calendarTarget === 'to'
                    ? 'Select To Date'
                    : singleDay
                    ? 'Select Leave Date'
                    : 'Select From Date'}
                </Text>
                <Text style={styles.calendarModalSubtitle}>
                  {calendarTarget === 'to' ? 'Choose the end date' : 'Choose the start date'}
                </Text>
              </View>
              <TouchableOpacity onPress={closeCalendar} style={styles.closeButton} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color="#475569" />
              </TouchableOpacity>
            </View>

            <Calendar
              current={calendarTarget === 'to' ? toDateString(toDate) : toDateString(fromDate)}
              minDate={getMinimumDate()}
              markedDates={getMarkedDates()}
              onDayPress={(day) => handleCalendarDateSelect(day.dateString)}
              enableSwipeMonths
              hideExtraDays={false}
              firstDay={1}
              theme={{
                backgroundColor: '#ffffff',
                calendarBackground: '#ffffff',
                textSectionTitleColor: '#64748b',
                selectedDayBackgroundColor: '#3b82f6',
                selectedDayTextColor: '#ffffff',
                todayTextColor: '#3b82f6',
                dayTextColor: '#0f172a',
                textDisabledColor: '#cbd5e1',
                arrowColor: '#3b82f6',
                monthTextColor: '#0f172a',
                textMonthFontWeight: '700',
                textDayFontWeight: '500',
                textDayHeaderFontWeight: '600',
                textDayFontSize: 14,
                textMonthFontSize: 17,
                textDayHeaderFontSize: 12,
              }}
              style={styles.calendar}
            />

            <TouchableOpacity style={styles.calendarCancelBtn} onPress={closeCalendar} activeOpacity={0.7}>
              <Text style={styles.calendarCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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

  /* Header */
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
    shadowOffset: { width: 0, height: 2 },
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

  /* Loading / Empty */
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

  /* List */
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

  balanceCard: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#d1fae5',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  balanceHeaderText: {
    flex: 1,
    marginLeft: 10,
  },
  balanceTitle: {
    color: '#065f46',
    fontSize: 15,
    fontWeight: '800',
  },
  balanceSubtitle: {
    color: '#047857',
    fontSize: 11,
    marginTop: 2,
  },
  balanceStats: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: 16,
  },
  balanceStat: {
    flex: 1,
    alignItems: 'center',
  },
  balanceValue: {
    color: '#059669',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  balanceLabel: {
    color: '#047857',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 3,
    textAlign: 'center',
  },
  balanceDivider: {
    width: 1,
    backgroundColor: '#a7f3d0',
  },
  balanceNotice: {
    color: '#065f46',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#a7f3d0',
  },
  balanceUnavailable: {
    color: '#64748b',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 12,
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

  /* Form */
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
    marginBottom: 20,
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

  /* Calendar Modal */
  calendarModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
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
    shadowOffset: { width: 0, height: 8 },
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