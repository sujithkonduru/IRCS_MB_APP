// app/(employee)/permission-details/[id].tsx

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Share,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { usePermissionRequestDetails } from '@/hooks/useEmployeeApi';
import {
  PERMISSION_STATUS_COLORS,
  PermissionStatus,
  permissionTypeLabel,
} from '@/constants/permission';

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

function formatTimeOnly(value: string | null | undefined) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export default function PermissionDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, isError, refetch } = usePermissionRequestDetails(id);

  // Debug log
  console.log('📱 Permission Details - ID:', id);
  console.log('📱 Data:', data);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ headerShown: true, title: 'Permission Pass' }} />
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ headerShown: true, title: 'Permission Pass' }} />
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text style={styles.emptyText}>Couldn&apos;t load this permission.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { permission, employee, shift } = data;
  const status: PermissionStatus = permission.status || 'PENDING';
  const colors = PERMISSION_STATUS_COLORS[status] || PERMISSION_STATUS_COLORS.PENDING;
  const isApproved = status === 'APPROVED';

  // The QR encodes what a security desk needs to verify the pass at a
  // glance / with a scanner: who it belongs to and the approved window.
  // It is NOT a cryptographic token - it mirrors the approved record so it
  // can be validated visually or looked up by permission id against
  // GET /api/hr/getpermissionRequests.
  const qrPayload = JSON.stringify({
    type: 'PERMISSION_PASS',
    permission_id: permission.id,
    employee_code: employee.employee_code,
    employee_name: employee.name,
    approved_from: permission.approved_from,
    approved_to: permission.approved_to,
  });

  const handleShare = () => {
    Share.share({
      message: `Permission Pass\n${employee.name} (${employee.employee_code})\n${formatDateTime(
        permission.approved_from
      )} - ${formatDateTime(permission.approved_to)}\nPermission ID: ${permission.id}`,
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ headerShown: true, title: 'Permission Pass' }} />

      <View style={[styles.statusBanner, { backgroundColor: colors.bg }]}>
        <Text style={[styles.statusBannerText, { color: colors.text }]}>{status}</Text>
      </View>

      {isApproved ? (
        <View style={styles.passCard}>
          <View style={styles.passHeader}>
            <Text style={styles.passTitle}>Permission Pass</Text>
            <Text style={styles.passSubtitle}>{permissionTypeLabel(permission.type)}</Text>
          </View>

          <View style={styles.qrWrapper}>
            <QRCode value={qrPayload} size={200} backgroundColor="#ffffff" color="#0f172a" />
          </View>

          <Text style={styles.qrHint}>Show this to security when leaving / re-entering</Text>

          <View style={styles.divider} />

          <Field label="Employee" value={`${employee.name} (${employee.employee_code})`} />
          <Field label="Shift" value={shift?.name || '—'} />
          <Field
            label="Approved Window"
            value={`${formatTimeOnly(permission.approved_from)} - ${formatTimeOnly(
              permission.approved_to
            )}`}
          />
          <Field label="Date" value={formatDateTime(permission.approved_from).split(',')[0]} />
          {permission.approved_minutes != null && (
            <Field label="Duration" value={`${permission.approved_minutes} min`} />
          )}
          <Field label="Reason" value={permission.reason || '—'} />
          <Field label="Permission ID" value={permission.id} mono />

          <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.8}>
            <Ionicons name="share-outline" size={18} color="#ffffff" />
            <Text style={styles.shareBtnText}>Share Pass</Text>
          </TouchableOpacity>
        </View>
      ) : status === 'PENDING' ? (
        <View style={styles.infoCard}>
          <Ionicons name="hourglass-outline" size={40} color="#b45309" />
          <Text style={styles.infoTitle}>Waiting for approval</Text>
          <Text style={styles.infoText}>
            The QR pass will appear here once HR approves this permission request.
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()} activeOpacity={0.8}>
            <Text style={styles.retryBtnText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.infoCard}>
          <Ionicons name="close-circle-outline" size={40} color="#dc2626" />
          <Text style={styles.infoTitle}>Request Rejected</Text>
          {!!permission.rejection_reason && (
            <Text style={styles.infoText}>{permission.rejection_reason}</Text>
          )}
        </View>
      )}

      {!isApproved && (
        <>
          <Field label="Requested Window" value={`${formatDateTime(permission.requested_from)} - ${formatDateTime(permission.requested_to)}`} />
          <Field label="Reason" value={permission.reason || '—'} />
        </>
      )}
    </ScrollView>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={[styles.fieldValue, mono && styles.fieldValueMono]}>{value}</Text>
    </View>
  );
}

// Small helper for platform-specific monospace font
function getMonospaceFont() {
  return Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  emptyText: { color: '#94a3b8', fontSize: 15, fontWeight: '500', marginTop: 12, marginBottom: 16 },
  backBtn: { backgroundColor: '#3b82f6', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  backBtnText: { color: '#fff', fontWeight: '700' },

  content: { padding: 24, paddingBottom: 60 },

  statusBanner: { alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginBottom: 20 },
  statusBannerText: { fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },

  passCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
    alignItems: 'center',
  },

  passHeader: { alignItems: 'center', marginBottom: 20 },
  passTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  passSubtitle: { fontSize: 13, color: '#64748b', marginTop: 4, fontWeight: '600' },

  qrWrapper: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },

  qrHint: { fontSize: 12, color: '#94a3b8', marginTop: 12, textAlign: 'center' },

  divider: { height: 1, backgroundColor: '#f1f5f9', alignSelf: 'stretch', marginVertical: 20 },

  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    borderRadius: 12,
    alignSelf: 'stretch',
    marginTop: 8,
  },
  shareBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },

  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 16,
  },
  infoTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginTop: 12 },
  infoText: { fontSize: 13, color: '#64748b', marginTop: 6, textAlign: 'center' },

  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
  },
  retryBtnText: { color: '#ffffff', fontWeight: '600' },

  field: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    alignSelf: 'stretch',
    width: '100%',
  },
  fieldLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 },
  fieldValue: { fontSize: 15, color: '#0f172a', fontWeight: '600', lineHeight: 22 },
  fieldValueMono: { fontFamily: getMonospaceFont() },
});