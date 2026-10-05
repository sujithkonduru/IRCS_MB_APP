// app/(employee)/(tabs)/attendance.tsx

import React, { useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';

import {
  useAttendanceReport,
  useAttendanceSummary,
  useEmployeeStatus,
  HistoryRange,
} from '@/hooks/useEmployeeApi';
import {
  classifyWorkoff,
  getRemainingLeaveBalance,
  isTruthyFlag,
  type BackendAttendanceRow,
} from '@/api/axios';

import { Ionicons } from '@expo/vector-icons';

type SubTab = 'history' | 'summary';
type HistoryFilter = 'today' | 'week' | 'month' | 'date';

type AttendanceRow = BackendAttendanceRow & {
  Attendance_Date?: string | null;
  in_time_late_reason?: string | null;
  status?: string;
};

/* ============================================================
   DATE HELPERS
============================================================ */

function pad(value: number) {
  return value.toString().padStart(2, '0');
}

function dateToKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDateOnly(value?: string | null): Date | null {
  if (!value) return null;
  const datePart = value.substring(0, 10);
  const match = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function formatDate(value?: string | null) {
  if (!value) return '--';
  const date = parseDateOnly(value);
  if (!date) return value;
  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatSelectedDate(date: Date) {
  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatMonthTitle(date: Date) {
  return date.toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
}

function isSameDate(date1: Date, date2: Date) {
  return dateToKey(date1) === dateToKey(date2);
}

function formatTime(value: string | null | undefined) {
  if (!value) return '--:--';
  try {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    }
    return value;
  } catch {
    return value;
  }
}

const isTrue = isTruthyFlag;

/* ============================================================
   FORMAT HOURS HELPER - FIXED
============================================================ */

function formatHours(value: any): string {
  if (!value) return '--';
  
  // If it's an object with hours/minutes/seconds
  if (typeof value === 'object' && value !== null) {
    // Check if it has hours, minutes, seconds properties (Duration object)
    if ('hours' in value || 'minutes' in value || 'seconds' in value) {
      const hours = (value as any).hours || 0;
      const minutes = (value as any).minutes || 0;
      const seconds = (value as any).seconds || 0;
      
      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      }
      if (minutes > 0) {
        return `${minutes}m`;
      }
      if (seconds > 0) {
        return `${seconds}s`;
      }
      return '0m';
    }
    // If it's a Date object
    if (value instanceof Date) {
      const hours = value.getHours();
      const minutes = value.getMinutes();
      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      }
      return `${minutes}m`;
    }
    // Try to stringify and parse
    try {
      const str = JSON.stringify(value);
      return str;
    } catch {
      return '--';
    }
  }
  
  // If it's a string
  if (typeof value === 'string') {
    // Check if it already has the format "Xh Ym" or "Xh Ym Zs"
    if (value.includes('h') || value.includes('m') || value.includes('s')) {
      return value;
    }
    // Try to parse as time string "HH:MM:SS" or "HH:MM"
    const parts = value.split(':');
    if (parts.length >= 2) {
      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);
      const seconds = parts.length > 2 ? parseInt(parts[2], 10) : 0;
      
      if (!isNaN(hours) && !isNaN(minutes)) {
        if (hours > 0) {
          if (seconds > 0) {
            return `${hours}h ${minutes}m ${seconds}s`;
          }
          return `${hours}h ${minutes}m`;
        }
        if (minutes > 0) {
          if (seconds > 0) {
            return `${minutes}m ${seconds}s`;
          }
          return `${minutes}m`;
        }
        if (seconds > 0) {
          return `${seconds}s`;
        }
        return '0m';
      }
    }
    return value;
  }
  
  return '--';
}

/* ============================================================
   NORMALIZE ATTENDANCE ROW
============================================================ */

function normalizeAttendanceRow(row: AttendanceRow): AttendanceRow {
  return {
    ...row,

    attendance_date:
      row.attendance_date ||
      row.date ||
      row.Attendance_Date ||
      null,

    in_time:
      row.in_time ||
      row.In_Time ||
      row.inTime ||
      null,

    out_time:
      row.out_time ||
      row.Out_time ||
      row.outTime ||
      null,

    total_hours_worked:
      row.total_hours_worked ||
      row.total_hours ||
      row.hours ||
      null,

    in_time_outside: isTrue(row.in_time_outside ?? row.In_time_outside),
    out_time_outside: isTrue(row.out_time_outside ?? row.Out_time_outside),
    in_time_late: isTrue(row.in_time_late),
    early_going: isTrue(row.early_going),
    status:
      classifyWorkoff(row).status ||
      (row.out_time || row.Out_time || row.outTime
        ? 'Completed'
        : row.in_time || row.In_Time || row.inTime
        ? 'In Progress'
        : 'Absent'),
  };
}

/* ============================================================
   MAIN SCREEN
============================================================ */

export default function AttendanceScreen() {
  const [subTab, setSubTab] = useState<SubTab>('history');

  return (
    <View style={styles.container}>
      <Text style={styles.pageTitle}>Attendance</Text>

      <View style={styles.subTabBar}>
        {(['history', 'summary'] as SubTab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.subTab, subTab === tab && styles.subTabActive]}
            onPress={() => setSubTab(tab)}
          >
            <Text style={[styles.subTabText, subTab === tab && styles.subTabTextActive]}>
              {tab === 'history' ? 'History' : 'Summary'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {subTab === 'history' ? (
        <HistoryView />
      ) : (
        <SummaryView />
      )}
    </View>
  );
}

/* ============================================================
   HISTORY VIEW
============================================================ */

function HistoryView() {
  const [filter, setFilter] = useState<HistoryFilter>('today');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarVisible, setCalendarVisible] = useState<boolean>(false);

  // Get today's status from get_emp_status
  const { data: todayStatus, isLoading: todayLoading, refetch: refetchToday } = useEmployeeStatus();

  // Get history from getAttendance (POST)
  const apiRange: HistoryRange = filter === 'date' ? 'month' : filter;
  const {
    data: attendanceReport,
    isLoading: historyLoading,
    isRefetching,
    refetch: refetchHistory,
    isError,
  } = useAttendanceReport(apiRange);

  const rawRows = Array.isArray(attendanceReport?.attendance)
    ? attendanceReport.attendance
    : [];

  const rows = useMemo(() => {
    return rawRows.map((row) => normalizeAttendanceRow(row));
  }, [rawRows]);

  const periodMetrics = useMemo(() => {
    const workoffRows = rows.filter((row) => classifyWorkoff(row).isWorkoff);
    return {
      recordedDays: attendanceReport?.total_days ?? rows.length,
      totalHours: attendanceReport?.total_hours ?? null,
      averageHours: attendanceReport?.avg_per_day ?? null,
      workoffDays: workoffRows.length,
      halfDayWorkoffDays: workoffRows.filter(
        (row) => classifyWorkoff(row).status === 'Half-day Work-off',
      ).length,
    };
  }, [attendanceReport, rows]);

  // Display rows based on filter
  const displayedRows = useMemo(() => {
    if (filter === 'today') {
      // /api/hr/get_emp_status returns the attendance row under
      // `attendance`. `data` is kept only as a backwards-compatible fallback.
      const today = todayStatus?.attendance ?? todayStatus?.data ?? null;

      if (today) {
        const todayKey = dateToKey(new Date());
        const todayRow = normalizeAttendanceRow({
          attendance_date: todayKey,
          date: todayKey,
          in_time: today.in_time,
          out_time: today.out_time,
          total_hours_worked: today.total_hours_worked,
          in_time_late: today.in_time_late,
          in_time_late_reason: today.in_time_late_reason,
          delay_in_reason: today.in_time_late_reason,
          in_time_outside: today.in_time_outside,
          out_time_outside: today.out_time_outside,
          in_time_outside_approved: today.in_time_outside_approved,
          out_time_outside_approved: today.out_time_outside_approved,
          early_going: today.early_going,
          early_going_reason: today.early_going_reason,
          todays_task: today.todays_task,
          Todays_Task: today.todays_task,
          emp_id: today.emp_id,
          id: today.id,
          _id: today.id,
        });
        return [todayRow];
      }
      // Fallback to history data for today
      const todayKey = dateToKey(new Date());
      return rows.filter((row) => {
        const date = row.attendance_date || row.date;
        if (!date) return false;
        return date.substring(0, 10) === todayKey;
      });
    }

    if (filter === 'date') {
      const selectedKey = dateToKey(selectedDate);
      return rows.filter((row) => {
        const date = row.attendance_date || row.date;
        if (!date) return false;
        return date.substring(0, 10) === selectedKey;
      });
    }

    return rows;
  }, [rows, filter, selectedDate, todayStatus]);

  const isLoading = todayLoading || (historyLoading && rawRows.length === 0);

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setFilter('date');
    setCalendarVisible(false);
  };

  const handleRefresh = () => {
    refetchToday();
    refetchHistory();
  };

  const toggleCalendar = () => {
    setCalendarVisible(!calendarVisible);
  };

  if (isLoading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading attendance...</Text>
      </View>
    );
  }

  if (isError && !todayStatus) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text style={styles.emptyText}>Couldn't load attendance history.</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={handleRefresh}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.historyContainer}>
      {/* Filter Bar */}
      <View style={styles.filterBar}>
        {(['today', 'week', 'month'] as HistoryFilter[]).map((value) => (
          <TouchableOpacity
            key={value}
            style={[styles.filterTab, filter === value && styles.activeFilterTab]}
            onPress={() => {
              setFilter(value);
              if (value === 'today') {
                setSelectedDate(new Date());
                setCalendarVisible(false);
              }
            }}
          >
            <Text style={[styles.filterTabText, filter === value && styles.activeFilterTabText]}>
              {value === 'today' ? 'Today' : value === 'week' ? 'Week' : 'Month'}
            </Text>
          </TouchableOpacity>
        ))}
        
        {/* Calendar Toggle Button */}
        <TouchableOpacity
          style={[styles.filterTab, filter === 'date' && styles.activeFilterTab]}
          onPress={toggleCalendar}
        >
          <Ionicons 
            name="calendar-outline" 
            size={16} 
            color={filter === 'date' ? '#3b82f6' : '#64748b'} 
          />
          <Text style={[
            styles.filterTabText, 
            filter === 'date' && styles.activeFilterTabText,
            styles.calendarFilterText
          ]}>
            {filter === 'date' ? 'Date' : 'Select'}
          </Text>
        </TouchableOpacity>
      </View>

      <PeriodMetrics metrics={periodMetrics} />

      {/* Calendar (Conditional) */}
      {calendarVisible && (
        <CalendarSelector 
          selectedDate={selectedDate} 
          onSelectDate={handleDateSelect}
          onClose={() => setCalendarVisible(false)}
        />
      )}

      {/* Selected Date Header */}
      {filter === 'date' && !calendarVisible && (
        <View style={styles.selectedDateHeader}>
          <View>
            <Text style={styles.selectedDateSmall}>SELECTED DATE</Text>
            <Text style={styles.selectedDateTitle}>{formatSelectedDate(selectedDate)}</Text>
          </View>
          <TouchableOpacity
            style={styles.todayButton}
            onPress={() => {
              const today = new Date();
              setSelectedDate(today);
              setFilter('today');
            }}
          >
            <Text style={styles.todayButtonText}>Today</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Refreshable Content */}
      {displayedRows.length === 0 ? (
        <ScrollView
          style={styles.resultsScroll}
          contentContainerStyle={styles.emptyContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={!!isRefetching} onRefresh={handleRefresh} />}
        >
          <Ionicons name="calendar-outline" size={48} color="#94a3b8" />
          <Text style={styles.emptyText}>
            {filter === 'date'
              ? `No attendance record found for ${formatSelectedDate(selectedDate)}.`
              : 'No attendance records for this period.'}
          </Text>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.resultsScroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={!!isRefetching} onRefresh={handleRefresh} />}
        >
          {displayedRows.map((row: AttendanceRow, index: number) => (
            <AttendanceCard
              key={row.id || row._id || `${row.attendance_date}-${index}`}
              row={row}
              isToday={filter === 'today' || (filter === 'date' && isSameDate(selectedDate, new Date()))}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

/* ============================================================
   PERIOD METRICS
============================================================ */

function PeriodMetrics({
  metrics,
}: {
  metrics: {
    recordedDays: number;
    totalHours: string | null;
    averageHours: string | null;
    workoffDays: number;
    halfDayWorkoffDays: number;
  };
}) {
  const items = [
    { label: 'Recorded days', value: String(metrics.recordedDays), icon: 'calendar-outline' as const },
    { label: 'Total hours', value: formatHours(metrics.totalHours), icon: 'hourglass-outline' as const },
    { label: 'Average per day', value: formatHours(metrics.averageHours), icon: 'trending-up-outline' as const },
  ];

  return (
    <View style={styles.periodMetrics} accessibilityLabel="Attendance period metrics">
      {items.map((item) => (
        <View key={item.label} style={styles.periodMetricItem}>
          <Ionicons name={item.icon} size={15} color="#3b82f6" />
          <Text style={styles.periodMetricValue}>{item.value}</Text>
          <Text style={styles.periodMetricLabel}>{item.label}</Text>
        </View>
      ))}
      {metrics.workoffDays > 0 && (
        <View style={styles.periodMetricItem}>
          <Ionicons name="sunny-outline" size={15} color="#d97706" />
          <Text style={[styles.periodMetricValue, styles.workoffMetricValue]}>
            {metrics.workoffDays}
          </Text>
          <Text style={styles.periodMetricLabel}>
            Work-off{metrics.halfDayWorkoffDays > 0 ? ` (${metrics.halfDayWorkoffDays} half)` : ''}
          </Text>
        </View>
      )}
    </View>
  );
}

/* ============================================================
   CALENDAR SELECTOR
============================================================ */

function CalendarSelector({
  selectedDate,
  onSelectDate,
  onClose,
}: {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onClose: () => void;
}) {
  const [visibleMonth, setVisibleMonth] = useState<Date>(
    new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
  );

  useEffect(() => {
    setVisibleMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  }, [selectedDate]);

  const goPreviousMonth = () => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1));
  };

  const goNextMonth = () => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1));
  };

  const goToday = () => {
    const today = new Date();
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    onSelectDate(today);
  };

  const days = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const previousMonthDays = new Date(year, month, 0).getDate();
    const result: { date: Date; currentMonth: boolean }[] = [];

    for (let i = firstDay - 1; i >= 0; i--) {
      result.push({
        date: new Date(year, month - 1, previousMonthDays - i),
        currentMonth: false,
      });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      result.push({
        date: new Date(year, month, day),
        currentMonth: true,
      });
    }

    const remaining = 42 - result.length;
    for (let day = 1; day <= remaining; day++) {
      result.push({
        date: new Date(year, month + 1, day),
        currentMonth: false,
      });
    }

    return result;
  }, [visibleMonth]);

  const today = new Date();

  return (
    <View style={styles.calendarCard}>
      <View style={styles.calendarHeader}>
        <TouchableOpacity style={styles.calendarArrow} onPress={goPreviousMonth}>
          <Ionicons name="chevron-back" size={20} color="#334155" />
        </TouchableOpacity>
        <TouchableOpacity onPress={goToday}>
          <Text style={styles.calendarMonthTitle}>{formatMonthTitle(visibleMonth)}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.calendarArrow} onPress={onClose}>
          <Ionicons name="close" size={20} color="#334155" />
        </TouchableOpacity>
      </View>

      <View style={styles.weekRow}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <View key={day} style={styles.weekDay}>
            <Text style={styles.weekDayText}>{day}</Text>
          </View>
        ))}
      </View>

      <View style={styles.calendarGrid}>
        {days.map(({ date, currentMonth }) => {
          const selected = isSameDate(date, selectedDate);
          const isToday = isSameDate(date, today);

          return (
            <TouchableOpacity
              key={dateToKey(date)}
              activeOpacity={0.7}
              style={[
                styles.calendarDay,
                !currentMonth && styles.otherMonthDay,
                selected && styles.selectedCalendarDay,
                isToday && !selected && styles.todayCalendarDay,
              ]}
              onPress={() => onSelectDate(date)}
            >
              <Text
                style={[
                  styles.calendarDayText,
                  !currentMonth && styles.otherMonthDayText,
                  selected && styles.selectedCalendarDayText,
                  isToday && !selected && styles.todayCalendarDayText,
                ]}
              >
                {date.getDate()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.calendarActions}>
        <TouchableOpacity style={styles.calendarActionButton} onPress={goToday}>
          <Ionicons name="today-outline" size={16} color="#3b82f6" />
          <Text style={styles.calendarActionText}>Today</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.calendarActionButton, styles.calendarCloseButton]} onPress={onClose}>
          <Ionicons name="close-outline" size={16} color="#64748b" />
          <Text style={[styles.calendarActionText, styles.calendarCloseText]}>Close</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ============================================================
   ATTENDANCE CARD - FIXED
============================================================ */

function AttendanceCard({ row, isToday }: { row: AttendanceRow; isToday?: boolean }) {
  const inTime = row.in_time || row.In_Time || row.inTime || null;
  const outTime = row.out_time || row.Out_time || row.outTime || null;
  const workoff = classifyWorkoff(row);
  
  // FIXED: Use formatHours helper to handle object or string
  const totalHours = formatHours(row.total_hours_worked || row.total_hours || row.hours);

  const late = isTrue(row.in_time_late) || !!row.delay_in_reason;
  const outside = isTrue(row.in_time_outside) || isTrue(row.out_time_outside) || 
                  isTrue(row.In_time_outside) || isTrue(row.Out_time_outside);
  const approved = isTrue(row.in_time_outside_approved) || isTrue(row.out_time_outside_approved) ||
                   isTrue(row.In_time_approved) || isTrue(row.Out_time_approved);
  const earlyGoing = isTrue(row.early_going);

  return (
    <View style={[styles.logCard, isToday && styles.todayCard]}>
      <View style={styles.logHeader}>
        <View style={styles.dateHeaderLeft}>
          <View style={[styles.dateIcon, isToday && styles.todayDateIcon]}>
            <Ionicons name="calendar-outline" size={18} color={isToday ? '#3b82f6' : '#3b82f6'} />
          </View>
          <View>
            <Text style={[styles.dateLabel, isToday && styles.todayLabel]}>
              {isToday ? "TODAY'S ATTENDANCE" : 'ATTENDANCE DATE'}
            </Text>
            <Text style={styles.logDate}>{formatDate(row.attendance_date || row.date)}</Text>
          </View>
        </View>
        <StatusPill status={workoff.status || row.status} inTime={inTime} outTime={outTime} />
      </View>

      <View style={styles.timeRow}>
        <View style={styles.timeBox}>
          <View style={[styles.timeIconBox, styles.inIconBox]}>
            <Ionicons name="log-in-outline" size={18} color="#059669" />
          </View>
          <View>
            <Text style={styles.timeLabel}>IN TIME</Text>
            <Text style={styles.timeValue}>{formatTime(inTime)}</Text>
          </View>
        </View>
        <View style={styles.timeBox}>
          <View style={[styles.timeIconBox, styles.outIconBox]}>
            <Ionicons name="log-out-outline" size={18} color="#dc2626" />
          </View>
          <View>
            <Text style={styles.timeLabel}>OUT TIME</Text>
            <Text style={styles.timeValue}>{formatTime(outTime)}</Text>
          </View>
        </View>
      </View>

      {workoff.isWorkoff && (
        <View style={styles.workoffBadge} accessibilityLabel={`${workoff.status} attendance`}>
          <Ionicons name="sunny-outline" size={16} color="#d97706" />
          <View style={styles.workoffBadgeContent}>
            <Text style={styles.workoffBadgeTitle}>{workoff.status}</Text>
            {!!row.attendance_impact_reason && (
              <Text style={styles.workoffBadgeReason}>{row.attendance_impact_reason}</Text>
            )}
          </View>
        </View>
      )}

      <View style={styles.logGrid}>
        <LogField label="TOTAL HOURS" value={totalHours} />
        <LogField label="LATE" value={late ? 'Yes' : 'No'} />
        <LogField label="OUTSIDE" value={outside ? 'Yes' : 'No'} />
        <LogField label="APPROVED" value={approved ? 'Yes' : 'No'} />
        <LogField label="EARLY GOING" value={earlyGoing ? 'Yes' : 'No'} />
        <LogField label="EMPLOYEE ID" value={row.emp_id || '--'} />
      </View>

      {row.in_time_late_reason && (
        <View style={styles.reasonBox}>
          <Ionicons name="time-outline" size={16} color="#d97706" />
          <View style={styles.reasonContent}>
            <Text style={styles.reasonLabel}>Late Reason</Text>
            <Text style={styles.reasonText}>{row.in_time_late_reason}</Text>
          </View>
        </View>
      )}

      {row.early_going_reason && (
        <View style={styles.reasonBox}>
          <Ionicons name="exit-outline" size={16} color="#7c3aed" />
          <View style={styles.reasonContent}>
            <Text style={styles.reasonLabel}>Early Going Reason</Text>
            <Text style={styles.reasonText}>{row.early_going_reason}</Text>
          </View>
        </View>
      )}

      {(row.todays_task || row.Todays_Task) && (
        <View style={styles.taskBox}>
          <Text style={styles.taskLabel}>TODAY'S TASK</Text>
          <Text style={styles.taskText}>{row.todays_task || row.Todays_Task}</Text>
        </View>
      )}
    </View>
  );
}

/* ============================================================
   LOG FIELD
============================================================ */

function LogField({ label, value }: { label: string; value: string }) {
  const displayValue = typeof value === 'string' ? value : String(value || '--');
  
  return (
    <View style={styles.logField}>
      <Text style={styles.logFieldLabel}>{label}</Text>
      <Text style={styles.logFieldValue}>{displayValue}</Text>
    </View>
  );
}

/* ============================================================
   STATUS PILL
============================================================ */

function StatusPill({ status, inTime, outTime }: { status?: string; inTime?: string | null; outTime?: string | null }) {
  const isPresent = !!inTime;
  const isCompleted = !!outTime;
  const normalized = String(status || '').toUpperCase();

  let statusText = 'Absent';
  let bgColor = '#fee2e2';
  let textColor = '#dc2626';

  if (normalized === 'HALF-DAY WORK-OFF') {
    statusText = 'Half-day Work-off';
    bgColor = '#fef3c7';
    textColor = '#d97706';
  } else if (normalized === 'WORK-OFF') {
    statusText = 'Work-off';
    bgColor = '#fef3c7';
    textColor = '#d97706';
  } else if (isCompleted) {
    statusText = 'Completed';
    bgColor = '#d1fae5';
    textColor = '#059669';
  } else if (isPresent) {
    statusText = 'In Progress';
    bgColor = '#fef3c7';
    textColor = '#d97706';
  } else if (normalized === 'PRESENT') {
    statusText = 'Present';
    bgColor = '#d1fae5';
    textColor = '#059669';
  }

  return (
    <View style={[styles.pill, { backgroundColor: bgColor }]}>
      <Text style={[styles.pillText, { color: textColor }]}>{statusText}</Text>
    </View>
  );
}

/* ============================================================
   SUMMARY VIEW
============================================================ */

function SummaryView() {
  const { data, isLoading, isError, refetch, isRefetching } = useAttendanceSummary();
  const { data: employeeStatus } = useEmployeeStatus();
  const remainingLeave = getRemainingLeaveBalance(
    employeeStatus?.statistics?.leaves?.balance,
  );

  if (isLoading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading summary...</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text style={styles.emptyText}>Couldn't load your summary.</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Format total hours if it's an object
  const totalHours = data?.totalHours ? formatHours(data.totalHours) : '0h 0m';

  const items = [
    { label: 'Total Days', value: String(data?.totalWorkingDays ?? 0), icon: 'calendar-outline' },
    { label: 'Present', value: String(data?.present ?? 0), icon: 'checkmark-circle-outline' },
    { label: 'Absent', value: String(data?.absent ?? 0), icon: 'close-circle-outline' },
    { label: 'Late', value: String(data?.late ?? 0), icon: 'time-outline' },
    { label: 'Early Going', value: String(data?.earlyGoing ?? 0), icon: 'exit-outline' },
    { label: 'Total Hours', value: totalHours, icon: 'hourglass-outline' },
    ...(data?.workoff !== undefined
      ? [{ label: 'Work-off', value: String(data.workoff), icon: 'sunny-outline' }]
      : []),
    ...(remainingLeave !== null
      ? [{ label: 'Remaining leave', value: `${remainingLeave}`, icon: 'leaf-outline' }]
      : []),
  ];

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={!!isRefetching} onRefresh={refetch} />}
    >
      <View style={styles.summaryGrid}>
        {items.map((item) => (
          <View key={item.label} style={styles.summaryCard}>
            <Ionicons name={item.icon as any} size={24} color="#3b82f6" />
            <Text style={styles.summaryValue}>{item.value}</Text>
            <Text style={styles.summaryLabel}>{item.label}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

/* ============================================================
   STYLES
============================================================ */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
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

  historyContainer: {
    flex: 1,
  },

  filterBar: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },

  periodMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },

  periodMetricItem: {
    flex: 1,
    minWidth: '25%',
    alignItems: 'center',
    paddingHorizontal: 4,
  },

  periodMetricValue: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 3,
    textAlign: 'center',
  },

  workoffMetricValue: {
    color: '#d97706',
  },

  periodMetricLabel: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },

  filterTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 4,
  },

  activeFilterTab: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },

  filterTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },

  activeFilterTabText: {
    color: '#3b82f6',
  },

  calendarFilterText: {
    marginLeft: 2,
  },

  calendarCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  calendarArrow: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  calendarMonthTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },

  weekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },

  weekDay: {
    width: '14.2857%',
    alignItems: 'center',
    paddingVertical: 6,
  },

  weekDayText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
  },

  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  calendarDay: {
    width: '14.2857%',
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },

  calendarDayText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },

  otherMonthDay: {
    opacity: 0.35,
  },

  otherMonthDayText: {
    color: '#94a3b8',
  },

  selectedCalendarDay: {
    backgroundColor: '#3b82f6',
  },

  selectedCalendarDayText: {
    color: '#ffffff',
    fontWeight: '800',
  },

  todayCalendarDay: {
    borderWidth: 1,
    borderColor: '#3b82f6',
  },

  todayCalendarDayText: {
    color: '#3b82f6',
    fontWeight: '800',
  },

  calendarActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 8,
  },

  calendarActionButton: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },

  calendarCloseButton: {
    backgroundColor: '#f1f5f9',
  },

  calendarActionText: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: '700',
  },

  calendarCloseText: {
    color: '#64748b',
  },

  selectedDateHeader: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  selectedDateSmall: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.8,
    marginBottom: 3,
  },

  selectedDateTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },

  todayButton: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },

  todayButtonText: {
    fontSize: 11,
    color: '#3b82f6',
    fontWeight: '700',
  },

  resultsScroll: {
    flex: 1,
  },

  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    marginTop: 10,
    color: '#64748b',
    fontSize: 13,
  },

  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 24,
  },

  emptyText: {
    color: '#94a3b8',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 21,
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

  workoffBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },

  workoffBadgeContent: {
    flex: 1,
    marginLeft: 8,
  },

  workoffBadgeTitle: {
    color: '#92400e',
    fontSize: 12,
    fontWeight: '800',
  },

  workoffBadgeReason: {
    color: '#78350f',
    fontSize: 11,
    marginTop: 2,
  },

  logCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },

  todayCard: {
    borderColor: '#3b82f6',
    borderWidth: 1.5,
  },

  todayDateIcon: {
    backgroundColor: '#dbeafe',
  },

  todayLabel: {
    color: '#3b82f6',
  },

  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },

  dateHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  dateIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },

  dateLabel: {
    fontSize: 9,
    color: '#94a3b8',
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 2,
  },

  logDate: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },

  pill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },

  pillText: {
    fontSize: 10,
    fontWeight: '800',
  },

  timeRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },

  timeBox: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'center',
  },

  timeIconBox: {
    width: 36,
    height: 36,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },

  inIconBox: {
    backgroundColor: '#ecfdf5',
  },

  outIconBox: {
    backgroundColor: '#fef2f2',
  },

  timeLabel: {
    fontSize: 9,
    color: '#94a3b8',
    fontWeight: '800',
    marginBottom: 2,
  },

  timeValue: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '700',
  },

  logGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  logField: {
    width: '50%',
    marginBottom: 12,
  },

  logFieldLabel: {
    fontSize: 9,
    color: '#94a3b8',
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 3,
  },

  logFieldValue: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
  },

  reasonBox: {
    flexDirection: 'row',
    backgroundColor: '#fffbeb',
    borderRadius: 10,
    padding: 10,
    marginTop: 2,
    marginBottom: 8,
  },

  reasonContent: {
    flex: 1,
    marginLeft: 8,
  },

  reasonLabel: {
    fontSize: 10,
    color: '#92400e',
    fontWeight: '800',
    marginBottom: 2,
  },

  reasonText: {
    fontSize: 12,
    color: '#78350f',
    lineHeight: 17,
  },

  taskBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    marginTop: 4,
  },

  taskLabel: {
    fontSize: 9,
    color: '#94a3b8',
    fontWeight: '800',
    marginBottom: 4,
  },

  taskText: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 17,
  },

  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingBottom: 40,
  },

  summaryCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    alignItems: 'center',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  summaryValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    marginVertical: 4,
  },

  summaryLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    textAlign: 'center',
  },
});