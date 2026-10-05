// app/(employee)/(tabs)/more.tsx

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type MoreItem = {
  label: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
};

const ITEMS: MoreItem[] = [
  { label: 'Leave', subtitle: 'Apply for and track leave', icon: 'airplane-outline', route: '/leave' },
  { label: 'Permission', subtitle: 'Request time within your shift', icon: 'exit-outline', route: '/permissions' },
  { label: 'Alerts', subtitle: 'Notifications and updates', icon: 'notifications-outline', route: '/notifications' },
  { label: 'Profile', subtitle: 'Your account and settings', icon: 'person-outline', route: '/profile' },
];

export default function MoreScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>More</Text>

      {ITEMS.map((item) => (
        <TouchableOpacity
          key={item.route}
          style={styles.row}
          activeOpacity={0.7}
          onPress={() => router.push(item.route as any)}
        >
          <View style={styles.rowIcon}>
            <Ionicons name={item.icon} size={22} color="#3b82f6" />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>{item.label}</Text>
            <Text style={styles.rowSubtitle}>{item.subtitle}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 24, paddingTop: 60 },
  pageTitle: { fontSize: 28, fontWeight: '700', color: '#0f172a', marginBottom: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
  rowSubtitle: { fontSize: 12, color: '#64748b' },
});