// constants/requests.ts

// Request types allowed by the backend contract (see Section 8: Attendance Request)
// BACKEND ONLY ACCEPTS: LATE_ARRIVAL, OUTSIDE_WORK, EARLY_GOING
export const REQUEST_TYPES = [
  { value: 'LATE_ARRIVAL', label: 'Late Arrival' },
  { value: 'OUTSIDE_WORK', label: 'Outside Work' },
  { value: 'EARLY_GOING', label: 'Early Going' },
] as const;

export type RequestType = (typeof REQUEST_TYPES)[number]['value'];

export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export const STATUS_COLORS: Record<RequestStatus, { bg: string; text: string }> = {
  PENDING: { bg: '#fef3c7', text: '#b45309' },
  APPROVED: { bg: '#dcfce7', text: '#15803d' },
  REJECTED: { bg: '#fee2e2', text: '#dc2626' },
};

export function requestTypeLabel(value: string) {
  return REQUEST_TYPES.find((r) => r.value === value)?.label || value;
}

// Helper to validate if a request type is valid for the backend
export function isValidRequestType(type: string): type is RequestType {
  return REQUEST_TYPES.some(r => r.value === type);
}