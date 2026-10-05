// api/axios.ts
import axios, { InternalAxiosRequestConfig, AxiosError } from 'axios';
import { useAuthStore } from '../store/authStore';
import { Platform } from 'react-native';

// For React Native development
const getBaseURL = () => {
  if (__DEV__) {
    if (Platform.OS === 'android') {
      return 'https://ircshrmbackend.stackenzo.com';
    }
    return 'https://ircshrmbackend.stackenzo.com';
  }
  return 'https://ircshrmbackend.stackenzo.com/';
};

export const api = axios.create({
  baseURL: getBaseURL(),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

export const legacyApi = api;

// Request interceptor
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().token;
    if (token && config.headers) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    if (__DEV__) {
      console.log(`📤 ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    if (__DEV__) {
      console.log(`📥 ${response.status} ${response.config.url}`);
    }
    return response;
  },
  (error: AxiosError) => {
    if (error.response) {
      const responseData = error.response.data as any;
      const isAttendancePolicyRejection =
        error.response.status === 403 &&
        String(responseData?.status ?? '').trim().toUpperCase() === 'GPS_WINDOW_CLOSED';
      const isEarlyGoingReasonRequired =
        error.response.status === 400 &&
        String(responseData?.status ?? '').trim().toUpperCase() ===
          'EARLY_GOING_REASON_REQUIRED';

      if (isAttendancePolicyRejection || isEarlyGoingReasonRequired) {
        console.warn('⚠️ Attendance policy response:', responseData);
      } else {
        console.error('❌ API Error:', error.response.status, responseData);
      }

      if (error.response.status === 401) {
        const data = error.response.data as any;
        if (!data?.message?.includes('verification')) {
          useAuthStore.getState().logout?.();
        }
      }
    } else if (error.request) {
      console.error('❌ Network Error:', error.request);
    } else {
      console.error('❌ Request Error:', error.message);
    }
    return Promise.reject(error);
  }
);

export function getApiErrorMessage(error: any): string {
  const data = error?.response?.data;
  const apiStatus = String(data?.status ?? '').trim().toUpperCase();

  if (apiStatus === 'GPS_WINDOW_CLOSED') {
    return typeof data?.message === 'string' && data.message.trim()
      ? data.message
      : 'The GPS attendance window has ended. Please contact HR.';
  }

  if (typeof data?.message === 'string' && data.message.trim()) return data.message;
  if (typeof data?.error === 'string' && data.error.trim()) return data.error;
  if (typeof data?.detail === 'string' && data.detail.trim()) return data.detail;
  if (Array.isArray(data?.errors)) {
    const messages = data.errors.map((item: any) => item?.message || item?.msg || String(item)).filter(Boolean);
    if (messages.length) return messages.join('\n');
  }
  if (typeof data?.errors === 'string' && data.errors.trim()) return data.errors;
  if (error?.code === 'ECONNABORTED' || /timeout/i.test(error?.message || '')) return 'Request timed out. Please try again.';
  if (error?.request && !error?.response) return 'Unable to connect to the server. Please check your internet connection.';
  return 'Something went wrong. Please try again.';
}

// Helper to unwrap response data
export function unwrap<T = any>(responseData: any): T {
  if (responseData && typeof responseData === 'object' && 'data' in responseData) {
    return responseData.data as T;
  }
  return responseData as T;
}

export function isSuccess(response: any): boolean {
  if (response && typeof response === 'object') {
    if ('success' in response) return response.success === true;
    if ('data' in response && response.data) return true;
  }
  return false;
}

// ============================================================
// ===== BASE API PATHS =====
// ============================================================
const HR_PREFIX = '/api/hr';
const FILL_PREFIX = '/api/fill';

// ============================================================
// ===== EMPLOYEE API =====
// ============================================================

export interface CreateEmployeePayload {
  employee_code: string;
  first_name: string;
  middle_name?: string | null;
  last_name?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
  email: string;
  mobile: string;
  department_id: number;
  designation_id: number;
  role_id: string;
  shift_id: number;
  employment_type?: string | null;
  joining_date?: string | null;
  salary?: number | null;
  password: string;
}

export interface CreateEmployeeResponse {
  employee_id: string;
  employee_code: string;
  email: string;
  embedding_got: boolean;
  verified: boolean;
  profile_completed: boolean;
}

export async function createEmployee(payload: CreateEmployeePayload) {
  const response = await api.post(`${HR_PREFIX}/createEmployee`, payload);
  return unwrap<CreateEmployeeResponse>(response.data);
}

export interface VerifyOTPPayload {
  email: string;
  otp: string;
}

export interface VerifyOTPResponse {
  employee_id: string;
  email: string;
  verified: boolean;
}

export async function verifyOTP(payload: VerifyOTPPayload) {
  const response = await api.put(`${HR_PREFIX}/verifyuserRegister`, payload);
  return unwrap<VerifyOTPResponse>(response.data);
}

export interface ResendOTPPayload {
  employee_id: string;
}

export async function resendOTP(payload: ResendOTPPayload) {
  const response = await api.post(`${HR_PREFIX}/resendEmployeeOTP`, payload);
  return unwrap(response.data);
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  user_id: string;
  employee_id: string;
  employee_code: string;
  first_name: string;
  middle_name: string | null;
  last_name: string | null;
  email: string;
  mobile: string;
  role: string;
  department: string;
  designation: string;
  shift: {
    id: number;
    name: string;
    start_time: string;
    end_time: string;
  };
  embedding_got: boolean;
  verified: boolean;
  profile_completed: boolean;
}


export interface RegisterPushTokenPayload {
  userId: string | number | undefined;
  pushToken: string;
  platform: string;
}

export async function registerPushToken(
  payload: RegisterPushTokenPayload
) {
  const response = await api.post(
    '/notifications/register-token',
    payload
  );

  return response.data;
}


export async function login(payload: LoginPayload) {
  const response = await api.post(`${HR_PREFIX}/userLogin`, payload);
  return {
    token: response.data.Logintoken,
    data: response.data.data as LoginResponse,
    message: response.data.message,
  };
}

// ============================================================
// ===== MASTER DATA =====
// ============================================================

export interface Department {
  id: number;
  name: string;
  description: string;
  status: boolean;
}

export interface Designation {
  id: number;
  name: string;
  description: string;
  status: boolean;
}

export interface Role {
  id: string;
  role_name: string;
  description: string;
  status: boolean;
}

export interface Shift {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
  status: boolean;
}

export interface MasterData {
  departments: Department[];
  designations: Designation[];
  roles: Role[];
  shifts: Shift[];
}

export async function getMasterData() {
  const response = await api.get(`${FILL_PREFIX}/get/master`);
  return unwrap<MasterData>(response.data);
}

export interface AddMasterPayload {
  type: 'department' | 'designation' | 'role';
  name: string;
  description?: string;
}

export async function addMasterData(payload: AddMasterPayload) {
  const response = await api.post(`${FILL_PREFIX}/add/master`, payload);
  return unwrap(response.data);
}

export interface DeleteMasterPayload {
  type: 'department' | 'designation' | 'role';
  id: number | string;
}

export async function deleteMasterData(payload: DeleteMasterPayload) {
  const response = await api.delete(`${FILL_PREFIX}/delete/master`, { data: payload });
  return unwrap(response.data);
}

// ============================================================
// ===== EMPLOYEE MANAGEMENT =====
// ============================================================

export interface Employee {
  id: string;
  employee_code: string;
  first_name: string;
  middle_name: string | null;
  last_name: string | null;
  full_name: string;
  gender: string | null;
  date_of_birth: string | null;
  email: string;
  mobile: string;
  department_id: number;
  department: string;
  designation_id: number;
  designation: string;
  role_id: string;
  role: string;
  shift_id: number;
  shift: string;
  shift_start_time: string;
  shift_end_time: string;
  employment_type: string | null;
  joining_date: string | null;
  salary: number | null;
  status: boolean;
  embedding_got: boolean;
  verified: boolean;
  profile_completed: boolean;
  profile_photo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface GetEmployeesParams {
  employee_code?: string;
  name?: string;
  email?: string;
  mobile?: string;
  department_id?: number;
  designation_id?: number;
  role_id?: string;
  shift_id?: number;
  employment_type?: string;
  status?: boolean;
  verified?: boolean;
  embedding_got?: boolean;
  profile_completed?: boolean;
}

export async function getEmployees(params?: GetEmployeesParams) {
  const response = await api.get(`${HR_PREFIX}/employees`, { params });
  return {
    count: response.data.count,
    data: response.data.data as Employee[],
    message: response.data.message,
  };
}

export async function getEmployeeById(employeeId: string) {
  const { data } = await getEmployees();
  const employee = data.find((e) => e.id === employeeId);
  if (!employee) {
    throw new Error('Employee not found');
  }
  return employee;
}

export interface UpdateEmployeePayload {
  employee_code?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  gender?: string;
  date_of_birth?: string;
  mobile?: string;
  department_id?: number;
  designation_id?: number;
  role_id?: string;
  shift_id?: number;
  employment_type?: string;
  joining_date?: string;
  salary?: number;
}

export async function updateEmployee(employeeId: string, payload: UpdateEmployeePayload) {
  const response = await api.put(`${HR_PREFIX}/employees/${employeeId}`, payload);
  return unwrap<Employee>(response.data);
}

export async function deactivateEmployee(employeeId: string) {
  const response = await api.put(`${HR_PREFIX}/employees/${employeeId}/deactivate`);
  return unwrap(response.data);
}

// ============================================================
// ===== PROFILE (FIXED) =====
// ============================================================

export interface Profile {
  employee_id: string;
  employee_code: string;
  first_name: string;
  middle_name: string | null;
  last_name: string | null;
  name: string;
  email: string;
  mobile: string;
  role: string;
  department: string;
  designation: string;
  shift: {
    id: number | null;
    name: string | null;
    start_time: string | null;
    end_time: string | null;
  };
  embedding_got?: boolean;
  verified?: boolean;
  profile_completed?: boolean;
  profile_photo_url: string | null;
  status?: boolean;
  date_of_birth?: string | null;
  gender?: string | null;
  employment_type?: string | null;
  joining_date?: string | null;
  salary?: string | null;
  department_id?: string | number;
  designation_id?: string | number;
  role_id?: string;
  shift_id?: string | number;
  created_at?: string;
  updated_at?: string;
}

export async function getProfile() {
  const { user } = useAuthStore.getState();

  if (__DEV__) {
    console.log('🔍 getProfile - Auth Store User:', {
      employee_id: user?.employee_id,
      employee_code: user?.employee_code,
      user_id: user?.user_id,
      id: user?.id,
    });
  }

  if (!user) {
    console.error('❌ getProfile: No user in auth store');
    return null;
  }

  // Try fetching by employee_code first
  if (user?.employee_code) {
    try {
      if (__DEV__) {
        console.log(`📤 getProfile: Fetching employee by code: ${user.employee_code}`);
      }

      const response = await api.get(`${HR_PREFIX}/employees`, {
        params: { employee_code: user.employee_code },
      });

      if (__DEV__) {
        console.log('📥 getProfile response:', response.status, response.data?.count);
      }

      const row = response.data?.data?.[0];
      if (row) {
        if (__DEV__) {
          console.log('✅ getProfile: Employee found:', row.employee_code, row.full_name);
        }

        return {
          employee_id: row.id,
          employee_code: row.employee_code,
          first_name: row.first_name,
          middle_name: row.middle_name,
          last_name: row.last_name,
          name: row.full_name,
          email: row.email,
          mobile: row.mobile,
          role: row.role,
          department: row.department,
          designation: row.designation,
          shift: {
            id: row.shift_id,
            name: row.shift,
            start_time: row.shift_start_time,
            end_time: row.shift_end_time,
          },
          embedding_got: row.embedding_got,
          verified: row.verified,
          profile_completed: row.profile_completed,
          profile_photo_url: row.profile_photo_url,
          status: row.status,
          date_of_birth: row.date_of_birth,
          gender: row.gender,
          employment_type: row.employment_type,
          joining_date: row.joining_date,
          salary: row.salary,
          department_id: row.department_id,
          designation_id: row.designation_id,
          role_id: row.role_id,
          shift_id: row.shift_id,
          created_at: row.created_at,
          updated_at: row.updated_at,
          id: row.id,
        } as Profile;
      }

      if (__DEV__) {
        console.warn('⚠️ getProfile: Empty data array returned');
      }
    } catch (e: any) {
      console.error('❌ getProfile: Fetch failed:', {
        status: e?.response?.status,
        message: e?.message,
      });
    }
  }

  // Fallback to JWT-decoded user
  if (__DEV__) {
    console.log('📝 getProfile: Using fallback JWT-decoded user');
  }

  return {
    employee_id: user?.employee_id,
    employee_code: user?.employee_code,
    first_name: (user?.first_name || user?.Name?.split(' ')?.[0]) ?? null,
    middle_name: user?.middle_name ?? null,
    last_name: user?.last_name ?? null,
    name: user?.Name || user?.name || 'Employee',
    email: user?.email,
    mobile: user?.mobile,
    role: user?.Role || user?.role,
    department: user?.departments || user?.department,
    designation: user?.designation,
    shift: {
      id: user?.shift?.id ?? null,
      name: user?.shift?.name ?? null,
      start_time: user?.shift?.start_time ?? null,
      end_time: user?.shift?.end_time ?? null,
    },
    embedding_got: user?.embedding_got,
    verified: user?.verified,
    profile_completed: user?.profile_completed,
    profile_photo_url: null,
    status: user?.status ?? true,
    date_of_birth: user?.date_of_birth ?? null,
    gender: user?.gender ?? null,
    employment_type: user?.employment_type ?? null,
    joining_date: user?.joining_date ?? null,
    salary: user?.salary ?? null,
    department_id: user?.department_id ?? null,
    designation_id: user?.designation_id ?? null,
    role_id: user?.role_id ?? null,
    shift_id: user?.shift_id ?? null,
    created_at: user?.created_at ?? null,
    updated_at: user?.updated_at ?? null,
  } as Profile;
}

// ============================================================
// ===== ATTENDANCE CONTRACTS =====
// ============================================================

export type WorkoffBenefit = 'FULL_DAY' | 'HALF_DAY' | 'NO_WORKOFF_BENEFIT';
export type AttendanceImpact = WorkoffBenefit | string;

export interface LeaveBalance {
  opening_balance?: number | string | null;
  monthly_allocation?: number | string | null;
  leave_used?: number | string | null;
  closing_balance?: number | string | null;
  available_leave_balance?: number | string | null;
  remaining_after_approval?: number | string | null;
}

export interface EmployeeLeaveStatistics {
  applied?: number | string;
  approved?: number | string;
  rejected?: number | string;
  total_days_taken?: number | string;
  pending_days?: number | string;
  balance?: LeaveBalance | null;
}

export interface EmployeeStatusStatistics {
  leaves?: EmployeeLeaveStatistics;
  permissions?: {
    total_applied?: number | string;
    pending?: number | string;
    approved?: number | string;
    rejected?: number | string;
  };
  late_arrivals?: {
    total?: number | string;
    pending?: number | string;
    approved?: number | string;
    rejected?: number | string;
  };
  lunch?: EmployeeLunchStatistics;   // ← ADD THIS
  workoff?: WorkoffStatistics;       // (you're already reading this elsewhere, worth typing too)
  absent_days?: number | string;
}

export interface HolidayInfo {
  id: string | number;
  name: string;
  type?: string | null;
  date: string;
}

export interface EmployeeLunchStatistics {
  taken?: boolean;
  status?: 'OUT' | 'RETURNED' | string | null;
  exit_time?: string | null;
  return_time?: string | null;
  allowed_minutes?: number | string | null;
  late?: boolean;
  late_minutes?: number | string | null;
}

export interface EmployeeStatusStatistics {
  leaves?: EmployeeLeaveStatistics;
  permissions?: {
    total_applied?: number | string;
    pending?: number | string;
    approved?: number | string;
    rejected?: number | string;
  };
  late_arrivals?: {
    total?: number | string;
    pending?: number | string;
    approved?: number | string;
    rejected?: number | string;
  };
  lunch?: EmployeeLunchStatistics;   // ← ADD THIS
  workoff?: WorkoffStatistics;       // (you're already reading this elsewhere, worth typing too)
  absent_days?: number | string;
}

export interface WorkoffFields {
  workoff?: boolean | string | number | null;
  weekoff?: boolean | string | number | null;
  attendance_impact?: AttendanceImpact | null;
  attendance_impact_reason?: string | null;
  half_day?: boolean | string | number | null;
  half_day_minutes?: number | string | null;
}

export interface BackendAttendanceRow extends WorkoffFields {
  _id?: string;
  id?: string;
  emp_id?: string;
  attendance_date?: string | null;
  date?: string | null;
  In_Time?: string | null;
  in_time?: string | null;
  inTime?: string | null;
  In_Time_reason?: string | null;
  in_time_outside_reason?: string | null;
  In_time_outside?: boolean | string | number;
  in_time_outside?: boolean | string | number;
  In_time_approved?: boolean | string | number;
  in_time_outside_approved?: boolean | string | number;
  in_time_late?: boolean | string | number;
  delay_in_reason?: string | null;
  Out_time?: string | null;
  out_time?: string | null;
  outTime?: string | null;
  Out_time_reason?: string | null;
  out_time_outside_reason?: string | null;
  Out_time_outside?: boolean | string | number;
  out_time_outside?: boolean | string | number;
  Out_time_approved?: boolean | string | number;
  out_time_outside_approved?: boolean | string | number;
  total_hours?: string | null;
  total_hours_worked?: string | null;
  hours?: string | null;
  early_going?: boolean | string | number;
  early_going_reason?: string | null;
  todays_task?: string | null;
  Todays_Task?: string | null;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface EmployeeStatus {
  success: boolean;
  message: string;
  status?: string;
  attendance?: BackendAttendanceRow | null;
  data?: BackendAttendanceRow | null;
  statistics?: EmployeeStatusStatistics;
  holiday?: HolidayInfo | null;
  employee?: Record<string, any>;
  in_time?: string | null;
  out_time?: string | null;
  [key: string]: any;
}

export function isTruthyFlag(value: unknown): boolean {
  return value === true || value === 'true' || value === 't' || value === 1 || value === '1';
}

export function classifyWorkoff(row: WorkoffFields): {
  isWorkoff: boolean;
  status: 'Work-off' | 'Half-day Work-off' | null;
} {
  const impact = String(row.attendance_impact ?? '').trim().toUpperCase();
  const reason = String(row.attendance_impact_reason ?? '').trim().toUpperCase();
  const explicitlyWorkoff =
    isTruthyFlag(row.workoff) ||
    isTruthyFlag(row.weekoff) ||
    impact === 'WORKOFF' ||
    reason.startsWith('WORKOFF');

  if (!explicitlyWorkoff) {
    return { isWorkoff: false, status: null };
  }

  const isHalfDay = impact === 'HALF_DAY' || reason.includes('4_TO_6');
  return {
    isWorkoff: true,
    status: isHalfDay ? 'Half-day Work-off' : 'Work-off',
  };
}

export function toFiniteNumber(value: unknown, fallback: number | null = null): number | null {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getRemainingLeaveBalance(
  balance?: LeaveBalance | null,
  submittedRemaining?: unknown,
): number | null {
  const immediate = toFiniteNumber(submittedRemaining);
  if (immediate !== null) return immediate;

  return toFiniteNumber(
    balance?.closing_balance ??
      balance?.available_leave_balance ??
      balance?.remaining_after_approval,
  );
}

// ============================================================
// ===== GET EMPLOYEE STATUS (FIXED) =====
// ============================================================

export async function getEmployeeStatus(
  userId?: string
): Promise<EmployeeStatus> {
  const { user } = useAuthStore.getState();

  const requestedId = user?.user_id || user?.id || userId;

  if (!requestedId) {
    return {
      success: false,
      message: 'No authenticated user ID available.',
      status: 'USER_ID_MISSING',
      data: null,
    };
  }

  try {
    if (__DEV__) {
      console.log(
        `📤 GET ${HR_PREFIX}/get_emp_status?userId=${requestedId}`
      );
    }

    const response = await api.get(
      `${HR_PREFIX}/get_emp_status`,
      {
        params: {
          userId: String(requestedId),
        },
      }
    );

    if (__DEV__) {
      console.log(
        '📥',
        response.status,
        `${HR_PREFIX}/get_emp_status`
      );

      console.log(
        '✅ getEmployeeStatus:',
        JSON.stringify(response.data, null, 2)
      );
    }

    return response.data as EmployeeStatus;
  } catch (error: any) {
    console.error(
      '❌ getEmployeeStatus failed:',
      error?.response?.data || error?.message
    );

    throw error;
  }
}

// ============================================================
// ===== DASHBOARD & ATTENDANCE (FIXED) =====
// ============================================================

export interface DashboardData {
  todayStatus?: string;
  statusCode?: string;
  inTime?: string | null;
  outTime?: string | null;
  hoursWorked?: string;
  shift?: string;
  shiftStart?: string | null;
  shiftEnd?: string | null;
  lateStatus?: boolean | string;
  pendingRequests?: number;
  leaveBalance?: LeaveBalance | null;
  leaveStatistics?: EmployeeLeaveStatistics | null;
  holiday?: HolidayInfo | null;
  [key: string]: any;
}

export async function getDashboard(): Promise<DashboardData> {
  const { user } = useAuthStore.getState();

  if (__DEV__) {
    console.log('🔍 getDashboard: Starting with user:', {
      employee_id: user?.employee_id,
      employee_code: user?.employee_code,
      user_id: user?.user_id,
    });
  }

  const statusUserId = user?.user_id || user?.id;
  const employeeId = user?.employee_id || user?.id;

  if (!statusUserId || !employeeId) {
    if (__DEV__) {
      console.error('❌ getDashboard: Missing required IDs:', {
        statusUserId: !!statusUserId,
        employeeId: !!employeeId,
      });
    }
    return { pendingRequests: 0 };
  }

  const [statusResult, profileResult, pendingResult] = await Promise.allSettled([
    getEmployeeStatus(String(statusUserId)),
    getProfile(),
    getAttendanceRequests({ employeeId: String(employeeId), status: 'PENDING' }),
  ]);

  const status = statusResult.status === 'fulfilled' ? statusResult.value : null;
  const profile = profileResult.status === 'fulfilled' ? profileResult.value : null;
  const pending = pendingResult.status === 'fulfilled' ? pendingResult.value : null;

  // ✅ FIXED: GET /api/hr/get_emp_status nests today's attendance row under
  // `attendance` (e.g. status.attendance.in_time), NOT under `data` or at
  // the root. We check `attendance` first and keep the old paths only as
  // a fallback in case the backend response shape changes again.
  const check = status?.attendance ?? status?.data ?? null;

  if (__DEV__) {
    console.log('📥 getDashboard: Status Response:', {
      success: status?.success,
      message: status?.message,
      inTime: check?.in_time,
      outTime: check?.out_time,
    });
  }

  return {
    todayStatus: status?.message,
    statusCode: status?.status,
    inTime: check?.in_time ?? check?.In_Time ?? check?.inTime ?? null,
    outTime: check?.out_time ?? check?.Out_time ?? check?.outTime ?? null,
    hoursWorked: check?.total_hours_worked ?? check?.total_hours ?? '0h 0m',
    shift: profile?.shift?.name ?? undefined,
    shiftStart: profile?.shift?.start_time ?? null,
    shiftEnd: profile?.shift?.end_time ?? null,
    lateStatus: !!(check?.in_time_late || check?.delay_in_reason),
    pendingRequests: pending?.pagination?.total_records ?? 0,
    leaveBalance: status?.statistics?.leaves?.balance ?? null,
    leaveStatistics: status?.statistics?.leaves ?? null,
    holiday: status?.holiday ?? null,
  };
}

export interface TodayAttendance {
  inTime?: string | null;
  outTime?: string | null;
  late?: boolean;
  outside?: boolean;
  cctvIn?: string | null;
  cctvOut?: string | null;
  hoursWorked?: string;
  earlyGoing?: boolean;
  [key: string]: any;
}

export async function getTodayAttendance(): Promise<TodayAttendance> {
  const { user } = useAuthStore.getState();
  const statusUserId = user?.user_id || user?.id;

  if (!statusUserId) {
    if (__DEV__) {
      console.warn('⚠️ getTodayAttendance: No user_id in auth store');
    }
    return {};
  }

  try {
    if (__DEV__) {
      console.log('📤 getTodayAttendance: Fetching for:', statusUserId);
    }

    const status = await getEmployeeStatus(String(statusUserId));

    // ✅ FIXED: same nesting fix as getDashboard() above — the real row
    // lives under `status.attendance`, not `status.data` / root.
    const check = status?.attendance ?? status?.data ?? null;

    if (__DEV__) {
      console.log('📥 getTodayAttendance: Response -', {
        success: status?.success,
        inTime: check?.in_time,
        outTime: check?.out_time,
      });
    }

    return {
      inTime: check?.in_time ?? null,
      outTime: check?.out_time ?? null,
      late: !!check?.in_time_late,
      outside: !!(check?.in_time_outside || check?.out_time_outside),
      cctvIn: check?.cctv_in ?? null,
      cctvOut: check?.cctv_out ?? null,
      hoursWorked: check?.total_hours_worked ?? '0h 0m',
      earlyGoing: !!check?.early_going,
    };
  } catch (error) {
    if (__DEV__) {
      console.error('❌ getTodayAttendance: Failed -', error);
    }
    return {};
  }
}


// ============================================================
// ===== MANUAL / GPS ATTENDANCE MUTATIONS =====
// ============================================================

export interface ManualCheckInPayload {
  userId: string;
  lat: number;
  lng: number;
  time: string;
  reason?: string;
  workoff: boolean;
}

export interface ManualCheckInResponse {
  success: boolean;
  status?: string;
  message?: string;
  attendance?: BackendAttendanceRow | null;
  holiday?: HolidayInfo | null;
  [key: string]: any;
}

export interface ManualCheckOutPayload {
  userId: string;
  lat: number;
  lng: number;
  time: string;
  task: string;
  T_reason?: string;
  remarks?: string;
  early_going_reason?: string;
}

export interface ManualCheckOutResponse {
  success: boolean;
  status?: string;
  message?: string;
  attendance?: any;
  [key: string]: any;
}

export interface CCTVCheckInPayload {
  employee_id: string;
  camera_id: string;
  time: string;
}

export interface CCTVCheckOutPayload {
  employee_id: string;
  camera_id: string;
  time: string;
}

export function isHolidayCheckInResponse(error: unknown): boolean {
  const response = (error as any)?.response;
  const data = response?.data;
  return (
    response?.status === 400 &&
    data?.success === true &&
    String(data?.status).toLowerCase() === 'to day holiday'
  );
}

export interface AttendanceWindow {
  start?: string | null;
  end?: string | null;
}

export interface GpsWindowClosedDetails {
  status: string;
  message: string;
  detectionTime?: string | null;
  secondWindow?: AttendanceWindow | null;
  shift?:
    | (AttendanceWindow & {
        name?: string | null;
        grace_period_minutes?: number | null;
      })
    | null;
}

export function isGpsWindowClosedResponse(error: unknown): boolean {
  const response = (error as any)?.response;
  const data = response?.data;
  return (
    response?.status === 403 &&
    String(data?.status ?? '').trim().toUpperCase() === 'GPS_WINDOW_CLOSED'
  );
}

export function getGpsWindowClosedDetails(error: unknown): GpsWindowClosedDetails {
  const rawData = (error as any)?.response?.data;
  const data = rawData && typeof rawData === 'object' ? rawData : {};
  const rawSecondWindow = data.second_window;
  const rawShift = data.shift;

  return {
    status: String(data.status ?? 'GPS_WINDOW_CLOSED'),
    message:
      typeof data.message === 'string' && data.message.trim()
        ? data.message
        : 'The GPS attendance window has ended. Please contact HR.',
    detectionTime: typeof data.detection_time === 'string' ? data.detection_time : null,
    secondWindow:
      rawSecondWindow && typeof rawSecondWindow === 'object'
        ? {
            start: typeof rawSecondWindow.start === 'string' ? rawSecondWindow.start : null,
            end: typeof rawSecondWindow.end === 'string' ? rawSecondWindow.end : null,
          }
        : null,
    shift:
      rawShift && typeof rawShift === 'object'
        ? {
            name: typeof rawShift.name === 'string' ? rawShift.name : null,
            start: typeof rawShift.start === 'string' ? rawShift.start : null,
            end: typeof rawShift.end === 'string' ? rawShift.end : null,
            grace_period_minutes:
              typeof rawShift.grace_period_minutes === 'number'
                ? rawShift.grace_period_minutes
                : null,
          }
        : null,
  };
}

export interface TemporaryReturnPayload {
  userId: string;
  type: 'LUNCH' | 'PERMISSION' | 'permission' | 'WORKOFF';
  lat: number;
  lng: number;
  time: string;
}

export interface TemporaryReturnResponse {
  success: boolean;
  status: string;
  message: string;
  type: TemporaryReturnPayload['type'];
  attendance?: WorkoffFields & {
    attendance_id: string;
    attendance_date: string;
    in_time: string | null;
  };
  movement?: {
    movement_id: string;
    type: string;
    exit_time: string;
    return_time: string;
    total_minutes_away: number;
    duration: string;
    status: string;
  };
  [key: string]: any;
}

export async function manualCheckIn(
  payload: ManualCheckInPayload
): Promise<ManualCheckInResponse> {
  const employeeCode = getAttendanceEmployeeCode();

  const requestPayload = {
    ...payload,

    // IMPORTANT:
    // /in-time expects the employee identifier used by
    // the attendance backend. Use employee_code consistently
    // with manualCheckOut().
    userId: employeeCode,

    workoff: payload.workoff ?? false,
  };

  if (__DEV__) {
    console.log('🟢 Manual Check-In Request:', {
      endpoint: `${HR_PREFIX}/in-time`,
      originalUserId: payload.userId,
      employeeCode,
      lat: payload.lat,
      lng: payload.lng,
      time: payload.time,
      workoff: requestPayload.workoff,
      reason: payload.reason,
    });
  }

  const response = await api.post(
    `${HR_PREFIX}/in-time`,
    requestPayload
  );

  if (__DEV__) {
    console.log('🟢 Manual Check-In Response:', {
      status: response.status,
      data: response.data,
    });
  }

  return response.data as ManualCheckInResponse;
}

export async function manualCheckOut(
  payload: ManualCheckOutPayload
): Promise<ManualCheckOutResponse> {
  const employeeCode = getAttendanceEmployeeCode();

  const response = await api.post(`${HR_PREFIX}/out-time`, {
    ...payload,
    userId: employeeCode,
  });

  return response.data as ManualCheckOutResponse;
}

// export async function startLunchBreak(
//   payload: TemporaryReturnPayload
// ): Promise<TemporaryReturnResponse> {
//   const employeeCode = getAttendanceEmployeeCode();

//   const requestPayload = {
//     ...payload,

//     // Keep attendance identifier consistent
//     // with the manual check-in/check-out APIs.
//     userId: payload.userId || " ",

//     type: 'LUNCH' as const,
//   };

//   if (__DEV__) {
//     console.log('🍱 Lunch Exit Request:', {
//       endpoint: `${HR_PREFIX}/temporary-return`,
//       payload: requestPayload,
//     });
//   }

//   const response = await api.post(
//     `${HR_PREFIX}/temporary-return`,
//     requestPayload
//   );

//   if (__DEV__) {
//     console.log('🍱 Lunch Exit Response:', {
//       status: response.status,
//       data: response.data,
//     });
//   }

//   return response.data as TemporaryReturnResponse;
// }

// export async function recordTemporaryReturn(
//   payload: TemporaryReturnPayload,
// ): Promise<TemporaryReturnResponse> {
//   const response = await api.post(`${HR_PREFIX}/temporary-return`, payload);
//   return response.data as TemporaryReturnResponse;
// }

export async function cctvCheckIn(
  payload: CCTVCheckInPayload
) {
  const response = await api.post(`${HR_PREFIX}/in-timeCCTV`, payload);
  return response.data;
}

export async function cctvCheckOut(
  payload: CCTVCheckOutPayload
) {
  const response = await api.post(`${HR_PREFIX}/out-timeCCTV`, payload);
  return response.data;
}

// ============================================================
// ===== ATTENDANCE HISTORY (FIXED) =====
// ============================================================

export type HistoryRange = 'today' | 'week' | 'month' | 'all';

const HISTORY_RANGE_TO_FILTER: Record<HistoryRange, HistoryRange> = {
  'today': 'today',
  'week': 'week',
  'month': 'month',
  'all': 'all',
};

export interface AttendanceHistoryRow {
  id?: string;
  _id?: string;
  date: string;
  inTime: string | null;
  outTime: string | null;
  hours: string;
  status: 'Present' | 'Absent' | 'In Progress' | 'Completed' | 'Work-off' | 'Half-day Work-off';
  outside: boolean;
  late: boolean;
  approved: boolean;
  earlyGoing: boolean;
  task?: string | null;
  inTimeOutside: boolean;
  outTimeOutside: boolean;
  inTimeApproved: boolean;
  outTimeApproved: boolean;
  delayReason?: string | null;
  inTimeReason?: string | null;
  outTimeReason?: string | null;
  earlyGoingReason?: string | null;
  totalHours?: string | null;
  workoff?: boolean;
  weekoff?: boolean;
  attendanceImpact?: string | null;
  attendanceImpactReason?: string | null;
  halfDay?: boolean;
  halfDayMinutes?: number | string | null;
}

export interface GetAttendanceResponse {
  success: boolean;
  filter?: HistoryRange | string;
  filters: {
    filter: string;
    employeeId: string | null;
    employeeCode: string | null;
    date: string | null;
    fromDate: string | null;
    toDate: string | null;
  };
  pagination: {
    current_page: number;
    page_size: number;
    total_records: number;
    total_pages: number;
    returned_records: number;
    has_next_page?: boolean;
    has_previous_page?: boolean;
  };
  total_days: number;
  total_hours: string | null;
  avg_per_day: string | null;
  attendance: BackendAttendanceRow[];
}

export type AttendanceReport = GetAttendanceResponse;

export interface EmployeeAttendanceHistoryParams {
  userId: string;
  range?: HistoryRange;
}

// Employee attendance: /api/fill/getAttendance
export async function getAttendanceRaw(
  userId: string,
  filter: 'today' | 'week' | 'month' | 'all' = 'all'
) {
  // Employee attendance endpoint expects employees.id as `userId`.
  // Do not use getAttendanceAdmin here: that endpoint expects `employeeId`.
  if (__DEV__) {
    console.log(`📤 getAttendanceRaw: POST ${FILL_PREFIX}/getAttendance`, {
      userId,
      filter,
    });
  }

  const response = await api.post(`${FILL_PREFIX}/getAttendance`, {
    userId,
    filter,
  });

  if (__DEV__) {
    console.log('✅ getAttendanceRaw Response:', {
      success: response.data?.success,
      filter: response.data?.filter,
      totalDays: response.data?.total_days,
      attendanceCount: response.data?.attendance?.length,
    });
  }

  return response.data as GetAttendanceResponse;
}

function normalizeAttendanceHistoryRow(row: BackendAttendanceRow): AttendanceHistoryRow {
  const inTime = row.In_Time ?? row.in_time ?? row.inTime ?? null;
  const outTime = row.Out_time ?? row.out_time ?? row.outTime ?? null;
  const lateReason = row.delay_in_reason ?? null;
  const earlyGoing = isTruthyFlag(row.early_going) || Boolean(row.early_going_reason);
  const workoff = classifyWorkoff(row);
  const status = workoff.status ?? (outTime ? 'Completed' : inTime ? 'In Progress' : 'Absent');

  return {
    id: row._id || row.id,
    _id: row._id || row.id,
    date: row.date || row.attendance_date || '',
    inTime,
    outTime,
    hours: row.total_hours ?? row.total_hours_worked ?? row.hours ?? '--',
    status,
    outside:
      isTruthyFlag(row.In_time_outside ?? row.in_time_outside) ||
      isTruthyFlag(row.Out_time_outside ?? row.out_time_outside),
    late: isTruthyFlag(row.in_time_late) || Boolean(lateReason),
    approved:
      isTruthyFlag(row.In_time_approved ?? row.in_time_outside_approved) ||
      isTruthyFlag(row.Out_time_approved ?? row.out_time_outside_approved),
    earlyGoing,
    task: row.Todays_Task ?? row.todays_task ?? null,
    inTimeOutside: isTruthyFlag(row.In_time_outside ?? row.in_time_outside),
    outTimeOutside: isTruthyFlag(row.Out_time_outside ?? row.out_time_outside),
    inTimeApproved: isTruthyFlag(row.In_time_approved ?? row.in_time_outside_approved),
    outTimeApproved: isTruthyFlag(row.Out_time_approved ?? row.out_time_outside_approved),
    delayReason: lateReason,
    inTimeReason: row.In_time_reason ?? row.in_time_outside_reason ?? null,
    outTimeReason: row.Out_time_reason ?? row.out_time_outside_reason ?? null,
    earlyGoingReason: row.early_going_reason ?? null,
    totalHours: row.total_hours ?? row.total_hours_worked ?? null,
    workoff: workoff.isWorkoff,
    weekoff: isTruthyFlag(row.weekoff),
    attendanceImpact: row.attendance_impact ?? null,
    attendanceImpactReason: row.attendance_impact_reason ?? null,
    halfDay: isTruthyFlag(row.half_day),
    halfDayMinutes: row.half_day_minutes ?? null,
  };
}

function emptyAttendanceReport(range: HistoryRange): AttendanceReport {
  return {
    success: false,
    filter: range,
    filters: {
      filter: range,
      employeeId: null,
      employeeCode: null,
      date: null,
      fromDate: null,
      toDate: null,
    },
    pagination: {
      current_page: 1,
      page_size: 10,
      total_records: 0,
      total_pages: 0,
      returned_records: 0,
      has_next_page: false,
      has_previous_page: false,
    },
    total_days: 0,
    total_hours: '0h 0m',
    avg_per_day: '0h 0m',
    attendance: [],
  };
}

export async function getAttendanceReport(range: HistoryRange): Promise<AttendanceReport> {
  const { user } = useAuthStore.getState();
  const employeeId = user?.employee_id || user?.id;
  if (!employeeId) return emptyAttendanceReport(range);

  try {
    return await getAttendanceRaw(String(employeeId), HISTORY_RANGE_TO_FILTER[range]);
  } catch (e: any) {
    if (e?.response?.status === 404) return emptyAttendanceReport(range);
    throw e;
  }
}

export async function getAttendanceHistory(range: HistoryRange): Promise<AttendanceHistoryRow[]> {
  const { user } = useAuthStore.getState();
  const employeeId = user?.employee_id || user?.id;
  if (!employeeId) return [];

  try {
    const data = await getAttendanceRaw(String(employeeId), HISTORY_RANGE_TO_FILTER[range] as any);
    
    if (!data?.attendance || !Array.isArray(data.attendance)) {
      return [];
    }

    return data.attendance.map((row) => ({
      id: row._id || row.id,
      _id: row._id || row.id,
      date: row.date || row.attendance_date || '',
      inTime: row.In_Time || row.in_time || row.inTime || null,
      outTime: row.Out_time || row.out_time || row.outTime || null,
      hours: row.total_hours || '--',
      status: row.Out_time ? 'Completed' : row.In_time ? 'In Progress' : 'Absent',
      outside: !!(row.In_time_outside || row.Out_time_outside),
      late: !!row.delay_in_reason,
      approved: !!(row.In_time_approved || row.Out_time_approved),
      earlyGoing: !!row.early_going_reason, // ✅ FIXED: infer from reason field
      task: row.Todays_Task || null,
      inTimeOutside: !!row.In_time_outside,
      outTimeOutside: !!row.Out_time_outside,
      inTimeApproved: !!row.In_time_approved,
      outTimeApproved: !!row.Out_time_approved,
      delayReason: row.delay_in_reason || null,
      inTimeReason: row.In_time_reason || null,
      outTimeReason: row.Out_time_reason || null,
      earlyGoingReason: row.early_going_reason || null,
      totalHours: row.total_hours || null,
    }));
  } catch (e: any) {
    if (e?.response?.status === 404) return [];
    throw e;
  }
}

export async function getEmployeeAttendanceHistory(params: EmployeeAttendanceHistoryParams): Promise<AttendanceHistoryRow[]> {
  const { userId, range = 'month' } = params;
  
  if (!userId) {
    console.warn('getEmployeeAttendanceHistory: No user ID provided');
    return [];
  }

  const filter = HISTORY_RANGE_TO_FILTER[range] || 'all';

  try {
    const response = await api.post(`${FILL_PREFIX}/getAttendance`, {
      userId: userId,
      filter: filter,
    });

    const data = response.data as GetAttendanceResponse;
    
    if (!data?.attendance || !Array.isArray(data.attendance)) {
      return [];
    }

    return data.attendance.map((row) => ({
      id: row._id || row.id,
      _id: row._id || row.id,
      date: row.date || row.attendance_date || '',
      inTime: row.In_Time || row.in_time || row.inTime || null,
      outTime: row.Out_time || row.out_time || row.outTime || null,
      hours: row.total_hours || '--',
      status: row.Out_time ? 'Completed' : row.In_time ? 'In Progress' : 'Absent',
      outside: !!(row.In_time_outside || row.Out_time_outside),
      late: !!row.delay_in_reason,
      approved: !!(row.In_time_approved || row.Out_time_approved),
      earlyGoing: !!row.early_going_reason, // ✅ FIXED: infer from reason field
      task: row.Todays_Task || null,
      inTimeOutside: !!row.In_time_outside,
      outTimeOutside: !!row.Out_time_outside,
      inTimeApproved: !!row.In_time_approved,
      outTimeApproved: !!row.Out_time_approved,
      delayReason: row.delay_in_reason || null,
      inTimeReason: row.In_time_reason || null,
      outTimeReason: row.Out_time_reason || null,
      earlyGoingReason: row.early_going_reason || null,
      totalHours: row.total_hours || null,
    }));
  } catch (e: any) {
    if (e?.response?.status === 404) return [];
    throw e;
  }
}

// ============================================================
// ===== ATTENDANCE SUMMARY =====
// ============================================================

export interface AttendanceSummary {
  totalWorkingDays?: number;
  present?: number;
  absent?: number;
  late?: number;
  earlyGoing?: number;
  workoff?: number;
  halfDayWorkoff?: number;
  totalHours?: string | null;
  avgPerDay?: string | null;
  [key: string]: any;
}

export async function getAttendanceSummary(): Promise<AttendanceSummary> {
  const { user } = useAuthStore.getState();
  const employeeId = user?.employee_id || user?.id;
  if (!employeeId) {
    return { totalWorkingDays: 0, present: 0, absent: 0, late: 0, earlyGoing: 0, totalHours: '0h 0m' };
  }

  try {
    const data = await getAttendanceRaw(String(employeeId), 'month');
    const rows = data?.attendance || [];
    const present = rows.filter((row) => row.In_Time ?? row.in_time ?? row.inTime).length;
    const workoffRows = rows.filter((row) => classifyWorkoff(row).isWorkoff);
    const halfDayWorkoffRows = workoffRows.filter(
      (row) => classifyWorkoff(row).status === 'Half-day Work-off',
    );

    return {
      totalWorkingDays: data?.total_days ?? rows.length,
      present,
      absent: Math.max((data?.total_days ?? rows.length) - present, 0),
      late: rows.filter((row) => isTruthyFlag(row.in_time_late) || Boolean(row.delay_in_reason)).length,
      earlyGoing: rows.filter((row) => isTruthyFlag(row.early_going) || Boolean(row.early_going_reason)).length,
      workoff: workoffRows.length,
      halfDayWorkoff: halfDayWorkoffRows.length,
      totalHours: data?.total_hours ?? '0h 0m',
      avgPerDay: data?.avg_per_day ?? '0h 0m',
    };
  } catch (e: any) {
    if (e?.response?.status === 404) {
      return { totalWorkingDays: 0, present: 0, absent: 0, late: 0, earlyGoing: 0, totalHours: '0h 0m' };
    }
    throw e;
  }
}

// ============================================================
// ===== ATTENDANCE REQUESTS =====
// ============================================================

export interface SendOutsideReasonPayload {
  userId: string;
  task?: string;
  reason: string;
  type: 'LATE_ARRIVAL' | 'OUTSIDE_WORK' | 'EARLY_GOING';
  time: string;
  lat: number;
  lng: number;
}

export interface SendOutsideReasonResponse {
  success: boolean;
  status: string;
  message: string;
  request_type: string;
  employee: {
    employee_id: string;
    employee_code: string;
    name: string;
  };
  shift: {
    name: string;
    start: string;
    end: string;
    grace_period_minutes: number;
  };
  attendance: BackendAttendanceRow | null;
  request: {
    id: string;
    employee_id: string;
    attendance_id: string;
    request_type: string;
    requested_time: string;
    reason: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    approved_by: string | null;
    approved_at: string | null;
    rejection_reason: string | null;
    created_at: string;
    updated_at: string;
  };
}

export async function sendOutsideReason(payload: SendOutsideReasonPayload) {
  const response = await api.post(`${HR_PREFIX}/sendOutsideReason`, payload);
  return response.data as SendOutsideReasonResponse;
}

export type EarlyGoingRequestPayload = Omit<SendOutsideReasonPayload, 'type'>;

export async function sendEarlyGoingRequest(payload: EarlyGoingRequestPayload) {
  return sendOutsideReason({ ...payload, type: 'EARLY_GOING' });
}

// ============================================================
// ===== GET ATTENDANCE REQUESTS =====
// ============================================================

export interface GetAttendanceRequestsParams {
  page?: number;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';
  type?: 'LATE_ARRIVAL' | 'OUTSIDE_WORK' | 'EARLY_GOING' | 'PERMISSION_END_LATE';
  employeeId?: string;
  employeeCode?: string;
  date?: string;
  fromDate?: string;
  toDate?: string;
}

export interface AttendanceRequestItem {
  request: {
    id: string;
    employee_id: string;
    attendance_id: string;
    type: string;
    requested_time: string;
    reason: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    approved_by: string | null;
    approved_at: string | null;
    rejection_reason: string | null;
    created_at: string;
    updated_at: string;
  };
  employee: {
    id: string;
    employee_code: string;
    name: string;
    email: string;
    mobile: string;
  };
  shift: {
    id: number;
    name: string;
    start_time: string;
    end_time: string;
    grace_period_minutes: number;
  };
  attendance: {
    id: string;
    date: string;
    in_time: string | null;
    out_time: string | null;
    in_time_outside: boolean;
    in_time_outside_approved: boolean;
    in_time_outside_reason: string | null;
    in_time_late: boolean;
    in_time_late_reason: string | null;
    out_time_outside: boolean;
    out_time_outside_approved: boolean;
    out_time_outside_reason: string | null;
    total_hours_worked: string | null;
    in_location: { latitude: number | null; longitude: number | null };
    out_location: { latitude: number | null; longitude: number | null };
    cctv_in: boolean;
    cctv_out: boolean;
    early_going: boolean;
    early_going_reason: string | null;
    early_going_approved: boolean;
  };
}

export interface GetAttendanceRequestsResponse {
  success: boolean;
  filters: {
    status: string;
    type: string | null;
    employeeId: string | null;
    employeeCode: string | null;
    date: string | null;
    fromDate: string | null;
    toDate: string | null;
  };
  pagination: {
    current_page: number;
    page_size: number;
    total_records: number;
    total_pages: number;
    returned_records: number;
    has_next_page: boolean;
    has_previous_page: boolean;
  };
  requests: AttendanceRequestItem[];
}

export async function getAttendanceRequests(params: GetAttendanceRequestsParams) {
  const queryParams: Record<string, any> = {};
  
  if (params.page) queryParams.page = params.page;
  if (params.status && params.status !== 'ALL') queryParams.status = params.status;
  if (params.type) queryParams.type = params.type;
  if (params.employeeId) queryParams.employeeId = params.employeeId;
  if (params.employeeCode) queryParams.employeeCode = params.employeeCode;
  if (params.date) queryParams.date = params.date;
  if (params.fromDate) queryParams.fromDate = params.fromDate;
  if (params.toDate) queryParams.toDate = params.toDate;
  
  if (!queryParams.status && !params.status) {
    queryParams.status = 'PENDING';
  }
  
  if (queryParams.status === 'ALL') {
    delete queryParams.status;
  }

  const response = await api.get(`${HR_PREFIX}/attendanceRequests`, { params: queryParams });
  return response.data as GetAttendanceRequestsResponse;
}

export type CreateAttendanceRequestPayload = SendOutsideReasonPayload;
export const createAttendanceRequest = sendOutsideReason;
export type AttendanceRequestSummary = AttendanceRequestItem;

export async function getMyRequests(params?: Omit<GetAttendanceRequestsParams, 'employeeId'>) {
  const { user } = useAuthStore.getState();
  const employeeId = user?.employee_id || user?.id || '';
  return getAttendanceRequests({ ...params, employeeId });
}

export interface AttendanceRequestDetail extends AttendanceRequestItem {}

export async function getRequestDetails(id: string): Promise<AttendanceRequestDetail> {
  const statuses: Array<'PENDING' | 'APPROVED' | 'REJECTED'> = ['PENDING', 'APPROVED', 'REJECTED'];

  for (const status of statuses) {
    const page = await getAttendanceRequests({ status, page: 1 });
    const found = page.requests.find((item) => item.request.id === id);
    if (found) return found;
  }

  throw new Error('Request not found');
}

// ============================================================
// ===== PERMISSION REQUESTS =====
// ============================================================

export interface GetPermissionRequestsParams {
  page?: number;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';
  type?: 'MORNING_PERMISSION' | 'MIDDLE_PERMISSION' | 'END_PERMISSION';
  employeeId?: string;
  employeeCode?: string;
  date?: string;
  fromDate?: string;
  toDate?: string;
}

export interface PermissionRequestItem {
  permission: {
    id: string;
    employee_id: string;
    attendance_id: string | null;
    type: 'MORNING_PERMISSION' | 'MIDDLE_PERMISSION' | 'END_PERMISSION';
    requested_from: string;
    requested_to: string;
    approved_from: string | null;
    approved_to: string | null;
    requested_minutes: number | null;
    approved_minutes: number | null;
    reason: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    approved_by: string | null;
    approved_at: string | null;
    rejection_reason: string | null;
    created_at: string;
    updated_at: string;
  };
  employee: {
    id: string;
    employee_code: string;
    name: string;
    email: string;
    mobile: string;
    department_id?: string;
  };
  shift: {
    id: string;
    name: string;
    start_time: string;
    end_time: string;
    grace_period_minutes: number;
  };
  attendance: {
    id: string | null;
    attendance_date?: string;
    in_time?: string | null;
    out_time?: string | null;
    in_time_outside?: boolean;
    in_time_approved?: boolean;
    in_time_late?: boolean;
    cctv_in?: boolean;
    cctv_out?: boolean;
    total_hours_worked?: string | null;
  };
}

export interface GetPermissionRequestsResponse {
  success: boolean;
  filters: {
    status: string;
    type: string | null;
    employeeId: string | null;
    employeeCode: string | null;
    date: string | null;
    fromDate: string | null;
    toDate: string | null;
  };
  pagination: {
    current_page: number;
    page_size: number;
    total_records: number;
    total_pages: number;
    returned_records: number;
    has_next_page?: boolean;
    has_previous_page?: boolean;
  };
  requests: PermissionRequestItem[];
}

export async function getPermissionRequests(params: GetPermissionRequestsParams) {
  const queryParams: Record<string, any> = {};
  
  if (params.page) queryParams.page = params.page;
  if (params.status && params.status !== 'ALL') queryParams.status = params.status;
  if (params.type) queryParams.type = params.type;
  if (params.employeeId) queryParams.employeeId = params.employeeId;
  if (params.employeeCode) queryParams.employeeCode = params.employeeCode;
  if (params.date) queryParams.date = params.date;
  if (params.fromDate) queryParams.fromDate = params.fromDate;
  if (params.toDate) queryParams.toDate = params.toDate;
  
  if (!queryParams.status && !params.status) {
    queryParams.status = 'PENDING';
  }
  
  if (queryParams.status === 'ALL') {
    delete queryParams.status;
  }

  const response = await api.get(`${HR_PREFIX}/getpermissionRequests`, { params: queryParams });
  return response.data as GetPermissionRequestsResponse;
}

export interface CreatePermissionRequestPayload {
  userId: string;
  requested_from: string;
  requested_to: string;
  reason: string;
}

export async function createPermissionRequest(payload: CreatePermissionRequestPayload) {
  const response = await api.post(`${HR_PREFIX}/permissionRequest`, payload);
  return response.data;
}

// getpermissionRequests has no "lookup by id" filter, so - same approach as
// getRequestDetails above - we scan each status until we find a match. Only
// page 1 (10 records) is checked per status, matching the existing pattern.
export async function getPermissionRequestDetails(
  id: string,
  employeeId?: string
): Promise<PermissionRequestItem> {
  const statuses: Array<'PENDING' | 'APPROVED' | 'REJECTED'> = [
    'APPROVED',
    'PENDING',
    'REJECTED',
  ];

  for (const status of statuses) {
    const page = await getPermissionRequests({ status, employeeId, page: 1 });
    const found = page.requests.find((item) => item.permission.id === id);
    if (found) return found;
  }

  throw new Error('Permission request not found');
}

// ============================================================
// ===== LEAVE REQUESTS =====
// ============================================================

export interface CreateLeaveRequestPayload {
  userId: string;
  from_date: string;
  to_date: string;
  leave_type: 'HALF_DAY' | 'FULL_DAY' | 'MULTI_DAY';
  reason: string;
}

export interface CreateLeaveRequestResponse {
  success: boolean;
  status: string;
  message: string;
  employee?: {
    id: string;
    employee_code: string;
    name: string;
    email?: string;
  };
  leave?: {
    id: string;
    type: string;
    from_date: string;
    to_date: string;
    total_days: number | string;
    reason: string;
    status: string;
  };
  balance?: {
    monthly_balance: number | string | null;
    requested: number | string | null;
    remaining_after_approval: number | string | null;
  };
  [key: string]: any;
}

export async function createLeaveRequest(
  payload: CreateLeaveRequestPayload,
): Promise<CreateLeaveRequestResponse> {
  const response = await api.post(`${HR_PREFIX}/leaveRequest`, payload);
  return response.data as CreateLeaveRequestResponse;
}

export interface LeaveRequestItem {
  leave: {
    id: string;
    employee_id: string;
    from_date: string;
    to_date: string;
    total_days: number | string;
    reason: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
    approved_by?: string | null;
    approved_at?: string | null;
    rejection_reason?: string | null;
    created_at: string;
    updated_at?: string;
  };
  employee?: {
    id: string;
    employee_code: string;
    name: string;
    email?: string;
    mobile?: string;
    department_id?: string | number;
    department?: string | null;
  };
  leave_balance?: LeaveBalance | null;
}

export interface GetLeaveRequestsResponse {
  success: boolean;
  filters?: {
    status: string;
    employeeId: string | null;
    employeeCode: string | null;
    date: string | null;
    fromDate: string | null;
    toDate: string | null;
  };
  pagination?: {
    current_page: number;
    page_size: number;
    total_records: number;
    total_pages: number;
    returned_records: number;
    has_next_page: boolean;
    has_previous_page: boolean;
  };
  requests: LeaveRequestItem[];
  [key: string]: any;
}

export interface GetLeaveRequestsParams {
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'ALL';
  employeeId?: string;
  employeeCode?: string;
  date?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export async function getLeaveRequests(
  params: GetLeaveRequestsParams = {},
): Promise<GetLeaveRequestsResponse> {
  if (params.status === 'ALL') {
    const statuses: Array<Exclude<GetLeaveRequestsParams['status'], undefined | 'ALL'>> = [
      'PENDING',
      'APPROVED',
      'REJECTED',
      'CANCELLED',
    ];
    const responses = await Promise.all(
      statuses.map((status) =>
        getLeaveRequests({ ...params, status, page: 1, limit: 100 }),
      ),
    );
    const allRequests = responses
      .flatMap((response) => response.requests || [])
      .sort(
        (a, b) =>
          new Date(b.leave.created_at).getTime() -
          new Date(a.leave.created_at).getTime(),
      );
    const pageSize = Math.min(Math.max(Number(params.limit) || 10, 1), 100);
    const currentPage = Math.max(Number(params.page) || 1, 1);
    const offset = (currentPage - 1) * pageSize;
    const totalPages = allRequests.length === 0 ? 0 : Math.ceil(allRequests.length / pageSize);

    return {
      success: responses.every((response) => response.success !== false),
      filters: {
        status: 'ALL',
        employeeId: params.employeeId || null,
        employeeCode: params.employeeCode || null,
        date: params.date || null,
        fromDate: params.fromDate || null,
        toDate: params.toDate || null,
      },
      pagination: {
        current_page: currentPage,
        page_size: pageSize,
        total_records: allRequests.length,
        total_pages: totalPages,
        returned_records: Math.min(allRequests.length - offset, pageSize),
        has_next_page: currentPage < totalPages,
        has_previous_page: currentPage > 1,
      },
      requests: allRequests.slice(offset, offset + pageSize),
    };
  }

  const queryParams: Record<string, any> = {};
  
  if (params.status) queryParams.status = params.status;
  if (params.employeeId) queryParams.employeeId = params.employeeId;
  if (params.employeeCode) queryParams.employeeCode = params.employeeCode;
  if (params.date) queryParams.date = params.date;
  if (params.fromDate) queryParams.fromDate = params.fromDate;
  if (params.toDate) queryParams.toDate = params.toDate;
  if (params.page) queryParams.page = params.page;
  if (params.limit) queryParams.limit = params.limit;
  
  if (!queryParams.status && !params.status) {
    queryParams.status = 'APPROVED';
  }
  
  const response = await api.get(`${HR_PREFIX}/leaveRequests`, { params: queryParams });
  return response.data as GetLeaveRequestsResponse;
}

// ============================================================
// ===== GET DEPARTMENTS =====
// ============================================================

export interface DepartmentWithHead {
  id: string;
  dept_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  head_id: string | null;
  head_name: string | null;
  head_email: string | null;
}

export async function getDepartments() {
  const response = await api.get(`${HR_PREFIX}/getDepartments`);
  return response.data.data as DepartmentWithHead[];
}

// ============================================================
// ===== NOTIFICATIONS =====
// ============================================================

export interface BackendNotification {
  id: string;
  from_user_id?: string;
  from_name?: string;
  to_user_id?: string;
  to_name?: string;
  type?: string;
  action?: string;
  message?: string;
  rejection_reason?: string;
  is_read?: boolean;
  timestamp?: number;
  [key: string]: any;
}

export async function getNotifications() {
  const response = await api.get('/api/notifications/getNotifications');
  return response.data as { success: boolean; notifications: BackendNotification[] };
}

export async function getOutsideApprovalStatus(userId: string) {
  const response = await api.get(`/api/notifications/outsideApprovalStatus/${encodeURIComponent(userId)}`);
  return response.data as { success: boolean; inTime: string | null; outTime: string | null };
}

export async function updateExpoToken(
  userId: string,
  expoToken: string
) {
  console.log("📤 Sending Expo token to backend:", {
    userId,
    expoToken,
  });

  const response = await api.put(
    `${HR_PREFIX}/expoToken`,
    {
      userId,
      expoToken,
    }
  );

  console.log("📥 Expo token backend response:", response.data);

  return response.data;
}

function getAttendanceEmployeeCode(): string {
  const { user } = useAuthStore.getState();
  const employeeCode = user?.employee_code;

  if (!employeeCode) {
    throw new Error('Employee code is missing from the authenticated user.');
  }

  return String(employeeCode);
}

const getResponseStatus = (error: unknown): string =>
  String(
    (error as AxiosError<{ status?: string }>)?.response?.data?.status ?? '',
  )
    .trim()
    .toUpperCase();

export function isEarlyGoingReasonRequired(error: unknown): boolean {
  return getResponseStatus(error) === 'EARLY_GOING_REASON_REQUIRED';
}

export function getEarlyGoingReasonMessage(error: unknown): string {
  const message = (
    error as AxiosError<{ message?: string }>
  )?.response?.data?.message;

  return message?.trim() || 'Please provide a reason before checking out.';
}

export interface LunchOutPayload {
  userId?: string;
  lat: number;
  lng: number;
  time: string;
}

export interface LunchOutResponse {
  success: boolean;
  status: string;
  message: string;
  type?: 'LUNCH';
  employee?: {
    employee_id: string;
    employee_code: string;
  };
  attendance?: {
    attendance_id: string;
    attendance_date: string;
    in_time: string | null;
  };
  movement?: {
    movement_id: string;
    type: 'LUNCH';
    exit_time: string;
    expected_return_time: string;
    allowed_minutes: number;
    status: 'OUT' | 'OVERDUE' | string;
  };
  [key: string]: any;
}

function getAttendanceEmployeeId(): string {
  const { user } = useAuthStore.getState();
  const employeeId = user?.employee_id;

  if (!employeeId) {
    throw new Error('Employee ID is missing from the authenticated user.');
  }

  return String(employeeId);
}

/**
 * Lunch Out:
 * POST /api/hr/lunch
 * userId = employees.employee_code
 */
/**
 * Lunch Out:
 * POST /api/hr/lunch
 *
 * The axios instance already uses:
 * https://ircs-test.stackenzo.com
 *
 * Therefore the actual request becomes:
 * https://ircs-test.stackenzo.com/api/hr/lunch
 *
 * userId = employees.employee_code
 */
export async function startLunchBreak(
  payload: LunchOutPayload,
): Promise<LunchOutResponse> {
  const employeeCode = getAttendanceEmployeeCode();

  const requestPayload = {
    userId: employeeCode,
    lat: payload.lat,
    lng: payload.lng,
    time: payload.time,
  };

  const endpoint = `${HR_PREFIX}/lunch`;

  if (__DEV__) {
    console.log('🍱 Lunch Out Request:', {
      endpoint,
      method: 'POST',
      baseURL: api.defaults.baseURL,
      fullURL: `${api.defaults.baseURL}${endpoint}`,
      payload: requestPayload,
    });
  }

  const response = await api.post(
    endpoint,
    requestPayload,
  );

  if (__DEV__) {
    console.log('🍱 Lunch Out Response:', {
      status: response.status,
      data: response.data,
    });
  }

  return response.data as LunchOutResponse;
}

/**
 * Lunch In / Return:
 * POST /api/hr/temporary-return
 *
 * userId = employees.id
 * type = LUNCH
 *
 * The axios instance automatically adds:
 * Authorization: Bearer <token>
 */
export async function recordTemporaryReturn(
  payload: TemporaryReturnPayload,
): Promise<TemporaryReturnResponse> {
  const employeeId = getAttendanceEmployeeId();

  const requestPayload = {
    userId: employeeId,
    type: payload.type,
    lat: payload.lat,
    lng: payload.lng,
    time: payload.time,
  };

  const endpoint = `${HR_PREFIX}/temporary-return`;

  if (__DEV__) {
    console.log('🍱 Lunch In Request:', {
      endpoint,
      method: 'POST',
      baseURL: api.defaults.baseURL,
      fullURL: `${api.defaults.baseURL}${endpoint}`, 
      payload: requestPayload,
    });
  }

  const response = await api.post(
    endpoint,
    requestPayload,
  );

  if (__DEV__) {
    console.log('🍱 Lunch In Response:', {
      status: response.status,
      data: response.data,
    });
  }

  return response.data as TemporaryReturnResponse;
}

export function isLunchExitRecorded(
  response: LunchOutResponse,
): boolean {
  return (
    response?.success === true &&
    response?.status === 'LUNCH_EXIT_RECORDED'
  );
}
