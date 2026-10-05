// constants/leave.ts

// Leave types allowed by the backend contract (POST /api/fill/leaveRequest)
// BACKEND ONLY ACCEPTS: HALF_DAY, FULL_DAY, MULTI_DAY
export const LEAVE_TYPES = [
  { value: 'HALF_DAY', label: 'Half Day' },
  { value: 'FULL_DAY', label: 'Full Day' },
  { value: 'MULTI_DAY', label: 'Multi Day' },
] as const;

export type LeaveType = (typeof LEAVE_TYPES)[number]['value'];

// GET /api/fill/leaveRequests accepts these statuses (no "ALL" on the
// backend - that's resolved client-side in api/axios.ts).
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export const LEAVE_STATUS_COLORS: Record<
  LeaveStatus,
  { bg: string; text: string }
> = {
  PENDING: { bg: '#fef3c7', text: '#b45309' },
  APPROVED: { bg: '#dcfce7', text: '#15803d' },
  REJECTED: { bg: '#fee2e2', text: '#dc2626' },
  CANCELLED: { bg: '#e2e8f0', text: '#475569' },
};

export function leaveTypeLabel(value: string) {
  return LEAVE_TYPES.find((t) => t.value === value)?.label || value;
}

// HALF_DAY and FULL_DAY require from_date === to_date on the backend;
// only MULTI_DAY allows a real date range.
export function isSingleDayLeave(type: LeaveType) {
  return type === 'HALF_DAY' || type === 'FULL_DAY';
}