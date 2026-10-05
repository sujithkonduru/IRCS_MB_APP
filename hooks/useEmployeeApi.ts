// hooks/useEmployeeApi.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getProfile,
  getDashboard,
  getTodayAttendance,
  getAttendanceHistory,
  getAttendanceReport,
  getAttendanceSummary,
  createAttendanceRequest,
  getMyRequests,
  getRequestDetails,
  getEmployees,
  getEmployeeById,
  updateEmployee,
  deactivateEmployee,
  getMasterData,
  addMasterData,
  deleteMasterData,
  createEmployee,
  verifyOTP,
  resendOTP,
  login,
  sendOutsideReason,
  getAttendanceRequests,
  manualCheckIn,
  manualCheckOut,
  cctvCheckIn,
  cctvCheckOut,
  getEmployeeAttendanceHistory,
  // ===== LEAVE IMPORTS =====
  getLeaveRequests,
  createLeaveRequest,
  // ===== PERMISSION IMPORTS =====
  getPermissionRequests,
  createPermissionRequest,
  getPermissionRequestDetails,
  getDepartments,
  getEmployeeStatus,
  isGpsWindowClosedResponse,
  // ===== EARLY GOING =====
  sendEarlyGoingRequest,
  // ===== TYPES =====
  type Profile,
  type DashboardData,
  type TodayAttendance,
  type AttendanceHistoryRow,
  type AttendanceSummary,
  type AttendanceReport,
  type EmployeeAttendanceHistoryParams,
  type CreateAttendanceRequestPayload,
  type AttendanceRequestSummary,
  type AttendanceRequestDetail,
  type Employee,
  type UpdateEmployeePayload,
  type MasterData,
  type CreateEmployeePayload,
  type VerifyOTPPayload,
  type ResendOTPPayload,
  type LoginPayload,
  type GetEmployeesParams,
  type HistoryRange,
  type SendOutsideReasonPayload,
  type GetAttendanceRequestsParams,
  type GetAttendanceRequestsResponse,
  type ManualCheckInPayload,
  type ManualCheckInResponse,
  type ManualCheckOutPayload,
  type ManualCheckOutResponse,
  type CCTVCheckInPayload,
  type CCTVCheckOutPayload,
  type GetLeaveRequestsParams,
  type CreateLeaveRequestPayload,
  type GetPermissionRequestsParams,
  type CreatePermissionRequestPayload,
  type PermissionRequestItem,
  type DepartmentWithHead,
  type EmployeeStatus,
} from '@/api/axios';
import { useAuthStore } from '@/store/authStore';

// ============================================================
// PROFILE & DASHBOARD
// ============================================================

export function useProfile() {
  const { user } = useAuthStore();
  return useQuery({
    queryKey: ['profile', user?.id],
    queryFn: getProfile,
    enabled: !!user,
    staleTime: 1000 * 60 * 10,
  });
}

export function useDashboard() {
  const { user } = useAuthStore();
  return useQuery({
    queryKey: ['dashboard', user?.id],
    queryFn: getDashboard,
    enabled: !!user,
    refetchOnMount: true,
    staleTime: 1000 * 60 * 5,
  });
}

// ============================================================
// ATTENDANCE
// ============================================================

export function useAttendanceSummary() {
  const { user } = useAuthStore();
  return useQuery({
    queryKey: ['attendanceSummary', user?.id],
    queryFn: getAttendanceSummary,
    enabled: !!user,
    staleTime: 1000 * 60 * 10,
  });
}

export function useTodayAttendance() {
  const { user } = useAuthStore();
  return useQuery({
    queryKey: ['todayAttendance', user?.user_id],
    queryFn: getTodayAttendance,
    enabled: !!user && !!user?.user_id,
    refetchInterval: 60000,
  });
}

export function useAttendanceHistory(range: HistoryRange) {
  const { user } = useAuthStore();
  return useQuery({
    queryKey: ['attendanceHistory', user?.id, range],
    queryFn: () => getAttendanceHistory(range),
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });
}

export function useAttendanceReport(range: HistoryRange) {
  const { user } = useAuthStore();
  const employeeId = user?.employee_id || user?.id;

  return useQuery<AttendanceReport>({
    queryKey: ['attendanceReport', employeeId, range],
    queryFn: () => getAttendanceReport(range),
    enabled: !!employeeId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useEmployeeAttendanceHistory(params: EmployeeAttendanceHistoryParams) {
  return useQuery({
    queryKey: ['employeeAttendanceHistory', params.userId, params.range],
    queryFn: () => getEmployeeAttendanceHistory(params),
    enabled: !!params.userId,
    staleTime: 1000 * 60 * 5,
  });
}

// ============================================================
// ATTENDANCE REQUESTS
// ============================================================

export function useCreateAttendanceRequest() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  
  return useMutation({
    mutationFn: createAttendanceRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myRequests', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['attendanceSummary', user?.id] });
    },
  });
}

export function useSendAttendanceRequest() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  
  return useMutation({
    mutationFn: sendOutsideReason,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myAttendanceRequests'] });
      queryClient.invalidateQueries({ queryKey: ['myRequests'] });
      queryClient.invalidateQueries({ queryKey: ['employeeStatus'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['attendanceSummary'] });
      queryClient.invalidateQueries({ queryKey: ['attendanceReport'] });
    },
    onError: (error: any) => {
      console.error('Send attendance request error:', error);
    },
  });
}

export function useMyRequests() {
  const { user } = useAuthStore();
  return useQuery({
    queryKey: ['myRequests', user?.id],
    queryFn: () => getMyRequests(),
    enabled: !!user,
    staleTime: 1000 * 60 * 2,
  });
}

export function useMyAttendanceRequests(params?: {
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';
  page?: number;
  type?: 'LATE_ARRIVAL' | 'OUTSIDE_WORK' | 'EARLY_GOING' | 'PERMISSION_END_LATE';
  date?: string;
  fromDate?: string;
  toDate?: string;
}) {
  const { user } = useAuthStore();
  const employeeId = user?.employee_id || user?.id;
  
  return useQuery({
    queryKey: ['myAttendanceRequests', employeeId, params],
    queryFn: () => getAttendanceRequests({
      employeeId: employeeId,
      status: params?.status || 'PENDING',
      page: params?.page || 1,
      type: params?.type,
      date: params?.date,
      fromDate: params?.fromDate,
      toDate: params?.toDate,
    }),
    enabled: !!user && !!employeeId,
    staleTime: 1000 * 60 * 2,
    retry: 2,
    retryDelay: 1000,
  });
}

export function useEmployeeRequests(params?: {
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';
  page?: number;
  type?: 'LATE_ARRIVAL' | 'OUTSIDE_WORK' | 'EARLY_GOING' | 'PERMISSION_END_LATE';
  employeeId?: string;
  employeeCode?: string;
  date?: string;
  fromDate?: string;
  toDate?: string;
}) {
  const { user } = useAuthStore();
  
  return useQuery({
    queryKey: ['employeeRequests', params],
    queryFn: () => getAttendanceRequests({
      status: params?.status || 'PENDING',
      page: params?.page || 1,
      type: params?.type,
      employeeId: params?.employeeId,
      employeeCode: params?.employeeCode,
      date: params?.date,
      fromDate: params?.fromDate,
      toDate: params?.toDate,
    }),
    enabled: !!user && !!params?.employeeId,
    staleTime: 1000 * 60 * 2,
  });
}

export function useRequestDetails(id: string | undefined) {
  return useQuery({
    queryKey: ['requestDetails', id],
    queryFn: () => getRequestDetails(id!),
    enabled: !!id,
  });
}

// ============================================================
// EMPLOYEE MANAGEMENT
// ============================================================

export function useEmployees(params?: GetEmployeesParams) {
  const { user } = useAuthStore();
  return useQuery({
    queryKey: ['employees', user?.id, params],
    queryFn: () => getEmployees(params),
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });
}

export function useEmployee(id: string | undefined) {
  const { user } = useAuthStore();
  return useQuery({
    queryKey: ['employee', id],
    queryFn: () => getEmployeeById(id!),
    enabled: !!user && !!id,
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ employeeId, payload }: { employeeId: string; payload: UpdateEmployeePayload }) =>
      updateEmployee(employeeId, payload),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employee', variables.employeeId] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export function useDeactivateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deactivateEmployee,
    onSuccess: (_, employeeId) => {
      queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

// ============================================================
// MASTER DATA
// ============================================================

export function useMasterData() {
  const { user } = useAuthStore();
  return useQuery({
    queryKey: ['masterData'],
    queryFn: getMasterData,
    enabled: !!user,
    staleTime: 1000 * 60 * 30,
  });
}

export function useDepartments() {
  const { data: masterData } = useMasterData();
  return {
    data: masterData?.departments || [],
    isLoading: !masterData,
  };
}

export function useDesignations() {
  const { data: masterData } = useMasterData();
  return {
    data: masterData?.designations || [],
    isLoading: !masterData,
  };
}

export function useRoles() {
  const { data: masterData } = useMasterData();
  return {
    data: masterData?.roles || [],
    isLoading: !masterData,
  };
}

export function useShifts() {
  const { data: masterData } = useMasterData();
  return {
    data: masterData?.shifts || [],
    isLoading: !masterData,
  };
}

export function useAddMasterData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addMasterData,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['masterData'] });
    },
  });
}

export function useDeleteMasterData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteMasterData,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['masterData'] });
    },
  });
}

// ============================================================
// AUTHENTICATION
// ============================================================

export function useRegisterEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createEmployee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export function useVerifyOTP() {
  return useMutation({
    mutationFn: verifyOTP,
  });
}

export function useResendOTP() {
  return useMutation({
    mutationFn: resendOTP,
  });
}

export function useLogin() {
  const { setAuthSuccess } = useAuthStore();
  return useMutation({
    mutationFn: login,
    onSuccess: async (data) => {
      await setAuthSuccess(data.token);
    },
  });
}

// ============================================================
// MANUAL ATTENDANCE
// ============================================================

export function useManualCheckIn() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  
  return useMutation({
    mutationFn: manualCheckIn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todayAttendance'] });
      queryClient.invalidateQueries({ queryKey: ['employeeStatus'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['attendanceSummary'] });
      queryClient.invalidateQueries({ queryKey: ['attendanceHistory'] });
      queryClient.invalidateQueries({ queryKey: ['attendanceReport'] });
    },
    onError: (error: any) => {
      if (isGpsWindowClosedResponse(error)) {
        console.warn('Manual check-in blocked: GPS attendance window is closed.');
        return;
      }
      console.error('Manual check-in error:', error);
    },
  });
}

export function useManualCheckOut() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  
  return useMutation({
    mutationFn: manualCheckOut,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todayAttendance'] });
      queryClient.invalidateQueries({ queryKey: ['employeeStatus'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['attendanceSummary'] });
      queryClient.invalidateQueries({ queryKey: ['attendanceHistory'] });
      queryClient.invalidateQueries({ queryKey: ['attendanceReport'] });
    },
    onError: (error: any) => {
      console.error('Manual check-out error:', error);
    },
  });
}

export function useCCTVCheckIn() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  
  return useMutation({
    mutationFn: cctvCheckIn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todayAttendance', user?.user_id || user?.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', user?.id] });
    },
    onError: (error: any) => {
      console.error('CCTV check-in error:', error);
    },
  });
}

export function useCCTVCheckOut() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  
  return useMutation({
    mutationFn: cctvCheckOut,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todayAttendance', user?.user_id || user?.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', user?.id] });
    },
    onError: (error: any) => {
      console.error('CCTV check-out error:', error);
    },
  });
}

// ============================================================
// PERMISSION REQUESTS
// ============================================================

export function usePermissionRequests(params?: GetPermissionRequestsParams) {
  const { user } = useAuthStore();
  
  return useQuery({
    queryKey: ['permissionRequests', user?.id, params],
    queryFn: () => getPermissionRequests({
      ...params,
      employeeId: params?.employeeId || user?.employee_id || user?.id,
    }),
    enabled: !!user,
    staleTime: 1000 * 60 * 2,
  });
}

export function useCreatePermissionRequest() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  
  return useMutation({
    mutationFn: createPermissionRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissionRequests', user?.id] });
    },
    onError: (error: any) => {
      console.error('Create permission request error:', error);
    },
  });
}

export function usePermissionRequestDetails(id: string | undefined) {
  const { user } = useAuthStore();
  const employeeId = user?.employee_id || user?.id;

  return useQuery({
    queryKey: ['permissionRequestDetails', id],
    queryFn: () => getPermissionRequestDetails(id!, employeeId),
    enabled: !!id && !!user,
  });
}

// ============================================================
// LEAVE REQUESTS
// ============================================================

// Get My Leave Requests
export function useMyLeaveRequests(params?: GetLeaveRequestsParams) {
  const { user } = useAuthStore();
  const employeeId = user?.employee_id || user?.id;
  
  return useQuery({
    queryKey: ['myLeaveRequests', employeeId, params],
    queryFn: () => getLeaveRequests({
      ...params,
      employeeId: employeeId,
    }),
    enabled: !!user && !!employeeId,
    staleTime: 1000 * 60 * 2,
  });
}

// Get All Leave Requests (for Admin)
export function useLeaveRequests(params?: GetLeaveRequestsParams) {
  const { user } = useAuthStore();
  
  return useQuery({
    queryKey: ['leaveRequests', user?.id, params],
    queryFn: () => getLeaveRequests(params || {}),
    enabled: !!user,
    staleTime: 1000 * 60 * 2,
  });
}

// Create Leave Request
export function useCreateLeaveRequest() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  
  return useMutation({
    mutationFn: createLeaveRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myLeaveRequests'] });
      queryClient.invalidateQueries({ queryKey: ['leaveRequests'] });
      queryClient.invalidateQueries({ queryKey: ['employeeStatus'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['attendanceSummary'] });
      queryClient.invalidateQueries({ queryKey: ['attendanceReport'] });
    },
    onError: (error: any) => {
      console.error('Create leave request error:', error);
    },
  });
}

// ============================================================
// DEPARTMENTS
// ============================================================

export function useDepartmentsList() {
  const { user } = useAuthStore();
  
  return useQuery({
    queryKey: ['departments'],
    queryFn: getDepartments,
    enabled: !!user,
    staleTime: 1000 * 60 * 30,
  });
}

// ============================================================
// EARLY GOING REQUEST - SINGLE DEFINITION
// ============================================================

export function useSendEarlyGoingRequest() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: sendEarlyGoingRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todayAttendance'] });
      queryClient.invalidateQueries({ queryKey: ['employeeStatus'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['myAttendanceRequests'] });
      queryClient.invalidateQueries({ queryKey: ['attendanceReport'] });
    },
    onError: (error: any) => {
      console.error('Send early-going request error:', error);
    },
  });
}

// ============================================================
// EMPLOYEE STATUS
// ============================================================

export function useEmployeeStatus() {
  const { user } = useAuthStore();
  const userId = user?.user_id; // ✅ Use user_id, not employee_id
  
  return useQuery({
    queryKey: ['employeeStatus', userId],
    queryFn: () => getEmployeeStatus(userId!),
    enabled: !!user && !!userId,
    refetchInterval: 60000,
    staleTime: 1000 * 30,
  });
}

// ============================================================
// EXPORT ALL
// ============================================================

export default {
  // Profile & Dashboard
  useProfile,
  useDashboard,
  useTodayAttendance,
  useAttendanceHistory,
  useAttendanceReport,
  useAttendanceSummary,
  
  // Requests
  useCreateAttendanceRequest,
  useSendAttendanceRequest,
  useMyRequests,
  useMyAttendanceRequests,
  useEmployeeRequests,
  useRequestDetails,
  
  // Employee Management
  useEmployees,
  useEmployee,
  useUpdateEmployee,
  useDeactivateEmployee,
  
  // Master Data
  useMasterData,
  useDepartments,
  useDesignations,
  useRoles,
  useShifts,
  useAddMasterData,
  useDeleteMasterData,
  
  // Authentication
  useRegisterEmployee,
  useVerifyOTP,
  useResendOTP,
  useLogin,
  
  // Manual Attendance
  useManualCheckIn,
  useManualCheckOut,
  useCCTVCheckIn,
  useCCTVCheckOut,
  
  // Permission Requests
  usePermissionRequests,
  useCreatePermissionRequest,
  usePermissionRequestDetails,
  
  // Leave Requests
  useMyLeaveRequests,
  useLeaveRequests,
  useCreateLeaveRequest,
  
  // Departments
  useDepartmentsList,
  
  // Early Going
  useSendEarlyGoingRequest,
  
  // Employee Status
  useEmployeeStatus,
};
export type { HistoryRange } from '@/api/axios';
