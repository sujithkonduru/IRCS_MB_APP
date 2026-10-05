import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import Toast from 'react-native-toast-message';
import { api, getApiErrorMessage } from '@/api/axios';
import { useAuthStore } from '@/store/authStore';

type FilterType = 'today' | 'week' | 'month' | 'all';

interface AttendanceRecord {
  _id: string;
  In_Time: string;
  Out_time?: string;
  total_hours?: string;
  Todays_Task?: string;
  createdAt: string;
}

export default function LogsScreen() {
  const { user } = useAuthStore();
  
  // UI States
  const [filter, setFilter] = useState<FilterType>('all');
  const [logs, setLogs] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState({ totalDays: 0, totalHours: '0h 0m', avgPerDay: '0h 0m' });
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // --- FETCH ATTENDANCE LOGS ---
  const fetchLogs = async (currentFilter: FilterType) => {
    if (!user?.id) return;
    
    // Set root loading flag only on initial loads, skip on background refresh pull
    if (!refreshing) setIsLoading(true);

    try {
      const response = await api.post('/api/hr/getAttendance', {
        userId: user.id,
        filter: currentFilter
      });

      if (response.data.success) {
        console.log(logs)
        setLogs(response.data.attendance || []);
        setStats({
          totalDays: response.data.total_days || 0,
          totalHours: response.data.total_hours || '0h 0m',
          avgPerDay: response.data.avg_per_day || '0h 0m'
        });
      }
    } catch (error: any) {
      // Clear logs state if no entries found for that specific filter range
      if (error.response?.status === 404) {
        setLogs([]);
        setStats({ totalDays: 0, totalHours: '0h 0m', avgPerDay: '0h 0m' });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Fetch Failed',
          text2: getApiErrorMessage(error)
        });
      }
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  // Run data fetch whenever user selects a different filter tab
  useEffect(() => {
    fetchLogs(filter);
  }, [filter]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchLogs(filter);
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.pageTitle}>My Attendance Logs</Text>

      {/* --- SEGMENTED FILTER CONTROL TAB BAR --- */}
      <View style={styles.filterBar}>
        {(['today', 'week', 'month', 'all'] as FilterType[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.filterTab, filter === tab && styles.activeFilterTab]}
            onPress={() => setFilter(tab)}
          >
            <Text style={[styles.filterTabText, filter === tab && styles.activeFilterTabText]}>
              {tab.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* --- REAL-TIME STATS GRID PANEL --- */}
      <View style={styles.statsCard}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Total Days</Text>
          <Text style={styles.statValue}>{stats.totalDays}</Text>
        </View>
        <View style={[styles.statBox, styles.centerStatBox]}>
          <Text style={styles.statLabel}>Worked</Text>
          <Text style={styles.statValue}>{stats.totalHours}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Daily Avg</Text>
          <Text style={styles.statValue}>{stats.avgPerDay}</Text>
        </View>
      </View>

      {/* --- MAIN LOGS RENDER AREA --- */}
      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : logs.length === 0 ? (
        <ScrollView 
          contentContainerStyle={styles.emptyContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          <Text style={styles.emptyText}>No logs found for this period.</Text>
        </ScrollView>
      ) : (
        <ScrollView 
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          {logs.map((log) => (
            <View key={log._id} style={styles.logCard}>
              <View style={styles.logHeader}>
                <Text style={styles.logDate}>{formatDate(log.createdAt)}</Text>
                <Text style={[
  styles.logHours, 
  !log.Out_time && { color: '#10b981' } // Make it green if they are still clocked in!
]}>
  {log.Out_time ? (log.total_hours || 'Absent') : 'Active Now'}
</Text>
              </View>
              <View style={styles.logDetails}>
                <Text style={styles.logTime}>
                  In: {log.In_Time}  |  Out: {log.Out_time || 'Active Now'}
                </Text>
                <Text style={styles.logTask}>
                  {log.Todays_Task || 'No task logged yet for this shift.'}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
      <Toast />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 24,
    paddingTop: 60,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 20,
  },
  filterBar: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeFilterTab: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  activeFilterTabText: {
    color: '#3b82f6',
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  centerStatBox: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#f1f5f9',
  },
  statLabel: {
    fontSize: 12,
    color: '#94a3b8',
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  logCard: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 12,
  },
  logDate: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  logHours: {
    fontSize: 15,
    fontWeight: '700',
    color: '#3b82f6',
  },
  logDetails: {},
  logTime: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 6,
    fontWeight: '500',
  },
  logTask: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '500',
  },
});