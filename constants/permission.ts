// constants/permission.ts

// Permission "type" is derived by the backend (GET /api/hr/getpermissionRequests)
// from where requested_from/requested_to fall inside the employee's shift.
// The employee never picks this directly - it's informational only.
export const PERMISSION_TYPES = [
  { value: 'MORNING_PERMISSION', label: 'Morning' },
  { value: 'MIDDLE_PERMISSION', label: 'Mid-Shift' },
  { value: 'END_PERMISSION', label: 'End of Shift' },
] as const;

export type PermissionType = (typeof PERMISSION_TYPES)[number]['value'];

// GET /api/hr/getpermissionRequests accepts these statuses (no "ALL" on the
// backend - that's resolved client-side in api/axios.ts).
export type PermissionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export const PERMISSION_STATUS_COLORS: Record<
  PermissionStatus,
  { bg: string; text: string }
> = {
  PENDING: { bg: '#fef3c7', text: '#b45309' },
  APPROVED: { bg: '#dcfce7', text: '#15803d' },
  REJECTED: { bg: '#fee2e2', text: '#dc2626' },
};

export function permissionTypeLabel(value: string) {
  return PERMISSION_TYPES.find((t) => t.value === value)?.label || value;
}

// Employees are limited to 4 permission requests (pending or approved) per
// calendar month by POST /api/hr/permissionRequest.
export const MONTHLY_PERMISSION_LIMIT = 4;