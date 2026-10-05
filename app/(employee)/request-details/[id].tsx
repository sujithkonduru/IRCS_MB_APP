// app/(employee)/request-details/[id].tsx

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRequestDetails } from '@/hooks/useEmployeeApi';
import {
  STATUS_COLORS,
  RequestStatus,
  requestTypeLabel,
  REQUEST_TYPE_ICONS,
} from '@/constants/requests';

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(value: string | null | undefined) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function RequestDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useRequestDetails(id);

  console.log('📱 Request Details - ID:', id);
  console.log('📱 Data:', data);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ headerShown: true, title: 'Request Details' }} />
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading request details...</Text>
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ headerShown: true, title: 'Request Details' }} />
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text style={styles.emptyText}>Couldn't load this request.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Determine if we have the full request object or just the request data
  const request = data.request || data;
  
  const status: RequestStatus = request.status || 'PENDING';
  const colors = STATUS_COLORS[status] || STATUS_COLORS.PENDING;
  
  // Get the icon for the request type
  const getIconName = () => {
    switch (request.request_type || request.type) {
      case 'LATE_ARRIVAL':
        return 'time-outline';
      case 'OUTSIDE_WORK':
        return 'location-outline';
      case 'EARLY_GOING':
        return 'exit-outline';
      default:
        return 'document-text-outline';
    }
  };

  const getIconColor = () => {
    switch (request.request_type || request.type) {
      case 'LATE_ARRIVAL':
        return '#d97706';
      case 'OUTSIDE_WORK':
        return '#3b82f6';
      case 'EARLY_GOING':
        return '#7c3aed';
      default:
        return '#64748b';
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ headerShown: true, title: 'Request Details' }} />

      {/* Status Banner */}
      <View style={[styles.statusBanner, { backgroundColor: colors.bg }]}>
        <Text style={[styles.statusBannerText, { color: colors.text }]}>{status}</Text>
      </View>

      {/* Main Card */}
      <View style={styles.mainCard}>
        {/* Request Type Header */}
        <View style={styles.typeHeader}>
          <View style={[styles.typeIconContainer, { backgroundColor: `${getIconColor()}15` }]}>
            <Ionicons name={getIconName() as any} size={28} color={getIconColor()} />
          </View>
          <View style={styles.typeHeaderContent}>
            <Text style={styles.typeLabel}>REQUEST TYPE</Text>
            <Text style={styles.typeValue}>
              {requestTypeLabel(request.request_type || request.type)}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Details Grid */}
        <View style={styles.detailsGrid}>
          <DetailItem 
            label="Date" 
            value={formatDate(request.attendance_date || request.requested_time || request.created_at)}
            icon="calendar-outline"
          />
          
          <DetailItem 
            label="Requested Time" 
            value={formatTime(request.requested_time)}
            icon="time-outline"
          />
          
          <DetailItem 
            label="Submitted On" 
            value={formatDateTime(request.created_at)}
            icon="send-outline"
          />
          
          <DetailItem 
            label="Employee ID" 
            value={request.emp_id || request.employee_id || '—'}
            icon="person-outline"
          />
        </View>

        <View style={styles.divider} />

        {/* Reason */}
        <View style={styles.reasonSection}>
          <Text style={styles.sectionLabel}>REASON</Text>
          <Text style={styles.reasonText}>
            {request.reason || 'No reason provided.'}
          </Text>
        </View>

        {/* Location Information */}
        {(request.lat || request.lng) && (
          <>
            <View style={styles.divider} />
            <View style={styles.locationSection}>
              <Text style={styles.sectionLabel}>LOCATION</Text>
              <View style={styles.locationInfo}>
                <Ionicons name="location-outline" size={16} color="#3b82f6" />
                <Text style={styles.locationText}>
                  {request.lat && request.lng 
                    ? `${request.lat.toFixed(6)}, ${request.lng.toFixed(6)}`
                    : 'Location captured'}
                </Text>
              </View>
            </View>
          </>
        )}

        {/* Manager Response */}
        {(status === 'APPROVED' || status === 'REJECTED') && (
          <>
            <View style={styles.divider} />
            <View style={styles.responseSection}>
              <Text style={styles.sectionLabel}>
                {status === 'APPROVED' ? 'APPROVED' : 'REJECTED'} BY
              </Text>
              <View style={styles.responseInfo}>
                <Ionicons 
                  name={status === 'APPROVED' ? 'checkmark-circle' : 'close-circle'} 
                  size={20} 
                  color={status === 'APPROVED' ? '#059669' : '#dc2626'} 
                />
                <Text style={[
                  styles.responseText,
                  status === 'APPROVED' ? styles.approvedText : styles.rejectedText
                ]}>
                  {request.manager_response || request.rejection_reason || 
                   (status === 'APPROVED' ? 'Request was approved.' : 'Request was rejected.')}
                </Text>
              </View>
              {request.approved_at && (
                <Text style={styles.responseDate}>
                  {formatDateTime(request.approved_at)}
                </Text>
              )}
            </View>
          </>
        )}

        {/* Status History */}
        <View style={styles.divider} />
        <View style={styles.statusHistorySection}>
          <Text style={styles.sectionLabel}>STATUS HISTORY</Text>
          <View style={styles.statusHistoryItem}>
            <View style={styles.statusHistoryDot}>
              <View style={[styles.statusHistoryCircle, { backgroundColor: '#3b82f6' }]} />
            </View>
            <View style={styles.statusHistoryContent}>
              <Text style={styles.statusHistoryTitle}>Submitted</Text>
              <Text style={styles.statusHistoryDate}>{formatDateTime(request.created_at)}</Text>
            </View>
          </View>
          
          {status === 'APPROVED' && request.approved_at && (
            <View style={styles.statusHistoryItem}>
              <View style={styles.statusHistoryDot}>
                <View style={[styles.statusHistoryCircle, { backgroundColor: '#059669' }]} />
              </View>
              <View style={styles.statusHistoryContent}>
                <Text style={styles.statusHistoryTitle}>Approved</Text>
                <Text style={styles.statusHistoryDate}>{formatDateTime(request.approved_at)}</Text>
              </View>
            </View>
          )}
          
          {status === 'REJECTED' && request.approved_at && (
            <View style={styles.statusHistoryItem}>
              <View style={styles.statusHistoryDot}>
                <View style={[styles.statusHistoryCircle, { backgroundColor: '#dc2626' }]} />
              </View>
              <View style={styles.statusHistoryContent}>
                <Text style={styles.statusHistoryTitle}>Rejected</Text>
                <Text style={styles.statusHistoryDate}>{formatDateTime(request.approved_at)}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Request ID */}
        <View style={styles.divider} />
        <View style={styles.idSection}>
          <Text style={styles.idLabel}>Request ID</Text>
          <Text style={styles.idValue}>{request.id || id}</Text>
        </View>
      </View>

      {/* Back Button */}
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back-outline" size={20} color="#3b82f6" />
        <Text style={styles.backButtonText}>Back to Requests</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

/* ============================================================
   DETAIL ITEM COMPONENT
============================================================ */

function DetailItem({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <View style={styles.detailItem}>
      <View style={styles.detailIconContainer}>
        <Ionicons name={icon as any} size={16} color="#64748b" />
      </View>
      <View style={styles.detailContent}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
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

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 24,
  },

  loadingText: {
    marginTop: 12,
    color: '#64748b',
    fontSize: 14,
    fontWeight: '500',
  },

  emptyText: {
    color: '#94a3b8',
    fontSize: 15,
    fontWeight: '500',
    marginTop: 12,
    marginBottom: 16,
    textAlign: 'center',
  },

  backBtn: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 10,
  },

  backBtnText: {
    color: '#fff',
    fontWeight: '700',
  },

  retryBtn: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },

  retryBtnText: {
    color: '#3b82f6',
    fontWeight: '600',
  },

  content: {
    padding: 20,
    paddingBottom: 40,
  },

  statusBanner: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
  },

  statusBannerText: {
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.5,
  },

  mainCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  typeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },

  typeIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },

  typeHeaderContent: {
    flex: 1,
  },

  typeLabel: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 2,
  },

  typeValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },

  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 16,
  },

  detailsGrid: {
    gap: 12,
  },

  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  detailIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  detailContent: {
    flex: 1,
  },

  detailLabel: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },

  detailValue: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '600',
  },

  sectionLabel: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },

  reasonSection: {
    marginTop: 4,
  },

  reasonText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 22,
  },

  locationSection: {
    marginTop: 4,
  },

  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  locationText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
  },

  responseSection: {
    marginTop: 4,
  },

  responseInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },

  responseText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
  },

  approvedText: {
    color: '#065f46',
  },

  rejectedText: {
    color: '#991b1b',
  },

  responseDate: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 6,
    marginLeft: 30,
  },

  statusHistorySection: {
    marginTop: 4,
  },

  statusHistoryItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },

  statusHistoryDot: {
    width: 30,
    alignItems: 'center',
  },

  statusHistoryCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },

  statusHistoryContent: {
    flex: 1,
  },

  statusHistoryTitle: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '600',
  },

  statusHistoryDate: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },

  idSection: {
    alignItems: 'center',
  },

  idLabel: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },

  idValue: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },

  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#dbeafe',
  },

  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3b82f6',
  },
});