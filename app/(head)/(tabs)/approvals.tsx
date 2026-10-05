import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import Toast from 'react-native-toast-message';
import { getPendingOutsideApprovals, approveOutside, PendingOutsideApproval, getApiErrorMessage } from '@/api/axios';
import { useAuthStore } from '@/store/authStore';

// There is no dedicated "list pending approvals" or "action-approval"
// route on the backend - those were invented by an earlier pass. The
// real routes are:
//   POST /api/fill/getAttendanceAdmin - org-wide attendance, which we
//     scan client-side for outside check-ins/outs that aren't approved
//     yet (see getPendingOutsideApprovals in api/axios.ts)
//   PUT  /api/fill/approveOutside - approves/rejects one flagged record
//
// KNOWN BACKEND SCHEMA ISSUE: approveOutside validates `headId` against
// the legacy `members` table with role = 'head', but the JWT's `id` is
// an `employees.id`. If those ids don't line up for a given head user on
// the backend, every approve/reject call here will fail with 403
// "Unauthorized: only heads can approve" even though the user really is
// a head. That's a backend data issue, not something fixable here.
type ApprovalRequest = PendingOutsideApproval;

export default function ApprovalsScreen() {
  const { user } = useAuthStore(); // Get the logged-in Head's ID
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch pending requests from backend
  const fetchRequests = async () => {
    try {
      const pending = await getPendingOutsideApprovals();
      setRequests(pending);
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Error Fetching Requests', text2: getApiErrorMessage(error) });
      console.error(error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user?.employee_id || user?.id) fetchRequests();
  }, [user?.employee_id, user?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRequests();
  };

  const handleAction = async (item: ApprovalRequest, action: 'approve' | 'reject') => {
    try {
      await approveOutside({
        attendanceId: item.attendanceId,
        employeeId: item.employeeId,
        type: item.type,
        action,
        headId: user?.employee_id || user?.id || '',
      });

      // Remove the processed request from the UI
      setRequests((prev) =>
        prev.filter((req) => !(req.attendanceId === item.attendanceId && req.type === item.type))
      );
      Toast.show({
        type: action === 'approve' ? 'success' : 'info',
        text1: `Request ${action.toUpperCase()}D`,
      });
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Action Failed',
        text2: getApiErrorMessage(error),
      });
    }
  };

  const renderRequestCard = ({ item }: { item: ApprovalRequest }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.empName}>{item.employeeName}</Text>
          <Text style={styles.departmentText}>{item.employeeEmail}</Text>
        </View>
        <View style={[styles.badge, item.type === 'In_Time' ? styles.badgeIn : styles.badgeOut]}>
          <Text style={[styles.badgeText, item.type === 'In_Time' ? styles.badgeTextIn : styles.badgeTextOut]}>
            {item.type === 'In_Time' ? 'CHECK IN' : 'CHECK OUT'}
          </Text>
        </View>
      </View>

      <Text style={styles.departmentText}>{item.date}</Text>

      <View style={styles.reasonContainer}>
        <Text style={styles.reasonLabel}>Provided Reason:</Text>
        <Text style={styles.reasonText}>"{item.reason || 'No reason given'}"</Text>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.rejectBtn]}
          onPress={() => handleAction(item, 'reject')}
        >
          <Text style={styles.rejectBtnText}>Reject</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.approveBtn]}
          onPress={() => handleAction(item, 'approve')}
        >
          <Text style={styles.approveBtnText}>Approve</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.pageTitle}>Pending Approvals</Text>
      
      {isLoading ? (
        <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 40 }} />
      ) : requests.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>You're all caught up!</Text>
          <Text style={styles.emptyStateSub}>No pending requests to review.</Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={item => `${item.attendanceId}-${item.type}`}
          renderItem={renderRequestCard}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}
      <Toast />
    </View>
  );
}

// ... Keep the exact same styles object from the previous message here ...
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 24, paddingTop: 60 },
  pageTitle: { fontSize: 28, fontWeight: '700', color: '#0f172a', marginBottom: 24 },
  card: { backgroundColor: '#ffffff', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#64748b', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  empName: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  departmentText: { fontSize: 14, color: '#64748b', marginTop: 4 },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  badgeIn: { backgroundColor: '#dcfce7' },
  badgeOut: { backgroundColor: '#fee2e2' },
  badgeText: { fontSize: 12, fontWeight: '700' },
  badgeTextIn: { color: '#166534' },
  badgeTextOut: { color: '#991b1b' },
  reasonContainer: { marginBottom: 20, backgroundColor: '#f8fafc', padding: 16, borderRadius: 12 },
  reasonLabel: { fontSize: 13, fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 },
  reasonText: { fontSize: 15, color: '#334155', fontStyle: 'italic', lineHeight: 22 },
  actionRow: { flexDirection: 'row', gap: 12 },
  actionBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rejectBtn: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0' },
  approveBtn: { backgroundColor: '#3b82f6' },
  rejectBtnText: { color: '#64748b', fontSize: 15, fontWeight: '600' },
  approveBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyStateText: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  emptyStateSub: { fontSize: 15, color: '#64748b' }
});