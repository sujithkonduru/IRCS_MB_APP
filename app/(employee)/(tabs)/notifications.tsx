import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '@/store/authStore';
import { BackendNotification, getNotifications, getApiErrorMessage } from '@/api/axios';

function timeAgo(value?: number) {
  if (!value) return '';
  const diff = Date.now() - value;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getTimestamp(n: BackendNotification): number {
  if (typeof n.timestamp === 'number') return n.timestamp;
  const raw = n.created_at || n.createdAt || n.time || n.updated_at;
  const parsed = raw ? new Date(raw).getTime() : 0;
  return Number.isNaN(parsed) ? 0 : parsed;
}

export default function NotificationsScreen() {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<BackendNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasError, setHasError] = useState(false);

  const loadNotifications = useCallback(async (refresh = false) => {
    if (!user) return;
    if (refresh) setRefreshing(true);
    else setIsLoading(true);

    try {
      const result = await getNotifications();
      const list = Array.isArray(result?.notifications) ? result.notifications : [];
      setNotifications([...list].sort((a, b) => getTimestamp(b) - getTimestamp(a)));
      setHasError(false);
    } catch (error) {
      console.error('Failed to load notifications:', error);
      setHasError(true);
      Toast.show({
        type: 'error',
        text1: 'Could Not Load Notifications',
        text2: getApiErrorMessage(error),
      });
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  return (
    <View style={styles.container}>
      <Text style={styles.pageTitle}>Notifications</Text>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : hasError ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Could not load notifications. Pull down to try again.</Text>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>You're all caught up — no notifications yet.</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadNotifications(true)} />}
        >
          {notifications.map((n, index) => {
            const ts = getTimestamp(n);
            const title = n.action || n.type || 'Notification';
            const message = n.message || n.rejection_reason || 'You have a new notification.';
            return (
              <View key={n.id || String(index)} style={[styles.card, n.is_read === false && styles.cardUnread]}>
                <View style={styles.cardHeader}>
                  <Text style={styles.typeLabel}>{title}</Text>
                  {!!ts && <Text style={styles.time}>{timeAgo(ts)}</Text>}
                </View>
                <Text style={styles.body}>{message}</Text>
              </View>
            );
          })}
        </ScrollView>
      )}
      <Toast />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 24, paddingTop: 60 },
  pageTitle: { fontSize: 28, fontWeight: '700', color: '#0f172a', marginBottom: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 100 },
  emptyText: { color: '#94a3b8', fontSize: 15, fontWeight: '500', textAlign: 'center', paddingHorizontal: 20 },
  card: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#f1f5f9' },
  cardUnread: { borderColor: '#bfdbfe', backgroundColor: '#f5f9ff' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  typeLabel: { fontSize: 12, fontWeight: '800', color: '#475569', flex: 1 },
  time: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
  body: { fontSize: 14, color: '#334155', lineHeight: 20 },
});
