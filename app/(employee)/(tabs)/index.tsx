import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
} from 'react-native';

import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

import { useAuthStore } from '@/store/authStore';

import {
  useDashboard,
  useTodayAttendance,
  useManualCheckIn,
  useManualCheckOut,
  useProfile,
  useMyAttendanceRequests,
} from '@/hooks/useEmployeeApi';

import Toast from 'react-native-toast-message';

import {
  getApiErrorMessage,
  getGpsWindowClosedDetails,
  getRemainingLeaveBalance,
  isGpsWindowClosedResponse,
  isHolidayCheckInResponse,
  getEmployeeStatus,
  startLunchBreak,
  recordTemporaryReturn,
  type GpsWindowClosedDetails,
  type HolidayInfo,
  type ManualCheckInPayload,
} from '@/api/axios';

/* ============================================================
   SCREEN DIMENSIONS
============================================================ */

const { width } = Dimensions.get('window');

/* ============================================================
   HELPERS
============================================================ */

const formatDisplayTime = (value: unknown): string => {
  if (!value) return '--:--';

  try {
    if (typeof value === 'object' && value !== null) {
      const objectValue = value as any;

      if (
        'hours' in objectValue ||
        'minutes' in objectValue ||
        'seconds' in objectValue
      ) {
        const hours = Number(objectValue.hours || 0);
        const minutes = Number(objectValue.minutes || 0);
        const seconds = Number(objectValue.seconds || 0);

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

      if (value instanceof Date) {
        return value.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
      }

      return JSON.stringify(value);
    }

    if (typeof value === 'string') {
      const timeMatch = value.match(
        /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/
      );

      if (timeMatch) {
        let hours = Number(timeMatch[1]);
        const minutes = Number(timeMatch[2]);

        const ampm = hours >= 12 ? 'PM' : 'AM';

        hours = hours % 12 || 12;

        return `${hours}:${String(minutes).padStart(
          2,
          '0'
        )} ${ampm}`;
      }

      const date = new Date(value);

      if (!Number.isNaN(date.getTime())) {
        return date.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
      }

      return value;
    }

    return '--:--';
  } catch (error) {
    console.warn('Error formatting time:', error);
    return '--:--';
  }
};

const formatHoursWorked = (value: any): string => {
  if (!value) return '0h 0m';

  if (typeof value === 'object' && value !== null) {
    const hours = Number(value.hours || 0);
    const minutes = Number(value.minutes || 0);
    const seconds = Number(value.seconds || 0);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }

    if (minutes > 0) {
      return `${minutes}m`;
    }

    if (seconds > 0) {
      return `${seconds}s`;
    }

    return '0h 0m';
  }

  if (typeof value === 'string') {
    if (value.includes('h') || value.includes('m')) {
      return value;
    }

    const parts = value.split(':');

    if (parts.length === 2) {
      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);

      if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
        if (hours > 0) {
          return `${hours}h ${minutes}m`;
        }

        return `${minutes}m`;
      }
    }

    return value;
  }

  return '0h 0m';
};

const getTodayDateString = () =>
  new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

const getTodayISODate = () =>
  new Date().toISOString().slice(0, 10);

const getGreeting = () => {
  const hour = new Date().getHours();

  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';

  return 'Good Evening';
};

/* ============================================================
   LUNCH HELPERS
============================================================ */

/**
 * Backend lunch response shape (from statistics.lunch):
 *
 * {
 *   "active": false,
 *   "allowed_minutes": null,
 *   "completed": false,
 *   "exit_time": null,
 *   "expected_return_time": null,
 *   "late": false,
 *   "late_minutes": 0,
 *   "late_reason": null,
 *   "on_time": null,
 *   "return_time": null,
 *   "status": null,
 *   "taken": false
 * }
 */

type LunchState = {
  taken: boolean;
  status: string | null;
  exitTime: string | null;
  returnTime: string | null;
  duration: string | null;
  allowedMinutes: number;
  late: boolean;
  lateMinutes: number;
};

/**
 * Backend permission response shape (from statistics.permission):
 *
 * {
 *   "active": false,
 *   "allowed_minutes": 60,
 *   "completed": true,
 *   "exit_time": "2026-09-15T05:00:00.000Z",
 *   "expected_return_time": "2026-09-15T06:00:00.000Z",
 *   "late": false,
 *   "late_minutes": 0,
 *   "late_reason": null,
 *   "on_time": true,
 *   "return_time": "2026-09-15T05:58:58.388Z",
 *   "status": "RETURNED",
 *   "taken": true
 * }
 */

type PermissionMovementState = {
  active: boolean;
  permissionId: string | null;
  type: string | null;
  approvedFrom: string | null;
  approvedTo: string | null;
  allowedMinutes: number;
  reason: string | null;
};

const EMPTY_PERMISSION_MOVEMENT: PermissionMovementState = {
  active: false,
  permissionId: null,
  type: null,
  approvedFrom: null,
  approvedTo: null,
  allowedMinutes: 0,
  reason: null,
};

const getLunchData = (source: any): LunchState => {
  const emptyLunch: LunchState = {
    taken: false,
    status: null,
    exitTime: null,
    returnTime: null,
    duration: null,
    allowedMinutes: 60,
    late: false,
    lateMinutes: 0,
  };

  if (!source) {
    return emptyLunch;
  }

  const lunch =
    source?.statistics?.lunch ??
    source?.data?.statistics?.lunch ??
    source?.data?.data?.statistics?.lunch ??
    source?.lunch ??
    source?.data?.lunch ??
    source?.result?.lunch ??
    null;

  if (!lunch) {
    console.warn(
      'Lunch data was not found in status response:',
      source
    );

    return emptyLunch;
  }

  const allowedMinutes = Number(
    lunch.allowed_minutes ??
      lunch.allowedMinutes ??
      60
  );

  const lateMinutes = Number(
    lunch.late_minutes ??
      lunch.lateMinutes ??
      0
  );

  return {
    taken: lunch.taken === true,

    status:
      typeof lunch.status === 'string'
        ? lunch.status.toUpperCase()
        : null,

    exitTime:
      lunch.exit_time ??
      lunch.exitTime ??
      null,

    returnTime:
      lunch.return_time ??
      lunch.returnTime ??
      null,

    duration:
      lunch.duration ??
      null,

    allowedMinutes: Number.isFinite(
      allowedMinutes
    )
      ? allowedMinutes
      : 60,

    late: lunch.late === true,

    lateMinutes: Number.isFinite(
      lateMinutes
    )
      ? lateMinutes
      : 0,
  };
};

/**
 * Reads `statistics.permission` from the /get_emp_status
 * response. The backend uses `active: true` to mean "the
 * employee is currently out on an approved permission and
 * has not yet returned", and `active: false` (plus
 * `completed: true` / `status: "RETURNED"` / a populated
 * `return_time`) to mean the return has already been
 * recorded.
 *
 * We deliberately key off `active` alone, because that is
 * the single flag the backend already maintains as the
 * source of truth for this screen. No client-side "already
 * returned" memory is needed.
 */
const getPermissionMovementData = (
  source: any
): PermissionMovementState => {
  if (!source) {
    return EMPTY_PERMISSION_MOVEMENT;
  }

  const permission =
    source?.statistics?.permission ??
    source?.data?.statistics?.permission ??
    source?.data?.data?.statistics?.permission ??
    source?.permission ??
    source?.data?.permission ??
    source?.result?.permission ??
    null;

  if (!permission) {
    return EMPTY_PERMISSION_MOVEMENT;
  }

  const isActive = permission.active === true;

  if (!isActive) {
    return EMPTY_PERMISSION_MOVEMENT;
  }

  const exitTime =
    permission.exit_time ??
    permission.exitTime ??
    null;

  const expectedReturnTime =
    permission.expected_return_time ??
    permission.expectedReturnTime ??
    permission.approved_to ??
    permission.approvedTo ??
    null;

  const allowedMinutes = Number(
    permission.allowed_minutes ??
      permission.allowedMinutes ??
      0
  );

  return {
    active: true,
    permissionId: permission.id
      ? String(permission.id)
      : permission.permission_id
      ? String(permission.permission_id)
      : null,
    type: permission.type ?? null,
    approvedFrom: exitTime,
    approvedTo: expectedReturnTime,
    allowedMinutes: Number.isFinite(allowedMinutes)
      ? allowedMinutes
      : 0,
    reason:
      permission.reason ??
      permission.late_reason ??
      null,
  };
};

const calculateLunchDuration = (
  exitTime: string | null,
  returnTime: string | null
): string => {
  if (!exitTime || !returnTime) {
    return '--';
  }

  try {
    const exit = new Date(exitTime).getTime();
    const returned =
      new Date(returnTime).getTime();

    if (
      Number.isNaN(exit) ||
      Number.isNaN(returned)
    ) {
      return '--';
    }

    const difference = returned - exit;

    if (difference < 0) {
      return '--';
    }

    const totalMinutes = Math.floor(
      difference / (1000 * 60)
    );

    const hours = Math.floor(
      totalMinutes / 60
    );

    const minutes = totalMinutes % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }

    return `${minutes}m`;
  } catch {
    return '--';
  }
};

/* ============================================================
   ERROR HELPERS
============================================================ */

const getErrorStatus = (
  error: any
): string | null => {
  return (
    error?.response?.data?.status ??
    error?.response?.data?.code ??
    error?.response?.status ??
    null
  );
};

const isNoActiveLunchExitError = (
  error: any
): boolean => {
  const status =
    error?.response?.data?.status;

  const message =
    error?.response?.data?.message;

  return (
    status === 'NO_ACTIVE_EXIT' ||
    (
      typeof message === 'string' &&
      message.toLowerCase().includes(
        'no active lunch exit'
      )
    )
  );
};

/* ============================================================
   COMPONENT
============================================================ */

export default function EmployeeDashboard() {
  const { user } = useAuthStore();

  const router = useRouter();

  /* ----------------------------------------------------------
     DASHBOARD
  ---------------------------------------------------------- */

  const {
    data,
    isLoading,
    isRefetching,
    refetch,
    isError,
  } = useDashboard();

  const {
    refetch: refetchAttendance,
  } = useTodayAttendance();

  const {
    data: profile,
  } = useProfile();

  /* ----------------------------------------------------------
     EARLY GOING
  ---------------------------------------------------------- */

  const todayISO =
    getTodayISODate();

  const {
    data: earlyGoingRequestsData,
    refetch:
      refetchEarlyGoingRequests,
  } =
    useMyAttendanceRequests({
      type: 'EARLY_GOING',
      status: 'ALL',
      date: todayISO,
    });

  const approvedEarlyGoingRequest =
    earlyGoingRequestsData?.requests?.find(
      (item) =>
        item.request.status ===
        'APPROVED'
    );

  const hasApprovedEarlyGoing =
    !!approvedEarlyGoingRequest;

  /* ----------------------------------------------------------
     ANIMATION
  ---------------------------------------------------------- */

  const fadeAnim =
    useRef(new Animated.Value(0)).current;

  const slideAnim =
    useRef(new Animated.Value(30)).current;

  const scaleAnim =
    useRef(new Animated.Value(0.95)).current;

  /* ----------------------------------------------------------
     MODALS
  ---------------------------------------------------------- */

  const [
    showCheckInModal,
    setShowCheckInModal,
  ] = useState(false);

  const [
    showCheckOutModal,
    setShowCheckOutModal,
  ] = useState(false);

  const [
    holidayPrompt,
    setHolidayPrompt,
  ] =
    useState<HolidayInfo | null>(null);

  const [
    gpsWindowClosed,
    setGpsWindowClosed,
  ] =
    useState<GpsWindowClosedDetails | null>(
      null
    );

  /* ----------------------------------------------------------
     FORM
  ---------------------------------------------------------- */

  const [reason, setReason] =
    useState('');

  const [task, setTask] =
    useState('');

  const [
    earlyGoingReason,
    setEarlyGoingReason,
  ] = useState('');

  /* ----------------------------------------------------------
     LOCATION
  ---------------------------------------------------------- */

  const [
    location,
    setLocation,
  ] =
    useState<Location.LocationObject | null>(
      null
    );

  const [
    loadingLocation,
    setLoadingLocation,
  ] = useState(false);

  /* ----------------------------------------------------------
     ALERTS
  ---------------------------------------------------------- */

  const [alertCount] =
    useState(0);

  /* ==========================================================
     LUNCH STATE
  ========================================================== */

  const [
    lunchLoading,
    setLunchLoading,
  ] = useState(false);

  const [
    lunchStatusLoading,
    setLunchStatusLoading,
  ] = useState(false);

  const [
    lunchTaken,
    setLunchTaken,
  ] = useState(false);

  const [
    lunchStatus,
    setLunchStatus,
  ] =
    useState<string | null>(null);

  const [
    lunchExitTime,
    setLunchExitTime,
  ] =
    useState<string | null>(null);

  const [
    lunchReturnTime,
    setLunchReturnTime,
  ] =
    useState<string | null>(null);

  const [
    lunchDuration,
    setLunchDuration,
  ] =
    useState<string | null>(null);

  const [
    lunchAllowedMinutes,
    setLunchAllowedMinutes,
  ] = useState(60);

  const [
    lunchLate,
    setLunchLate,
  ] = useState(false);

  const [
    lunchLateMinutes,
    setLunchLateMinutes,
  ] = useState(0);

  /* ==========================================================
     PERMISSION RETURN STATE
     ----------------------------------------------------------
     Derived from `statistics.permission.active` on the
     /get_emp_status response (same call as lunch). When the
     backend reports `active: true`, the card is shown. When
     it reports `active: false` (i.e. the return has already
     been recorded), the card is hidden — including on every
     fresh app load.
  ========================================================== */

  const [
    permissionLoading,
    setPermissionLoading,
  ] = useState(false);

  const [
    permissionMovement,
    setPermissionMovement,
  ] = useState<PermissionMovementState>(
    EMPTY_PERMISSION_MOVEMENT
  );

  /* ==========================================================
     MUTATIONS
  ========================================================== */

  const checkInMutation =
    useManualCheckIn();

  const checkOutMutation =
    useManualCheckOut();

  /* ==========================================================
     ANIMATION
  ========================================================== */

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),

      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),

      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  /* ==========================================================
     LOCATION
  ========================================================== */

  const getLocation =
    useCallback(async () => {
      setLoadingLocation(true);

      try {
        const {
          status,
        } =
          await Location.requestForegroundPermissionsAsync();

        if (status !== 'granted') {
          Toast.show({
            type: 'error',
            text1: 'Permission Denied',
            text2:
              'Location permission is required for attendance.',
          });

          return;
        }

        const currentLocation =
          await Location.getCurrentPositionAsync(
            {
              accuracy:
                Location.Accuracy.High,
            }
          );

        setLocation(
          currentLocation
        );
      } catch (error) {
        console.error(
          'Location error:',
          error
        );
      } finally {
        setLoadingLocation(false);
      }
    }, []);

  useEffect(() => {
    getLocation();
  }, [getLocation]);

  /* ==========================================================
     IDENTIFIERS
  ========================================================== */

  /*
   * IMPORTANT:
   *
   * /get_emp_status
   *     -> users.id
   *
   * /lunch
   *     -> employees.employee_code
   *
   * /temporary-return
   *     -> employees.id
   *
   * Therefore we do NOT use one generic ID
   * for every API.
   */

  const usersId =
    user?.id ??
    null;

  const employeesId =
    user?.employee_id ??
    profile?.employee_id ??
    profile?.id ??
    null;

  const employeeCode =
    profile?.employee_code ??
    user?.employee_code ??
    (
      typeof user?.employee_id ===
      'string'
        ? user.employee_id
        : null
    );

  /*
   * Status API requires users.id.
   */
  const statusUserId =
    usersId
      ? String(usersId)
      : '';

  /*
   * Lunch OUT requires employee_code.
   */
  const lunchEmployeeCode =
    employeeCode
      ? String(employeeCode)
      : '';

  /*
   * Lunch RETURN / Permission RETURN require employees.id.
   */
  const lunchEmployeeDbId =
    employeesId
      ? String(employeesId)
      : '';

  /* ==========================================================
     LOAD EMPLOYEE STATUS (LUNCH + PERMISSION)
     ----------------------------------------------------------
     Both lunch state and permission movement state come
     from the same /get_emp_status response, so a single
     fetch keeps them in sync. On every app load (and on
     pull-to-refresh, and after any return action) this
     refetches and re-derives both pieces of state straight
     from the backend.
  ========================================================== */

  const loadLunchStatus =
    useCallback(async () => {
      if (!statusUserId) {
        console.warn(
          'Employee status: users.id is missing'
        );

        return;
      }

      setLunchStatusLoading(true);

      try {
        /*
         * /get_emp_status requires users.id.
         */
        const response =
          await getEmployeeStatus(
            statusUserId
          );

        const responseData =
          (response as any)?.data ??
          response;

        console.log(
          'Employee status response:',
          responseData
        );

        const lunch =
          getLunchData(
            responseData
          );

        console.log(
          'Parsed lunch state:',
          lunch
        );

        setLunchTaken(
          lunch.taken
        );

        setLunchStatus(
          lunch.status
        );

        setLunchExitTime(
          lunch.exitTime
        );

        setLunchReturnTime(
          lunch.returnTime
        );

        setLunchAllowedMinutes(
          lunch.allowedMinutes
        );

        setLunchLate(
          lunch.late
        );

        setLunchLateMinutes(
          lunch.lateMinutes
        );

        if (lunch.duration) {
          setLunchDuration(
            lunch.duration
          );
        } else if (
          lunch.exitTime &&
          lunch.returnTime
        ) {
          setLunchDuration(
            calculateLunchDuration(
              lunch.exitTime,
              lunch.returnTime
            )
          );
        } else {
          setLunchDuration(null);
        }

        /*
         * Permission state comes from the same response.
         */
        const permission =
          getPermissionMovementData(
            responseData
          );

        console.log(
          'Parsed permission movement state:',
          permission
        );

        setPermissionMovement(permission);
      } catch (error) {
        console.warn(
          'Unable to load employee status:',
          error
        );

        /*
         * Do NOT wipe existing lunch / permission state
         * simply because the status API failed.
         */
      } finally {
        setLunchStatusLoading(false);
      }
    }, [statusUserId]);

  useEffect(() => {
    if (statusUserId) {
      loadLunchStatus();
    }
  }, [
    statusUserId,
    loadLunchStatus,
  ]);

  /* ==========================================================
     LUNCH STATE
  ========================================================== */

  /*
   * Backend source of truth:
   *
   * taken === true
   * status === OUT
   * exit_time exists
   * return_time === null
   */

  const lunchInProgress =
    lunchTaken === true &&
    lunchStatus === 'OUT' &&
    !!lunchExitTime &&
    !lunchReturnTime;

  const lunchCompleted =
    lunchTaken === true &&
    !!lunchExitTime &&
    !!lunchReturnTime;

  /* ==========================================================
     LUNCH EXIT
  ========================================================== */

  const handleLunchExit =
    async () => {
      /*
       * Prevent duplicate taps.
       */
      if (lunchLoading) {
        return;
      }

      if (!lunchEmployeeCode) {
        Toast.show({
          type: 'error',
          text1:
            'Employee Code Missing',
          text2:
            'Unable to identify your employee code.',
        });

        return;
      }

      if (!isCheckedIn) {
        Toast.show({
          type: 'error',
          text1:
            'Check In Required',
          text2:
            'You must check in before exiting for lunch.',
        });

        return;
      }

      if (isCheckedOut) {
        Toast.show({
          type: 'error',
          text1:
            'Attendance Completed',
          text2:
            'You cannot start lunch after checking out.',
        });

        return;
      }

      /*
       * Trust backend lunch state.
       */
      if (lunchInProgress) {
        Toast.show({
          type: 'info',
          text1:
            'Lunch Already Started',
          text2:
            'Please return from lunch first.',
        });

        return;
      }

      if (lunchCompleted) {
        Toast.show({
          type: 'info',
          text1:
            'Lunch Already Completed',
          text2:
            'Your lunch break has already been recorded today.',
        });

        return;
      }

      if (!location) {
        await getLocation();

        Toast.show({
          type: 'error',
          text1:
            'Location Required',
          text2:
            'Please enable location and try again.',
        });

        return;
      }

      setLunchLoading(true);

      const currentTime =
        new Date().toISOString();

      try {
        /*
         * /lunch requires:
         *
         * userId = employees.employee_code
         */
        const payload = {
          userId:
            lunchEmployeeCode,

          lat:
            location.coords.latitude,

          lng:
            location.coords.longitude,

          time:
            currentTime,
        };

        console.log(
          'Lunch OUT payload:',
          payload
        );

        await startLunchBreak(
          payload
        );

        /*
         * Do not depend only on local state.
         * Reload backend state.
         */
        await loadLunchStatus();

        await refetch();
        await refetchAttendance();

        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );

        Toast.show({
          type: 'success',
          text1:
            'Lunch Exit Recorded',
          text2:
            'Your lunch exit time has been recorded.',
        });
      } catch (error: any) {
        console.error(
          'Lunch exit error:',
          error
        );

        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Error
        );

        Toast.show({
          type: 'error',
          text1:
            'Lunch Exit Failed',
          text2:
            getApiErrorMessage(error),
        });
      } finally {
        setLunchLoading(false);
      }
    };

  /* ==========================================================
     LUNCH RETURN
  ========================================================== */

  const handleLunchReturn =
    async () => {
      /*
       * Prevent duplicate taps.
       */
      if (lunchLoading) {
        return;
      }

      if (!lunchEmployeeDbId) {
        Toast.show({
          type: 'error',
          text1:
            'Employee Database ID Missing',
          text2:
            'Unable to identify your employee account.',
        });

        return;
      }

      /*
       * Return is allowed only when backend says
       * an active lunch exists.
       */
      if (!lunchInProgress) {
        Toast.show({
          type: 'info',
          text1:
            'No Active Lunch',
          text2:
            'There is no active lunch break to return from.',
        });

        /*
         * Reconcile with backend.
         */
        await loadLunchStatus();

        return;
      }

      if (!isCheckedIn || isCheckedOut) {
        Toast.show({
          type: 'error',
          text1:
            'Invalid Attendance State',
          text2:
            'You cannot return from lunch after checking out.',
        });

        return;
      }

      if (!location) {
        await getLocation();

        Toast.show({
          type: 'error',
          text1:
            'Location Required',
          text2:
            'Please enable location and try again.',
        });

        return;
      }

      setLunchLoading(true);

      const currentTime =
        new Date().toISOString();

      try {
        /*
         * IMPORTANT:
         *
         * /temporary-return requires:
         *
         * userId = employees.id
         * type   = LUNCH
         */
        const payload = {
          userId:
            lunchEmployeeDbId,

          type:
            'LUNCH',

          lat:
            location.coords.latitude,

          lng:
            location.coords.longitude,

          time:
            currentTime,
        };

        console.log(
          'Lunch RETURN payload:',
          payload
        );

        await recordTemporaryReturn(
          payload
        );

        /*
         * Backend is the source of truth.
         */
        await loadLunchStatus();

        await refetch();
        await refetchAttendance();

        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );

        Toast.show({
          type: 'success',
          text1:
            'Welcome Back',
          text2:
            'Your lunch return time has been recorded.',
        });
      } catch (error: any) {
        console.error(
          'Lunch return error:',
          error
        );

        /*
         * Backend says there is no active lunch.
         *
         * This means local state was stale.
         */
        if (
          isNoActiveLunchExitError(
            error
          )
        ) {
          setLunchTaken(false);
          setLunchStatus(null);
          setLunchExitTime(null);
          setLunchReturnTime(null);
          setLunchDuration(null);

          /*
           * Refresh backend state once.
           * No automatic retry of the mutation.
           */
          await loadLunchStatus();

          await refetch();
          await refetchAttendance();

          Toast.show({
            type: 'info',
            text1:
              'Lunch State Updated',
            text2:
              'The backend has no active lunch exit. Your screen has been refreshed.',
          });

          return;
        }

        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Error
        );

        Toast.show({
          type: 'error',
          text1:
            'Lunch Return Failed',
          text2:
            getApiErrorMessage(error),
        });
      } finally {
        setLunchLoading(false);
      }
    };

  /* ==========================================================
     PERMISSION RETURN
     ----------------------------------------------------------
     The temporary-return API expects a LOWERCASE type for
     permission returns: `type: "permission"`. Lunch return
     keeps using `"LUNCH"` (uppercase).

     The card is visible if and only if
     `permissionMovement.active` is true, which comes
     straight from `statistics.permission.active` on the
     /get_emp_status response. After a successful return we
     optimistically clear permissionMovement so the card
     disappears immediately, then reconcile via
     loadLunchStatus() (which refetches the same status
     response and re-derives the permission state).
  ========================================================== */

  const permissionInProgress =
    permissionMovement.active;

  const handlePermissionReturn =
    async () => {
      if (permissionLoading) {
        return;
      }

      if (!lunchEmployeeDbId) {
        Toast.show({
          type: 'error',
          text1: 'Employee Database ID Missing',
          text2:
            'Unable to identify your employee account.',
        });
        return;
      }

      /*
       * The backend creates the PERMISSION movement when
       * HR approves the permission. Therefore the employee
       * does NOT create another exit record here.
       *
       * This action records only the return.
       */
      if (!permissionInProgress) {
        Toast.show({
          type: 'info',
          text1: 'No Active Permission',
          text2:
            'There is no active permission to return from.',
        });

        await loadLunchStatus();
        return;
      }

      if (!isCheckedIn || isCheckedOut) {
        Toast.show({
          type: 'error',
          text1: 'Invalid Attendance State',
          text2:
            'You cannot return from permission after checking out.',
        });
        return;
      }

      if (!location) {
        await getLocation();

        Toast.show({
          type: 'error',
          text1: 'Location Required',
          text2:
            'Please enable location and try again.',
        });
        return;
      }

      setPermissionLoading(true);

      try {
        const payload = {
          userId: lunchEmployeeDbId,

          // Backend expects lowercase "permission".
          type: 'permission' as const,

          lat: location.coords.latitude,
          lng: location.coords.longitude,
          time: new Date().toISOString(),
        };

        console.log(
          'Permission RETURN payload:',
          payload
        );

        const response =
          await recordTemporaryReturn(payload);

        console.log(
          'Permission RETURN response:',
          response
        );

        /*
         * Optimistically hide the card immediately, then
         * reconcile with the backend. We don't wait on
         * loadLunchStatus() to hide it, in case the
         * backend takes a moment to flip `active` to
         * false.
         */
        setPermissionMovement(EMPTY_PERMISSION_MOVEMENT);

        await refetch();
        await refetchAttendance();
        await loadLunchStatus();

        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );

        Toast.show({
          type: 'success',
          text1: 'Permission Return Recorded',
          text2:
            response?.message ||
            'Your permission return time has been recorded.',
        });
      } catch (error: any) {
        console.error(
          'Permission return error:',
          error
        );

        const status =
          error?.response?.data?.status;

        if (
          status === 'NO_ACTIVE_EXIT' ||
          status === 'RETURN_ALREADY_RECORDED'
        ) {
          /*
           * Backend says NO_ACTIVE_EXIT (or the return was
           * already recorded elsewhere). Trust it and hide
           * the card — do not keep showing "active" state
           * client-side.
           */
          setPermissionMovement(EMPTY_PERMISSION_MOVEMENT);

          await refetch();
          await refetchAttendance();
          await loadLunchStatus();

          Toast.show({
            type: 'info',
            text1: 'Permission State Updated',
            text2:
              'The backend no longer has an active permission exit.',
          });

          return;
        }

        /*
         * Do NOT hide the card locally when the API call
         * fails for any other reason — reflect the real
         * backend state instead.
         */
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Error
        );

        Toast.show({
          type: 'error',
          text1: 'Permission Return Failed',
          text2: getApiErrorMessage(error),
        });
      } finally {
        setPermissionLoading(false);
      }
    };

  /* ==========================================================
     SHIFT DATA
  ========================================================== */

  const getShiftData = () => {
    if (
      profile?.shift &&
      typeof profile.shift ===
        'object'
    ) {
      return {
        name:
          profile.shift.name ||
          '—',

        start_time:
          profile.shift.start_time ||
          null,

        end_time:
          profile.shift.end_time ||
          null,
      };
    }

    if (
      typeof profile?.shift ===
      'string'
    ) {
      return {
        name:
          profile.shift,

        start_time:
          data?.shiftStart ||
          data?.start_time ||
          null,

        end_time:
          data?.shiftEnd ||
          data?.end_time ||
          null,
      };
    }

    return {
      name:
        data?.shift ||
        data?.shiftName ||
        '—',

      start_time:
        data?.shiftStart ||
        data?.shift_start ||
        null,

      end_time:
        data?.shiftEnd ||
        data?.shift_end ||
        null,
    };
  };

  const shiftData =
    getShiftData();

  const shiftName =
    shiftData.name;

  const shiftStart =
    shiftData.start_time;

  const shiftEnd =
    shiftData.end_time;

  /* ==========================================================
     ATTENDANCE DATA
  ========================================================== */

  const inTime =
    data?.inTime ??
    data?.IN_Time ??
    null;

  const outTime =
    data?.outTime ??
    data?.OUT_Time ??
    null;

  const hoursWorked =
    formatHoursWorked(
      data?.hoursWorked
    );

  const isLate =
    !!data?.lateStatus;

  const pendingRequests =
    data?.pendingRequests ?? 0;

  const remainingLeave =
    getRemainingLeaveBalance(
      data?.leaveBalance
    );

  const todayStatus =
    data?.todayStatus ||
    (
      outTime
        ? 'Shift Completed'
        : inTime
        ? 'Present'
        : 'Not Marked Yet'
    );

  const statusColor =
    outTime
      ? '#3b82f6'
      : inTime
      ? '#10b981'
      : '#94a3b8';

  const isCheckedIn =
    !!inTime;

  const isCheckedOut =
    !!outTime;

  /* ==========================================================
     SHIFT END
  ========================================================== */

  const getTodayShiftEnd = (
    value:
      | string
      | null
      | undefined
  ): Date | null => {
    if (!value) return null;

    const direct =
      new Date(value);

    if (
      !Number.isNaN(
        direct.getTime()
      ) &&
      /[T-]/.test(value)
    ) {
      return direct;
    }

    const match =
      String(value).match(
        /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/
      );

    if (!match) return null;

    const end =
      new Date();

    end.setHours(
      Number(match[1]),
      Number(match[2]),
      Number(match[3] || 0),
      0
    );

    return end;
  };

  const shiftEndDate =
    getTodayShiftEnd(
      shiftEnd
    );

  const isEarlyGoing =
    Boolean(
      isCheckedIn &&
        !isCheckedOut &&
        shiftEndDate &&
        new Date() <
          shiftEndDate
    );

  /* ==========================================================
     EARLY GOING AUTO FILL
  ========================================================== */

  useEffect(() => {
    if (
      showCheckOutModal &&
      isEarlyGoing &&
      hasApprovedEarlyGoing
    ) {
      setEarlyGoingReason(
        approvedEarlyGoingRequest
          ?.request.reason ||
          'Approved by HR'
      );
    }
  }, [
    showCheckOutModal,
    isEarlyGoing,
    hasApprovedEarlyGoing,
    approvedEarlyGoingRequest,
  ]);

  /* ==========================================================
     CHECK IN
  ========================================================== */

  const submitCheckIn =
    async (
      workoff = false
    ) => {
      if (!location) {
        Toast.show({
          type: 'error',
          text1:
            'Location Required',
          text2:
            'Please enable location and try again.',
        });

        return;
      }

      if (!reason.trim()) {
        Toast.show({
          type: 'error',
          text1:
            'Reason Required',
          text2:
            'Please provide a reason for check-in.',
        });

        return;
      }

      const payload:
        ManualCheckInPayload = {
        userId:
          user?.employee_id ||
          user?.id ||
          '',

        lat:
          location.coords.latitude,

        lng:
          location.coords.longitude,

        time:
          new Date().toISOString(),

        reason:
          reason.trim(),

        workoff,
      };

      try {
        await checkInMutation.mutateAsync(
          payload
        );

        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );

        Toast.show({
          type: 'success',

          text1:
            workoff
              ? 'Work-off Check-In Successful'
              : 'Check-In Successful',

          text2:
            workoff
              ? 'Your holiday work-off attendance has been recorded.'
              : 'You have been checked in successfully.',
        });

        setReason('');
        setHolidayPrompt(null);
        setGpsWindowClosed(null);
        setShowCheckInModal(false);

        await refetch();
        await refetchAttendance();

        await loadLunchStatus();
      } catch (error: any) {
        if (
          isGpsWindowClosedResponse(
            error
          )
        ) {
          setGpsWindowClosed(
            getGpsWindowClosedDetails(
              error
            )
          );

          setHolidayPrompt(null);

          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Error
          );

          return;
        }

        if (
          isHolidayCheckInResponse(
            error
          )
        ) {
          const holiday =
            error.response?.data
              ?.holiday;

          setHolidayPrompt(
            holiday
              ? {
                  id: holiday.id,
                  name:
                    holiday.name ||
                    'Holiday',
                  type:
                    holiday.type ||
                    null,
                  date:
                    holiday.date ||
                    getTodayISODate(),
                }
              : {
                  id: 'holiday',
                  name:
                    'Today is a holiday',
                  type: null,
                  date:
                    getTodayISODate(),
                }
          );

          return;
        }

        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Error
        );

        Toast.show({
          type: 'error',
          text1:
            'Check-In Failed',
          text2:
            getApiErrorMessage(
              error
            ),
        });
      }
    };

  const handleCheckIn =
    () => submitCheckIn(false);

  const handleConfirmWorkoff =
    () => submitCheckIn(true);

  const closeCheckInModal =
    () => {
      setHolidayPrompt(null);
      setGpsWindowClosed(null);
      setShowCheckInModal(false);
    };

  /* ==========================================================
     CHECK OUT
  ========================================================== */

  const handleCheckOut =
    async () => {
      if (!location) {
        Toast.show({
          type: 'error',
          text1:
            'Location Required',
          text2:
            'Please enable location and try again.',
        });

        return;
      }

      if (!task.trim()) {
        Toast.show({
          type: 'error',
          text1:
            'Task Required',
          text2:
            "Please provide today's task.",
        });

        return;
      }

      if (
        isEarlyGoing &&
        !hasApprovedEarlyGoing &&
        !earlyGoingReason.trim()
      ) {
        Toast.show({
          type: 'error',
          text1:
            'Early Going Reason Required',
          text2:
            'You are leaving before shift end. Please provide a reason.',
        });

        return;
      }

      try {
        const payload: any = {
          userId:
            user?.employee_id ||
            user?.id ||
            '',

          lat:
            location.coords.latitude,

          lng:
            location.coords.longitude,

          time:
            new Date().toISOString(),

          task:
            task.trim(),

          T_reason:
            reason.trim() || '',

          remarks: '',
        };

        if (isEarlyGoing) {
          payload.early_going_reason =
            earlyGoingReason.trim();
        }

        await checkOutMutation.mutateAsync(
          payload
        );

        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );

        Toast.show({
          type: 'success',
          text1:
            'Check-Out Successful',
          text2:
            'You have been checked out successfully.',
        });

        setTask('');
        setReason('');
        setEarlyGoingReason('');
        setShowCheckOutModal(false);

        await refetch();
        await refetchAttendance();
        await refetchEarlyGoingRequests();

        await loadLunchStatus();
      } catch (error: any) {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Error
        );

        Toast.show({
          type: 'error',
          text1:
            'Check-Out Failed',
          text2:
            getApiErrorMessage(
              error
            ),
        });
      }
    };

  const handleCheckOutButtonPress =
    () => {
      Haptics.impactAsync(
        Haptics.ImpactFeedbackStyle.Medium
      );

      setShowCheckOutModal(
        true
      );
    };

  /* ==========================================================
     ALERTS
  ========================================================== */

  const openAlerts = () => {
    Haptics.impactAsync(
      Haptics.ImpactFeedbackStyle.Light
    );

    router.push(
      '/notifications' as any
    );
  };

  /* ==========================================================
     LOADING
  ========================================================== */

  if (isLoading) {
    return (
      <View
        style={
          styles.centerContainer
        }
      >
        <LinearGradient
          colors={[
            '#3b82f6',
            '#8b5cf6',
          ]}
          style={
            styles.loadingGradient
          }
        >
          <ActivityIndicator
            size="large"
            color="#fff"
          />

          <Text
            style={
              styles.loadingText
            }
          >
            Loading your dashboard...
          </Text>
        </LinearGradient>
      </View>
    );
  }

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <View
      style={styles.container}
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#f8fafc"
      />

      {/* ======================================================
          HEADER
      ====================================================== */}

      <LinearGradient
        colors={[
          '#ffffff',
          '#f8fafc',
        ]}
        style={
          styles.headerGradient
        }
      >
        <View
          style={styles.header}
        >
          <View
            style={
              styles.headerLeft
            }
          >
            <Image
              source={{
                uri:
                  'https://ircscancerhospital.org/wp-content/uploads/2024/07/logo11.png',
              }}
              style={styles.logo}
              resizeMode="contain"
            />

            <View
              style={
                styles.greetingContainer
              }
            >
              <Text
                style={styles.dateText}
              >
                {getTodayDateString()}
              </Text>

              <Text
                style={styles.greeting}
              >
                {getGreeting()},
              </Text>

              <Text
                style={styles.userName}
              >
                {user?.Name ||
                  'Employee'}
              </Text>

              {profile?.employee_code && (
                <Text
                  style={
                    styles.employeeCode
                  }
                >
                  #{profile.employee_code}
                </Text>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={
              styles.alertButton
            }
            onPress={openAlerts}
            activeOpacity={0.7}
          >
            <Ionicons
              name="notifications-outline"
              size={25}
              color="#0f172a"
            />

            {alertCount > 0 && (
              <View
                style={
                  styles.alertBadge
                }
              >
                <Text
                  style={
                    styles.alertBadgeText
                  }
                >
                  {alertCount > 99
                    ? '99+'
                    : alertCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* ======================================================
          CONTENT
      ====================================================== */}

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.scrollContent
        }
        refreshControl={
          <RefreshControl
            refreshing={
              !!isRefetching
            }
            onRefresh={async () => {
              await refetch();
              await refetchAttendance();
              await loadLunchStatus();
            }}
            tintColor="#3b82f6"
            colors={[
              '#3b82f6',
            ]}
          />
        }
      >
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [
              {
                translateY:
                  slideAnim,
              },
            ],
          }}
        >
          {/* ERROR */}

          {isError && (
            <View
              style={
                styles.errorBanner
              }
            >
              <Ionicons
                name="alert-circle-outline"
                size={20}
                color="#92400e"
              />

              <Text
                style={
                  styles.errorText
                }
              >
                Couldn't refresh live data.
                Showing last known info.
              </Text>
            </View>
          )}

          {/* ==================================================
              ATTENDANCE CARD
          ================================================== */}

          <Animated.View
            style={{
              transform: [
                {
                  scale: scaleAnim,
                },
              ],
            }}
          >
            <View
              style={
                styles.statusCard
              }
            >
              <LinearGradient
                colors={[
                  '#ffffff',
                  '#f8fafc',
                ]}
                style={
                  styles.statusCardGradient
                }
              >
                <View
                  style={
                    styles.statusHeaderRow
                  }
                >
                  <View
                    style={
                      styles.statusHeaderLeft
                    }
                  >
                    <Ionicons
                      name="time-outline"
                      size={18}
                      color="#94a3b8"
                    />

                    <Text
                      style={
                        styles.cardTitle
                      }
                    >
                      TODAY'S ATTENDANCE
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor:
                          statusColor,
                      },
                    ]}
                  />
                </View>

                <Text
                  style={[
                    styles.statusMainText,
                    {
                      color:
                        statusColor,
                    },
                  ]}
                >
                  {todayStatus}
                </Text>

                {isLate && (
                  <View
                    style={
                      styles.lateBadge
                    }
                  >
                    <Ionicons
                      name="warning-outline"
                      size={14}
                      color="#dc2626"
                    />

                    <Text
                      style={
                        styles.lateBadgeText
                      }
                    >
                      Marked Late
                    </Text>
                  </View>
                )}

                <View
                  style={
                    styles.timeGrid
                  }
                >
                  {[
                    {
                      label:
                        'IN TIME',
                      value:
                        formatDisplayTime(
                          inTime
                        ),
                      icon:
                        'log-in-outline',
                    },

                    {
                      label:
                        'OUT TIME',
                      value:
                        formatDisplayTime(
                          outTime
                        ),
                      icon:
                        'log-out-outline',
                    },

                    {
                      label:
                        'HOURS WORKED',
                      value:
                        hoursWorked,
                      icon:
                        'hourglass-outline',
                    },
                  ].map(
                    (
                      item,
                      index
                    ) => (
                      <View
                        key={index}
                        style={
                          styles.timeBlock
                        }
                      >
                        <Ionicons
                          name={
                            item.icon as any
                          }
                          size={16}
                          color="#94a3b8"
                        />

                        <Text
                          style={
                            styles.timeLabel
                          }
                        >
                          {item.label}
                        </Text>

                        <Text
                          style={
                            styles.timeValue
                          }
                        >
                          {item.value}
                        </Text>
                      </View>
                    )
                  )}
                </View>
              </LinearGradient>
            </View>
          </Animated.View>

          {/* ==================================================
              LEAVE BALANCE
          ================================================== */}

          {remainingLeave !== null && (
            <View
              style={
                styles.remainingLeaveRow
              }
            >
              <View
                style={
                  styles.remainingLeaveIcon
                }
              >
                <Ionicons
                  name="leaf-outline"
                  size={17}
                  color="#059669"
                />
              </View>

              <View
                style={
                  styles.remainingLeaveContent
                }
              >
                <Text
                  style={
                    styles.remainingLeaveLabel
                  }
                >
                  Remaining leave
                </Text>

                <Text
                  style={
                    styles.remainingLeaveHint
                  }
                >
                  Available from your
                  current balance
                </Text>
              </View>

              <Text
                style={
                  styles.remainingLeaveValue
                }
              >
                {remainingLeave}
              </Text>
            </View>
          )}

          {/* ==================================================
              SHIFT CARD
          ================================================== */}

          <Animated.View
            style={{
              transform: [
                {
                  scale: scaleAnim,
                },
              ],
            }}
          >
            <LinearGradient
              colors={[
                '#1e293b',
                '#0f172a',
              ]}
              style={
                styles.shiftCard
              }
            >
              <View
                style={
                  styles.shiftHeader
                }
              >
                <Ionicons
                  name="briefcase-outline"
                  size={20}
                  color="#94a3b8"
                />

                <Text
                  style={
                    styles.shiftCardTitle
                  }
                >
                  CURRENT SHIFT
                </Text>
              </View>

              <Text
                style={
                  styles.shiftName
                }
              >
                {shiftName}
              </Text>

              {(shiftStart ||
                shiftEnd) && (
                <View
                  style={
                    styles.shiftTimeContainer
                  }
                >
                  <View
                    style={
                      styles.shiftTimeItem
                    }
                  >
                    <Ionicons
                      name="time-outline"
                      size={14}
                      color="#94a3b8"
                    />

                    <Text
                      style={
                        styles.shiftTimeLabel
                      }
                    >
                      Start
                    </Text>

                    <Text
                      style={
                        styles.shiftTimeValue
                      }
                    >
                      {shiftStart
                        ? formatDisplayTime(
                            shiftStart
                          )
                        : '--:--'}
                    </Text>
                  </View>

                  <View
                    style={
                      styles.shiftTimeDivider
                    }
                  />

                  <View
                    style={
                      styles.shiftTimeItem
                    }
                  >
                    <Ionicons
                      name="time-outline"
                      size={14}
                      color="#94a3b8"
                    />

                    <Text
                      style={
                        styles.shiftTimeLabel
                      }
                    >
                      End
                    </Text>

                    <Text
                      style={
                        styles.shiftTimeValue
                      }
                    >
                      {shiftEnd
                        ? formatDisplayTime(
                            shiftEnd
                          )
                        : '--:--'}
                    </Text>
                  </View>
                </View>
              )}

              {isEarlyGoing && (
                <View
                  style={
                    styles.earlyGoingWarning
                  }
                >
                  <Ionicons
                    name={
                      hasApprovedEarlyGoing
                        ? 'checkmark-circle-outline'
                        : 'warning-outline'
                    }
                    size={16}
                    color={
                      hasApprovedEarlyGoing
                        ? '#34d399'
                        : '#f59e0b'
                    }
                  />

                  <Text
                    style={
                      styles.earlyGoingWarningText
                    }
                  >
                    {hasApprovedEarlyGoing
                      ? 'Early going approved by HR. You can check out now.'
                      : 'You are about to leave before shift end. An HR-approved Early Going request is required to check out.'}
                  </Text>
                </View>
              )}
            </LinearGradient>
          </Animated.View>

          {/* ==================================================
              PERMISSION RETURN CARD
              ------------------------------------------------
              Visible ONLY while the backend reports
              `statistics.permission.active === true`. When
              the employee has returned (backend reports
              `active: false`), the card is hidden — on this
              render and on every future app load — because
              the value comes straight from the server.
          ================================================== */}

          {isCheckedIn &&
            !isCheckedOut &&
            permissionInProgress && (
              <Animated.View
                style={{
                  opacity: fadeAnim,
                  transform: [
                    { translateY: slideAnim },
                    { scale: scaleAnim },
                  ],
                }}
              >
                <View style={styles.permissionCard}>
                  <View style={styles.permissionHeader}>
                    <View style={styles.permissionHeaderLeft}>
                      <View style={styles.permissionIcon}>
                        <Ionicons
                          name="document-text-outline"
                          size={22}
                          color="#7c3aed"
                        />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.permissionTitle}>
                          Permission
                        </Text>

                        <Text style={styles.permissionSubtitle}>
                          Record your permission return
                        </Text>
                      </View>
                    </View>

                    {lunchStatusLoading && (
                      <ActivityIndicator
                        size="small"
                        color="#7c3aed"
                      />
                    )}
                  </View>

                  <View style={styles.permissionActiveBanner}>
                    <Ionicons
                      name="exit-outline"
                      size={18}
                      color="#6d28d9"
                    />

                    <Text style={styles.permissionActiveText}>
                      You are currently out on approved permission
                    </Text>
                  </View>

                  <View style={styles.permissionTimes}>
                    <View style={styles.permissionTimeItem}>
                      <View style={styles.permissionTimeIcon}>
                        <Ionicons
                          name="exit-outline"
                          size={18}
                          color="#7c3aed"
                        />
                      </View>

                      <View>
                        <Text style={styles.permissionTimeLabel}>
                          EXIT TIME
                        </Text>

                        <Text style={styles.permissionTimeValue}>
                          {permissionMovement.approvedFrom
                            ? formatDisplayTime(
                                permissionMovement.approvedFrom
                              )
                            : '--:--'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.permissionTimeDivider} />

                    <View style={styles.permissionTimeItem}>
                      <View style={styles.permissionTimeIcon}>
                        <Ionicons
                          name="time-outline"
                          size={18}
                          color="#059669"
                        />
                      </View>

                      <View>
                        <Text style={styles.permissionTimeLabel}>
                          APPROVED UNTIL
                        </Text>

                        <Text style={styles.permissionTimeValue}>
                          {permissionMovement.approvedTo
                            ? formatDisplayTime(
                                permissionMovement.approvedTo
                              )
                            : '--:--'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {permissionMovement.reason && (
                    <View style={styles.permissionReasonRow}>
                      <Ionicons
                        name="information-circle-outline"
                        size={17}
                        color="#64748b"
                      />

                      <Text style={styles.permissionReasonText}>
                        {permissionMovement.reason}
                      </Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.permissionReturnButton}
                    onPress={handlePermissionReturn}
                    disabled={permissionLoading}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={['#10b981', '#059669']}
                      style={styles.permissionButtonGradient}
                    >
                      {permissionLoading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Ionicons
                            name="return-down-back-outline"
                            size={21}
                            color="#fff"
                          />

                          <Text style={styles.permissionButtonText}>
                            Return From Permission
                          </Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            )}

          {/* ==================================================
              LUNCH BREAK CARD
          ================================================== */}

          {isCheckedIn &&
            !isCheckedOut && (
              <Animated.View
                style={{
                  opacity: fadeAnim,
                  transform: [
                    {
                      translateY:
                        slideAnim,
                    },
                    {
                      scale: scaleAnim,
                    },
                  ],
                }}
              >
                <View
                  style={
                    styles.lunchCard
                  }
                >
                  {/* HEADER */}

                  <View
                    style={
                      styles.lunchHeader
                    }
                  >
                    <View
                      style={
                        styles.lunchHeaderLeft
                      }
                    >
                      <View
                        style={
                          styles.lunchIcon
                        }
                      >
                        <Ionicons
                          name="restaurant-outline"
                          size={22}
                          color="#d97706"
                        />
                      </View>

                      <View>
                        <Text
                          style={
                            styles.lunchTitle
                          }
                        >
                          Lunch Break
                        </Text>

                        <Text
                          style={
                            styles.lunchSubtitle
                          }
                        >
                          Record your lunch
                          exit and return
                        </Text>
                      </View>
                    </View>

                    {lunchStatusLoading && (
                      <ActivityIndicator
                        size="small"
                        color="#d97706"
                      />
                    )}
                  </View>

                  {/* STATUS */}

                  {lunchInProgress && (
                    <View
                      style={
                        styles.lunchActiveBanner
                      }
                    >
                      <Ionicons
                        name="restaurant-outline"
                        size={18}
                        color="#b45309"
                      />

                      <Text
                        style={
                          styles.lunchActiveText
                        }
                      >
                        You are currently on
                        lunch break
                      </Text>
                    </View>
                  )}

                  {/* LATE LUNCH */}

                  {lunchLate &&
                    lunchInProgress && (
                      <View
                        style={
                          styles.lunchLateBanner
                        }
                      >
                        <Ionicons
                          name="warning-outline"
                          size={17}
                          color="#dc2626"
                        />

                        <Text
                          style={
                            styles.lunchLateText
                          }
                        >
                          Lunch exceeded the
                          allowed time by{' '}
                          {lunchLateMinutes}{' '}
                          minute
                          {lunchLateMinutes ===
                          1
                            ? ''
                            : 's'}
                          .
                        </Text>
                      </View>
                    )}

                  {/* LUNCH TIMES */}

                  <View
                    style={
                      styles.lunchTimes
                    }
                  >
                    <View
                      style={
                        styles.lunchTimeItem
                      }
                    >
                      <View
                        style={
                          styles.lunchTimeIcon
                        }
                      >
                        <Ionicons
                          name="exit-outline"
                          size={18}
                          color="#ea580c"
                        />
                      </View>

                      <View>
                        <Text
                          style={
                            styles.lunchTimeLabel
                          }
                        >
                          EXIT TIME
                        </Text>

                        <Text
                          style={
                            styles.lunchTimeValue
                          }
                        >
                          {lunchExitTime
                            ? formatDisplayTime(
                                lunchExitTime
                              )
                            : '--:--'}
                        </Text>
                      </View>
                    </View>

                    <View
                      style={
                        styles.lunchTimeDivider
                      }
                    />

                    <View
                      style={
                        styles.lunchTimeItem
                      }
                    >
                      <View
                        style={
                          styles.lunchTimeIcon
                        }
                      >
                        <Ionicons
                          name="return-down-back-outline"
                          size={18}
                          color="#059669"
                        />
                      </View>

                      <View>
                        <Text
                          style={
                            styles.lunchTimeLabel
                          }
                        >
                          RETURN TIME
                        </Text>

                        <Text
                          style={
                            styles.lunchTimeValue
                          }
                        >
                          {lunchReturnTime
                            ? formatDisplayTime(
                                lunchReturnTime
                              )
                            : '--:--'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* ALLOWED TIME */}

                  {lunchTaken && (
                    <View
                      style={
                        styles.lunchAllowedRow
                      }
                    >
                      <Ionicons
                        name="timer-outline"
                        size={17}
                        color="#2563eb"
                      />

                      <Text
                        style={
                          styles.lunchAllowedLabel
                        }
                      >
                        Allowed lunch
                      </Text>

                      <Text
                        style={
                          styles.lunchAllowedValue
                        }
                      >
                        {lunchAllowedMinutes}{' '}
                        min
                      </Text>
                    </View>
                  )}

                  {/* DURATION */}

                  {lunchCompleted && (
                    <View
                      style={
                        styles.lunchDurationRow
                      }
                    >
                      <Ionicons
                        name="timer-outline"
                        size={18}
                        color="#7c3aed"
                      />

                      <Text
                        style={
                          styles.lunchDurationLabel
                        }
                      >
                        Lunch Duration
                      </Text>

                      <Text
                        style={
                          styles.lunchDurationValue
                        }
                      >
                        {lunchDuration ||
                          calculateLunchDuration(
                            lunchExitTime,
                            lunchReturnTime
                          )}
                      </Text>
                    </View>
                  )}

                  {/* EXIT BUTTON */}

                  {!lunchTaken &&
                    !lunchExitTime && (
                      <TouchableOpacity
                        style={
                          styles.lunchExitButton
                        }
                        onPress={
                          handleLunchExit
                        }
                        disabled={
                          lunchLoading
                        }
                        activeOpacity={0.85}
                      >
                        <LinearGradient
                          colors={[
                            '#f59e0b',
                            '#d97706',
                          ]}
                          style={
                            styles.lunchButtonGradient
                          }
                        >
                          {lunchLoading ? (
                            <ActivityIndicator
                              color="#fff"
                            />
                          ) : (
                            <>
                              <Ionicons
                                name="restaurant-outline"
                                size={21}
                                color="#fff"
                              />

                              <Text
                                style={
                                  styles.lunchButtonText
                                }
                              >
                                Exit for Lunch
                              </Text>
                            </>
                          )}
                        </LinearGradient>
                      </TouchableOpacity>
                    )}

                  {/* RETURN BUTTON */}

                  {lunchInProgress && (
                    <TouchableOpacity
                      style={
                        styles.lunchReturnButton
                      }
                      onPress={
                        handleLunchReturn
                      }
                      disabled={
                        lunchLoading
                      }
                      activeOpacity={0.85}
                    >
                      <LinearGradient
                        colors={[
                          '#10b981',
                          '#059669',
                        ]}
                        style={
                          styles.lunchButtonGradient
                        }
                      >
                        {lunchLoading ? (
                          <ActivityIndicator
                            color="#fff"
                          />
                        ) : (
                          <>
                            <Ionicons
                              name="return-down-back-outline"
                              size={21}
                              color="#fff"
                            />

                            <Text
                              style={
                                styles.lunchButtonText
                              }
                            >
                              Return From Lunch
                            </Text>
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  )}

                  {/* COMPLETED */}

                  {lunchCompleted && (
                    <View
                      style={
                        styles.lunchCompletedBanner
                      }
                    >
                      <Ionicons
                        name="checkmark-circle"
                        size={22}
                        color="#059669"
                      />

                      <View
                        style={
                          styles.lunchCompletedContent
                        }
                      >
                        <Text
                          style={
                            styles.lunchCompletedTitle
                          }
                        >
                          Lunch Completed
                        </Text>

                        <Text
                          style={
                            styles.lunchCompletedSubtitle
                          }
                        >
                          Your lunch exit and
                          return times have been
                          recorded.
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              </Animated.View>
            )}

          {/* ==================================================
              ATTENDANCE ACTION
          ================================================== */}

          <Animated.View
            style={{
              transform: [
                {
                  scale: scaleAnim,
                },
              ],
            }}
          >
            <View
              style={
                styles.attendanceActions
              }
            >
              {!isCheckedIn ? (
                <TouchableOpacity
                  style={
                    styles.checkInBtn
                  }
                  onPress={() => {
                    Haptics.impactAsync(
                      Haptics.ImpactFeedbackStyle.Medium
                    );

                    setHolidayPrompt(
                      null
                    );

                    setGpsWindowClosed(
                      null
                    );

                    setShowCheckInModal(
                      true
                    );
                  }}
                  disabled={
                    checkInMutation.isPending
                  }
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={[
                      '#3b82f6',
                      '#2563eb',
                    ]}
                    style={
                      styles.actionBtnGradient
                    }
                  >
                    <Ionicons
                      name="log-in-outline"
                      size={22}
                      color="#fff"
                    />

                    <Text
                      style={
                        styles.actionBtnText
                      }
                    >
                      Check In
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              ) : !isCheckedOut ? (
                <TouchableOpacity
                  style={
                    styles.checkOutBtn
                  }
                  onPress={
                    handleCheckOutButtonPress
                  }
                  disabled={
                    checkOutMutation.isPending
                  }
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={[
                      isEarlyGoing
                        ? '#f59e0b'
                        : '#ef4444',

                      isEarlyGoing
                        ? '#d97706'
                        : '#dc2626',
                    ]}
                    style={
                      styles.actionBtnGradient
                    }
                  >
                    <Ionicons
                      name={
                        isEarlyGoing &&
                        !hasApprovedEarlyGoing
                          ? 'document-text-outline'
                          : 'log-out-outline'
                      }
                      size={22}
                      color="#fff"
                    />

                    <Text
                      style={
                        styles.actionBtnText
                      }
                    >
                      {checkOutMutation.isPending
                        ? 'Processing...'
                        : isEarlyGoing &&
                          !hasApprovedEarlyGoing
                        ? 'Request Early Going'
                        : isEarlyGoing
                        ? 'Check Out (Early)'
                        : 'Check Out'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                <View
                  style={
                    styles.completedCard
                  }
                >
                  <LinearGradient
                    colors={[
                      '#d1fae5',
                      '#a7f3d0',
                    ]}
                    style={
                      styles.completedCardGradient
                    }
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color="#059669"
                    />

                    <Text
                      style={
                        styles.completedText
                      }
                    >
                      Attendance Completed
                    </Text>
                  </LinearGradient>
                </View>
              )}
            </View>
          </Animated.View>

          {/* ==================================================
              QUICK ACTIONS
          ================================================== */}

          <View
            style={
              styles.quickActionsGrid
            }
          >
            {[
              {
                icon:
                  'create-outline',
                title:
                  'New Request',
                subtitle:
                  'Report exception',
                route:
                  '/(employee)/(tabs)/requests?tab=new',
                gradient: [
                  '#3b82f6',
                  '#2563eb',
                ],
              },

              {
                icon:
                  'document-text-outline',
                title:
                  'Pending',
                subtitle:
                  `${pendingRequests} awaiting review`,
                route:
                  '/(employee)/(tabs)/requests?tab=my',
                gradient: [
                  '#f59e0b',
                  '#d97706',
                ],
              },

              {
                icon:
                  'calendar-outline',
                title:
                  'History',
                subtitle:
                  'View records',
                route:
                  '/(employee)/(tabs)/attendance',
                gradient: [
                  '#8b5cf6',
                  '#7c3aed',
                ],
              },

              {
                icon:
                  'person-outline',
                title:
                  'Profile',
                subtitle:
                  'Your details',
                route:
                  '/(employee)/profile',
                gradient: [
                  '#ec4899',
                  '#db2777',
                ],
              },
            ].map(
              (
                item,
                index
              ) => (
                <Animated.View
                  key={index}
                  style={{
                    opacity:
                      fadeAnim,

                    transform: [
                      {
                        translateY:
                          slideAnim,
                      },
                    ],
                  }}
                >
                  <TouchableOpacity
                    style={
                      styles.actionCard
                    }
                    onPress={() => {
                      Haptics.impactAsync(
                        Haptics.ImpactFeedbackStyle.Light
                      );

                      router.push(
                        item.route as any
                      );
                    }}
                    activeOpacity={0.7}
                  >
                    <LinearGradient
                      colors={
                        item.gradient as any
                      }
                      style={
                        styles.actionIconGradient
                      }
                    >
                      <Ionicons
                        name={
                          item.icon as any
                        }
                        size={24}
                        color="#fff"
                      />
                    </LinearGradient>

                    <Text
                      style={
                        styles.actionTitle
                      }
                    >
                      {item.title}
                    </Text>

                    <Text
                      style={
                        styles.actionSubtitle
                      }
                    >
                      {item.subtitle}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              )
            )}
          </View>

          <View
            style={styles.footer}
          >
            <Text
              style={
                styles.footerText
              }
            >
              v1.0.0 • Attendance
              Management
            </Text>
          </View>
        </Animated.View>
      </ScrollView>

      {/* ======================================================
          CHECK IN MODAL
      ====================================================== */}

      <Modal
        visible={
          showCheckInModal
        }
        transparent
        animationType="slide"
        onRequestClose={
          closeCheckInModal
        }
      >
        <BlurView
          intensity={80}
          tint="dark"
          style={
            styles.modalOverlay
          }
        >
          <Animated.View
            style={[
              styles.modalContent,
              {
                transform: [
                  {
                    scale:
                      scaleAnim,
                  },
                ],
              },
            ]}
          >
            <View
              style={
                styles.modalHeader
              }
            >
              <View>
                <Text
                  style={
                    styles.modalTitle
                  }
                >
                  Check In
                </Text>

                <Text
                  style={
                    styles.modalSubtitle
                  }
                >
                  Mark your attendance
                </Text>
              </View>

              <TouchableOpacity
                onPress={
                  closeCheckInModal
                }
                style={
                  styles.modalCloseBtn
                }
              >
                <Ionicons
                  name="close"
                  size={24}
                  color="#64748b"
                />
              </TouchableOpacity>
            </View>

            <View
              style={
                styles.locationStatus
              }
            >
              <Ionicons
                name={
                  location
                    ? 'location'
                    : 'location-outline'
                }
                size={20}
                color={
                  location
                    ? '#10b981'
                    : '#ef4444'
                }
              />

              <Text
                style={
                  styles.locationStatusText
                }
              >
                {loadingLocation
                  ? 'Getting location...'
                  : location
                  ? 'Location available'
                  : 'Location not available'}
              </Text>

              <TouchableOpacity
                onPress={
                  getLocation
                }
                style={
                  styles.refreshLocationBtn
                }
              >
                <Ionicons
                  name="refresh-outline"
                  size={18}
                  color="#3b82f6"
                />
              </TouchableOpacity>
            </View>

            <View
              style={
                styles.workoffInfoBanner
              }
            >
              <Ionicons
                name="sunny-outline"
                size={17}
                color="#d97706"
              />

              <Text
                style={
                  styles.workoffInfoText
                }
              >
                Working on a holiday?
                Submit your check-in
                first. You will then be
                asked to confirm it as
                work-off attendance.
              </Text>
            </View>

            <TextInput
              style={
                styles.modalInput
              }
              placeholder="Reason for check-in *"
              placeholderTextColor="#94a3b8"
              value={reason}
              onChangeText={
                setReason
              }
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            {holidayPrompt && (
              <View
                style={
                  styles.holidayPrompt
                }
              >
                <View
                  style={
                    styles.holidayPromptHeader
                  }
                >
                  <Ionicons
                    name="sunny-outline"
                    size={20}
                    color="#d97706"
                  />

                  <Text
                    style={
                      styles.holidayPromptTitle
                    }
                  >
                    Today is a holiday
                  </Text>
                </View>

                <Text
                  style={
                    styles.holidayPromptText
                  }
                >
                  {holidayPrompt.name} ·{' '}
                  {holidayPrompt.date}
                </Text>

                <Text
                  style={
                    styles.holidayPromptHint
                  }
                >
                  Attendance can be
                  recorded as work-off only
                  after you confirm.
                </Text>

                <View
                  style={
                    styles.holidayPromptActions
                  }
                >
                  <TouchableOpacity
                    style={
                      styles.holidayCancelButton
                    }
                    onPress={() =>
                      setHolidayPrompt(
                        null
                      )
                    }
                  >
                    <Text
                      style={
                        styles.holidayCancelText
                      }
                    >
                      Cancel
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={
                      styles.holidayConfirmButton
                    }
                    onPress={
                      handleConfirmWorkoff
                    }
                    disabled={
                      checkInMutation.isPending
                    }
                  >
                    {checkInMutation.isPending ? (
                      <ActivityIndicator
                        color="#ffffff"
                        size="small"
                      />
                    ) : (
                      <Text
                        style={
                          styles.holidayConfirmText
                        }
                      >
                        Confirm work-off
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {gpsWindowClosed && (
              <View
                style={
                  styles.gpsWindowClosed
                }
              >
                <View
                  style={
                    styles.gpsWindowClosedHeader
                  }
                >
                  <Ionicons
                    name="time-outline"
                    size={20}
                    color="#b91c1c"
                  />

                  <Text
                    style={
                      styles.gpsWindowClosedTitle
                    }
                  >
                    Check-in window
                    closed
                  </Text>
                </View>

                <Text
                  style={
                    styles.gpsWindowClosedMessage
                  }
                >
                  {gpsWindowClosed.message}
                </Text>

                <View
                  style={
                    styles.gpsWindowClosedActions
                  }
                >
                  <TouchableOpacity
                    style={
                      styles.gpsWindowClosedDismiss
                    }
                    onPress={
                      closeCheckInModal
                    }
                  >
                    <Text
                      style={
                        styles.gpsWindowClosedDismissText
                      }
                    >
                      Close
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={
                      styles.gpsWindowClosedRequest
                    }
                    onPress={() => {
                      closeCheckInModal();

                      router.push(
                        '/(employee)/(tabs)/requests?tab=new&type=LATE_ARRIVAL' as any
                      );
                    }}
                  >
                    <Text
                      style={
                        styles.gpsWindowClosedRequestText
                      }
                    >
                      Open request
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {!holidayPrompt &&
              !gpsWindowClosed && (
                <TouchableOpacity
                  style={[
                    styles.modalSubmitBtn,
                    (!location ||
                      !reason.trim() ||
                      checkInMutation.isPending) &&
                      styles.disabledBtn,
                  ]}
                  onPress={
                    handleCheckIn
                  }
                  disabled={
                    !location ||
                    !reason.trim() ||
                    checkInMutation.isPending
                  }
                >
                  <LinearGradient
                    colors={[
                      '#3b82f6',
                      '#2563eb',
                    ]}
                    style={
                      styles.modalSubmitGradient
                    }
                  >
                    {checkInMutation.isPending ? (
                      <ActivityIndicator
                        color="#fff"
                      />
                    ) : (
                      <>
                        <Ionicons
                          name="log-in-outline"
                          size={20}
                          color="#fff"
                        />

                        <Text
                          style={
                            styles.modalSubmitText
                          }
                        >
                          Check In
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              )}
          </Animated.View>
        </BlurView>
      </Modal>

      {/* ======================================================
          CHECK OUT MODAL
      ====================================================== */}

      <Modal
        visible={
          showCheckOutModal
        }
        transparent
        animationType="slide"
        onRequestClose={() =>
          setShowCheckOutModal(
            false
          )
        }
      >
        <BlurView
          intensity={80}
          tint="dark"
          style={
            styles.modalOverlay
          }
        >
          <Animated.View
            style={[
              styles.modalContent,
              {
                transform: [
                  {
                    scale:
                      scaleAnim,
                  },
                ],
              },
            ]}
          >
            <View
              style={
                styles.modalHeader
              }
            >
              <View>
                <Text
                  style={
                    styles.modalTitle
                  }
                >
                  Check Out
                </Text>

                <Text
                  style={
                    styles.modalSubtitle
                  }
                >
                  Complete your attendance
                </Text>
              </View>

              <TouchableOpacity
                onPress={() =>
                  setShowCheckOutModal(
                    false
                  )
                }
                style={
                  styles.modalCloseBtn
                }
              >
                <Ionicons
                  name="close"
                  size={24}
                  color="#64748b"
                />
              </TouchableOpacity>
            </View>

            <View
              style={
                styles.locationStatus
              }
            >
              <Ionicons
                name={
                  location
                    ? 'location'
                    : 'location-outline'
                }
                size={20}
                color={
                  location
                    ? '#10b981'
                    : '#ef4444'
                }
              />

              <Text
                style={
                  styles.locationStatusText
                }
              >
                {loadingLocation
                  ? 'Getting location...'
                  : location
                  ? 'Location available'
                  : 'Location not available'}
              </Text>

              <TouchableOpacity
                onPress={
                  getLocation
                }
                style={
                  styles.refreshLocationBtn
                }
              >
                <Ionicons
                  name="refresh-outline"
                  size={18}
                  color="#3b82f6"
                />
              </TouchableOpacity>
            </View>

            <TextInput
              style={
                styles.modalInput
              }
              placeholder="Today's Task *"
              placeholderTextColor="#94a3b8"
              value={task}
              onChangeText={
                setTask
              }
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            {isEarlyGoing &&
              hasApprovedEarlyGoing && (
                <View
                  style={
                    styles.earlyGoingApprovedBox
                  }
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color="#059669"
                  />

                  <Text
                    style={
                      styles.earlyGoingApprovedText
                    }
                  >
                    Early going approved by
                    HR — you're clear to
                    check out.
                  </Text>
                </View>
              )}

            {isEarlyGoing &&
              !hasApprovedEarlyGoing && (
                <View
                  style={
                    styles.earlyGoingWarningBox
                  }
                >
                  <Ionicons
                    name="warning-outline"
                    size={18}
                    color="#f59e0b"
                  />

                  <Text
                    style={
                      styles.earlyGoingWarningBoxText
                    }
                  >
                    You are checking out
                    before your shift end
                    time. An HR-approved
                    Early Going request is
                    required.
                  </Text>
                </View>
              )}

            {isEarlyGoing &&
              !hasApprovedEarlyGoing && (
                <TextInput
                  style={[
                    styles.modalInput,
                    styles.earlyGoingInput,
                  ]}
                  placeholder="Early Going Reason *"
                  placeholderTextColor="#ef4444"
                  value={
                    earlyGoingReason
                  }
                  onChangeText={
                    setEarlyGoingReason
                  }
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              )}

            <TextInput
              style={[
                styles.modalInput,
                !isEarlyGoing &&
                  styles.optionalInput,
              ]}
              placeholder={
                isEarlyGoing
                  ? 'Additional notes (optional)'
                  : 'Reason (optional)'
              }
              placeholderTextColor="#94a3b8"
              value={reason}
              onChangeText={
                setReason
              }
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[
                styles.modalSubmitBtn,
                (!location ||
                  !task.trim() ||
                  checkOutMutation.isPending ||
                  (isEarlyGoing &&
                    !hasApprovedEarlyGoing &&
                    !earlyGoingReason.trim())) &&
                  styles.disabledBtn,
              ]}
              onPress={
                handleCheckOut
              }
              disabled={
                !location ||
                !task.trim() ||
                checkOutMutation.isPending ||
                (isEarlyGoing &&
                  !hasApprovedEarlyGoing &&
                  !earlyGoingReason.trim())
              }
            >
              <LinearGradient
                colors={[
                  isEarlyGoing
                    ? '#f59e0b'
                    : '#ef4444',

                  isEarlyGoing
                    ? '#d97706'
                    : '#dc2626',
                ]}
                style={
                  styles.modalSubmitGradient
                }
              >
                {checkOutMutation.isPending ? (
                  <ActivityIndicator
                    color="#fff"
                  />
                ) : (
                  <>
                    <Ionicons
                      name="log-out-outline"
                      size={20}
                      color="#fff"
                    />

                    <Text
                      style={
                        styles.modalSubmitText
                      }
                    >
                      {isEarlyGoing
                        ? 'Check Out (Early Going)'
                        : 'Check Out'}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </BlurView>
      </Modal>

      <Toast />
    </View>
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

  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },

  loadingGradient: {
    padding: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    marginTop: 16,
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },

  /* ==========================================================
     HEADER
  ========================================================== */

  headerGradient: {
    paddingTop: 48,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },

  header: {
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },

  logo: {
    width: 40,
    height: 40,
    marginRight: 12,
    borderRadius: 8,
  },

  greetingContainer: {
    flex: 1,
  },

  dateText: {
    fontSize: 12,
    textTransform: 'uppercase',
    color: '#94a3b8',
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 2,
  },

  greeting: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },

  userName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },

  employeeCode: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
    marginTop: 2,
  },

  alertButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 3,
    position: 'relative',
  },

  alertBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 19,
    height: 19,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },

  alertBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },

  /* ==========================================================
     SCROLL
  ========================================================== */

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },

  errorText: {
    color: '#92400e',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },

  /* ==========================================================
     ATTENDANCE CARD
  ========================================================== */

  statusCard: {
    borderRadius: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    overflow: 'hidden',
    elevation: 8,
  },

  statusCardGradient: {
    padding: 24,
  },

  statusHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  statusHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  cardTitle: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '700',
    letterSpacing: 1,
  },

  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },

  statusMainText: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 4,
  },

  lateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#fee2e2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 16,
    gap: 4,
  },

  lateBadgeText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '700',
  },

  timeGrid: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginTop: 12,
    justifyContent: 'space-around',
  },

  timeBlock: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },

  timeLabel: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 2,
  },

  timeValue: {
    fontSize: 15,
    color: '#0f172a',
    fontWeight: '700',
    textAlign: 'center',
  },

  /* ==========================================================
     LEAVE
  ========================================================== */

  remainingLeaveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#d1fae5',
    borderRadius: 14,
    padding: 12,
    marginBottom: 20,
  },

  remainingLeaveIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },

  remainingLeaveContent: {
    flex: 1,
    marginLeft: 10,
  },

  remainingLeaveLabel: {
    color: '#065f46',
    fontSize: 13,
    fontWeight: '800',
  },

  remainingLeaveHint: {
    color: '#047857',
    fontSize: 11,
    marginTop: 2,
  },

  remainingLeaveValue: {
    color: '#059669',
    fontSize: 20,
    fontWeight: '800',
    marginLeft: 8,
  },

  /* ==========================================================
     SHIFT
  ========================================================== */

  shiftCard: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    elevation: 8,
    overflow: 'hidden',
  },

  shiftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },

  shiftCardTitle: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '700',
    letterSpacing: 1,
  },

  shiftName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 4,
  },

  shiftTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor:
      'rgba(255,255,255,0.1)',
  },

  shiftTimeItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  shiftTimeLabel: {
    fontSize: 11,
    color: '#94a3b8',
  },

  shiftTimeValue: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '700',
  },

  shiftTimeDivider: {
    width: 1,
    height: 20,
    backgroundColor:
      'rgba(255,255,255,0.1)',
    marginHorizontal: 12,
  },

  earlyGoingWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor:
      'rgba(245,158,11,0.15)',
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },

  earlyGoingWarningText: {
    flex: 1,
    fontSize: 12,
    color: '#fbbf24',
    fontWeight: '500',
  },

  /* ==========================================================
     PERMISSION RETURN
  ========================================================== */

  permissionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ddd6fe',
    elevation: 5,
  },

  permissionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },

  permissionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  permissionIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: '#f5f3ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  permissionTitle: {
    fontSize: 18,
    color: '#0f172a',
    fontWeight: '800',
  },

  permissionSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 3,
  },

  permissionActiveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f3ff',
    borderWidth: 1,
    borderColor: '#ddd6fe',
    borderRadius: 12,
    padding: 11,
    marginBottom: 12,
    gap: 8,
  },

  permissionActiveText: {
    flex: 1,
    color: '#5b21b6',
    fontSize: 13,
    fontWeight: '700',
  },

  permissionTimes: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#faf5ff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e9d5ff',
    marginBottom: 14,
  },

  permissionTimeItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },

  permissionTimeIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },

  permissionTimeLabel: {
    fontSize: 9,
    color: '#7e22ce',
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  permissionTimeValue: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '800',
    marginTop: 2,
  },

  permissionTimeDivider: {
    width: 1,
    height: 34,
    backgroundColor: '#e9d5ff',
    marginHorizontal: 10,
  },

  permissionReasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 10,
    marginBottom: 14,
    gap: 8,
  },

  permissionReasonText: {
    flex: 1,
    color: '#475569',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },

  permissionReturnButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },

  permissionButtonGradient: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 16,
  },

  permissionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },

  /* ==========================================================
     LUNCH
  ========================================================== */

  lunchCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#fed7aa',
    elevation: 5,
  },

  lunchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },

  lunchHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  lunchIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: '#fffbeb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  lunchTitle: {
    fontSize: 18,
    color: '#0f172a',
    fontWeight: '800',
  },

  lunchSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 3,
  },

  lunchTimes: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffaf0',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fed7aa',
    marginBottom: 14,
  },

  lunchTimeItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },

  lunchTimeIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },

  lunchTimeLabel: {
    fontSize: 9,
    color: '#a16207',
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  lunchTimeValue: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '800',
    marginTop: 2,
  },

  lunchTimeDivider: {
    width: 1,
    height: 34,
    backgroundColor: '#fed7aa',
    marginHorizontal: 10,
  },

  lunchAllowedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 12,
    gap: 8,
  },

  lunchAllowedLabel: {
    flex: 1,
    color: '#1d4ed8',
    fontSize: 12,
    fontWeight: '700',
  },

  lunchAllowedValue: {
    color: '#1e40af',
    fontSize: 13,
    fontWeight: '800',
  },

  lunchLateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    gap: 8,
  },

  lunchLateText: {
    flex: 1,
    color: '#b91c1c',
    fontSize: 12,
    fontWeight: '700',
  },

  lunchDurationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f3ff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
    gap: 8,
  },

  lunchDurationLabel: {
    flex: 1,
    color: '#6d28d9',
    fontSize: 12,
    fontWeight: '700',
  },

  lunchDurationValue: {
    color: '#5b21b6',
    fontSize: 15,
    fontWeight: '800',
  },

  lunchExitButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },

  lunchReturnButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },

  lunchButtonGradient: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 16,
  },

  lunchButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },

  lunchActiveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 12,
    padding: 11,
    marginBottom: 12,
    gap: 8,
  },

  lunchActiveText: {
    color: '#92400e',
    fontSize: 13,
    fontWeight: '700',
  },

  lunchCompletedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 14,
    padding: 13,
  },

  lunchCompletedContent: {
    flex: 1,
    marginLeft: 10,
  },

  lunchCompletedTitle: {
    color: '#065f46',
    fontSize: 14,
    fontWeight: '800',
  },

  lunchCompletedSubtitle: {
    color: '#047857',
    fontSize: 11,
    marginTop: 2,
  },

  /* ==========================================================
     ATTENDANCE BUTTONS
  ========================================================== */

  attendanceActions: {
    marginBottom: 20,
  },

  checkInBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 6,
  },

  checkOutBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 6,
  },

  actionBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },

  actionBtnText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },

  completedCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },

  completedCardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },

  completedText: {
    color: '#059669',
    fontSize: 16,
    fontWeight: '700',
  },

  /* ==========================================================
     QUICK ACTIONS
  ========================================================== */

  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },

  actionCard: {
    width: (width - 48) / 2,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    alignItems: 'center',
    elevation: 2,
  },

  actionIconGradient: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  actionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },

  actionSubtitle: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 2,
  },

  footer: {
    marginTop: 24,
    paddingVertical: 12,
    alignItems: 'center',
  },

  footerText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },

  /* ==========================================================
     MODALS
  ========================================================== */

  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    paddingBottom:
      Platform.OS === 'ios'
        ? 40
        : 24,
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },

  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
  },

  modalSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },

  modalCloseBtn: {
    padding: 4,
  },

  locationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },

  locationStatusText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '500',
  },

  refreshLocationBtn: {
    padding: 4,
  },

  workoffInfoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    gap: 8,
  },

  workoffInfoText: {
    flex: 1,
    color: '#92400e',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },

  modalInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0f172a',
    marginBottom: 12,
    minHeight: 48,
  },

  optionalInput: {
    minHeight: 42,
  },

  earlyGoingInput: {
    borderColor: '#fca5a5',
    backgroundColor: '#fef2f2',
  },

  modalSubmitBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 4,
  },

  disabledBtn: {
    opacity: 0.5,
  },

  modalSubmitGradient: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 18,
  },

  modalSubmitText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },

  holidayPrompt: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },

  holidayPromptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },

  holidayPromptTitle: {
    color: '#92400e',
    fontSize: 15,
    fontWeight: '800',
  },

  holidayPromptText: {
    color: '#78350f',
    fontSize: 13,
    fontWeight: '600',
  },

  holidayPromptHint: {
    color: '#92400e',
    fontSize: 12,
    marginTop: 5,
    lineHeight: 17,
  },

  holidayPromptActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
  },

  holidayCancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fde68a',
  },

  holidayCancelText: {
    color: '#92400e',
    fontSize: 13,
    fontWeight: '700',
  },

  holidayConfirmButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#d97706',
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },

  holidayConfirmText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },

  gpsWindowClosed: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },

  gpsWindowClosedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },

  gpsWindowClosedTitle: {
    color: '#991b1b',
    fontSize: 15,
    fontWeight: '800',
  },

  gpsWindowClosedMessage: {
    color: '#7f1d1d',
    fontSize: 13,
    lineHeight: 18,
  },

  gpsWindowClosedActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
  },

  gpsWindowClosedDismiss: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fecaca',
  },

  gpsWindowClosedDismissText: {
    color: '#991b1b',
    fontSize: 13,
    fontWeight: '700',
  },

  gpsWindowClosedRequest: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#dc2626',
  },

  gpsWindowClosedRequestText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },

  earlyGoingApprovedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    gap: 8,
  },

  earlyGoingApprovedText: {
    flex: 1,
    color: '#065f46',
    fontSize: 12,
    fontWeight: '700',
  },

  earlyGoingWarningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    gap: 8,
  },

  earlyGoingWarningBoxText: {
    flex: 1,
    color: '#92400e',
    fontSize: 12,
    fontWeight: '700',
  },
});