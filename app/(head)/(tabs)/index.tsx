import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, AppState, AppStateStatus, ScrollView, RefreshControl, Keyboard, TouchableWithoutFeedback } from 'react-native';
import * as Location from 'expo-location';
import Toast from 'react-native-toast-message';
import { useQuery } from '@tanstack/react-query';
import { api, getApiErrorMessage } from '@/api/axios'; 
import { useAuthStore } from '@/store/authStore'; 

 // Put this right above your RootLayout function
 

export default function App() {
  const { user, logout } = useAuthStore(); 

  // Local Form States
  const [showCheckInForm, setShowCheckInForm] = useState(false);
  const [lateReason, setLateReason] = useState('');
  const [showCheckOutForm, setShowCheckOutForm] = useState(false);
  const [taskHeading, setTaskHeading] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // const queryClient = new QueryClient();

  // --- 1. TANSTACK QUERY: FETCH TODAY'S STATUS ---
  const fetchStatusFn = async () => {
    if (!user?.id) return null;
    const response = await api.get(`/fill/get_emp_status?userId=${user.id}`);
    
    // Parse the response into a clean, strictly-typed state object
    if (response.status === 202) {
      return { isPresent: false, isShiftCompleted: false, checkInTime: null, checkOutTime: null };
    } 
    if (response.status === 203) {
      return { isPresent: true, isShiftCompleted: false, checkInTime: response.data?.data?.In_Time || null, checkOutTime: null };
    } 
    if (response.status === 200 && response.data?.data) {
      const record = response.data.data;
      if (record.Out_time && record.Out_time !== "") {
        return { isPresent: false, isShiftCompleted: true, checkInTime: record.In_Time || null, checkOutTime: record.Out_time };
      } else {
        return { isPresent: true, isShiftCompleted: false, checkInTime: record.In_Time || null, checkOutTime: null };
      }
    }
    return { isPresent: false, isShiftCompleted: false, checkInTime: null, checkOutTime: null };
  };

  const { 
    data: statusData, 
    isLoading: isStatusLoading, 
    isRefetching, 
    refetch 
  } = useQuery({
    queryKey: ['todayStatus', user?.id],
    queryFn: fetchStatusFn,
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 60, // Data is fresh for 3600 seconds (1 Hour)
  });

  // Derived state from TanStack cache
  const isPresent = statusData?.isPresent || false;
  const isShiftCompleted = statusData?.isShiftCompleted || false;
  const checkInTime = statusData?.checkInTime;
  const checkOutTime = statusData?.checkOutTime;

  // --- 2. FOREGROUND APP STATE LISTENER ---
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        refetch(); // Automatically refetch when user opens app from background
      }
    });
    return () => subscription.remove();
  }, [refetch]);

  // --- HELPER LOGIC ---
  const isCurrentlyLate = () => {
    const now = new Date();
    return (now.getHours() * 60 + now.getMinutes()) > (9 * 60);
  };

  const getTodayDateString = () => {
    return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  };

  const fetchCurrentLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({ type: 'error', text1: 'Permission denied', text2: 'Location access is required.' });
      return null;
    }
    try {
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      return location.coords;
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Location Error', text2: 'Could not fetch current location.' });
      return null;
    }
  };

  // --- ACTIONS ---
  const handleConfirmCheckIn = async () => {
    setIsSubmitting(true);
    const coords = await fetchCurrentLocation();
    
    if (coords) {
      const now = new Date();
      const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

      try {
        const response = await api.post('/fill/in-time', {
          lat: coords.latitude, lng: coords.longitude, time: timeString, userId: user?.id
        });

        setShowCheckInForm(false);
        setLateReason('');
        await refetch(); // Instantly sync UI with backend via TanStack
        
        Toast.show({ 
          type: response.data.isOutside ? 'info' : 'success', 
          text1: response.data.isOutside ? 'Notice' : 'Checked In', 
          text2: response.data.isOutside ? 'Attendance marked outside premises.' : 'Have a great workday!' 
        });
      } catch (error: any) {
        Toast.show({ type: 'error', text1: 'Check In Failed', text2: getApiErrorMessage(error) });
      }
    }
    setIsSubmitting(false);
  };

  const handleConfirmCheckOut = async () => {
    if (!taskHeading.trim() || !taskDescription.trim()) {
      Toast.show({ type: 'error', text1: 'Missing Details', text2: 'Please log your daily tasks.' });
      return;
    }

    setIsSubmitting(true);
    const coords = await fetchCurrentLocation();

    if (coords) {
      const now = new Date();
      const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

      try {
        const response = await api.post('/fill/out-time', {
          lat: coords.latitude, lng: coords.longitude, time: timeString,
          task: taskHeading, T_reason: lateReason, remarks: taskDescription, userId: user?.id
        });

        setShowCheckOutForm(false);
        setTaskHeading('');
        setTaskDescription('');
        await refetch(); // Sync UI
        
        const totalHours = response.data.attendance?.total_hours || 'your shift';
        Toast.show({ 
          type: response.data.isOutside ? 'info' : 'success', 
          text1: 'Shift Ended', 
          text2: response.data.isOutside ? `Logged ${totalHours}. (Outside Premises)` : `You logged ${totalHours} today.` 
        });
      } catch (error: any) {
        Toast.show({ type: 'error', text1: 'Check Out Failed', text2: getApiErrorMessage(error) });
      }
    }
    setIsSubmitting(false);
  };

  if (isStatusLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Syncing Dashboard...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* 3. KEYBOARD DISMISSAL WRAPPER */}
      {/* <TouchableWithoutFeedback onPress={Keyboard.dismiss}> */}
        <View style={styles.innerContainer}>
          
          <View style={styles.header}>
            <View>
              <Text style={styles.dateText}>{getTodayDateString()}</Text>
              <Text style={styles.greeting}>Hello Head, {user?.Name || 'Employee'}</Text>
            </View>
            <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>

          {/* 4. SCROLL VIEW WITH PULL-TO-REFRESH */}
<ScrollView 
  style={{ flex: 1 }} // FIXED: Tells the ScrollView to take up the whole screen
  showsVerticalScrollIndicator={false}
  keyboardShouldPersistTaps="handled"
  keyboardDismissMode="on-drag"
  refreshControl={<RefreshControl refreshing={isRefetching && !isStatusLoading} onRefresh={refetch} tintColor="#3b82f6" />}
  contentContainerStyle={styles.scrollContent}
>
            {/* PREMIUM STATUS DASHBOARD CARD */}
            <View style={styles.statusCard}>
              <View style={styles.statusHeaderRow}>
                <Text style={styles.cardTitle}>TODAY'S SHIFT</Text>
                <View style={[styles.statusDot, { backgroundColor: isPresent ? '#10b981' : isShiftCompleted ? '#3b82f6' : '#94a3b8' }]} />
              </View>
              
              <Text style={[styles.statusMainText, { color: isPresent ? '#10b981' : isShiftCompleted ? '#3b82f6' : '#64748b' }]}>
                {isShiftCompleted ? 'Shift Completed' : isPresent ? 'Active Check-In' : 'Currently Offline'}
              </Text>

              <View style={styles.timeGrid}>
                <View style={styles.timeBlock}>
                  <Text style={styles.timeLabel}>CHECK IN</Text>
                  <Text style={styles.timeValue}>{checkInTime || '-- : --'}</Text>
                </View>
                <View style={styles.timeDivider} />
                <View style={styles.timeBlock}>
                  <Text style={styles.timeLabel}>CHECK OUT</Text>
                  <Text style={styles.timeValue}>{checkOutTime || '-- : --'}</Text>
                </View>
              </View>
            </View>

            {/* ACTION BUTTONS & FORMS */}
            {!isPresent && !isShiftCompleted && !showCheckInForm && (
              <TouchableOpacity style={styles.primaryBtn} onPress={() => isCurrentlyLate() ? setShowCheckInForm(true) : handleConfirmCheckIn()} disabled={isSubmitting}>
                {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Check In Now</Text>}
              </TouchableOpacity>
            )}

            {!isPresent && !isShiftCompleted && showCheckInForm && (
              <View style={styles.formContainer}>
                <Text style={styles.formTitle}>Late Arrival Log</Text>
                <TextInput style={styles.input} placeholderTextColor="#94a3b8" placeholder="Reason for late arrival (Optional)" value={lateReason} onChangeText={setLateReason} />
                <TouchableOpacity style={styles.primaryBtn} onPress={handleConfirmCheckIn} disabled={isSubmitting}>
                  {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Confirm Check In</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCheckInForm(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}

            {isPresent && !showCheckOutForm && (
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setShowCheckOutForm(true)}>
                <Text style={styles.btnText}>Check Out Shift</Text>
              </TouchableOpacity>
            )}

            {isPresent && showCheckOutForm && (
              <View style={styles.formContainer}>
                <Text style={styles.formTitle}>Daily Task Log</Text>
                <TextInput style={styles.input} placeholderTextColor="#94a3b8" placeholder="Main Task (e.g., App UI)" value={taskHeading} onChangeText={setTaskHeading} />
                <TextInput style={[styles.input, styles.textArea]} placeholderTextColor="#94a3b8" placeholder="Brief description of work done..." value={taskDescription} onChangeText={setTaskDescription} multiline={true} />
                <TouchableOpacity style={styles.secondaryBtn} onPress={handleConfirmCheckOut} disabled={isSubmitting}>
                  {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Submit & Check Out</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCheckOutForm(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

        </View>
      {/* </TouchableWithoutFeedback> */}
      <Toast />
    </KeyboardAvoidingView>
  );
}

// --- MINIMAL PREMIUM STYLES ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  innerContainer: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  loadingText: { marginTop: 12, color: '#64748b', fontSize: 15, fontWeight: '500' },
  
  header: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  dateText: { fontSize: 13, textTransform: 'uppercase', color: '#94a3b8', fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  greeting: { fontSize: 26, fontWeight: '800', color: '#0f172a' },
  logoutBtn: { backgroundColor: '#fee2e2', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  logoutText: { color: '#dc2626', fontWeight: '700', fontSize: 13 },

  scrollContent: { 
    padding: 24, 
    paddingBottom: 80, 
    flexGrow: 1 // FIXED: Makes the empty background space swipeable!
  },

  statusCard: { backgroundColor: '#ffffff', padding: 24, borderRadius: 20, shadowColor: '#64748b', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 5, marginBottom: 32, borderWidth: 1, borderColor: '#f1f5f9' },
  statusHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 13, color: '#94a3b8', fontWeight: '800', letterSpacing: 1.2 },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  statusMainText: { fontSize: 28, fontWeight: '800', marginBottom: 24 },
  
  timeGrid: { flexDirection: 'row', backgroundColor: '#f8fafc', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#f1f5f9' },
  timeBlock: { flex: 1 },
  timeDivider: { width: 1, backgroundColor: '#e2e8f0', marginHorizontal: 16 },
  timeLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '700', marginBottom: 4, letterSpacing: 0.5 },
  timeValue: { fontSize: 18, color: '#0f172a', fontWeight: '700' },

  primaryBtn: { backgroundColor: '#3b82f6', paddingVertical: 18, borderRadius: 16, alignItems: 'center', shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12 },
  secondaryBtn: { backgroundColor: '#0f172a', paddingVertical: 18, borderRadius: 16, alignItems: 'center', shadowColor: '#0f172a', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 12 },
  btnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },

  formContainer: { backgroundColor: '#ffffff', padding: 24, borderRadius: 20, borderWidth: 1, borderColor: '#f1f5f9' },
  formTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 20 },
  input: { backgroundColor: '#f8fafc', color: '#0f172a', borderRadius: 12, padding: 16, marginBottom: 16, fontSize: 15, borderWidth: 1, borderColor: '#e2e8f0' },
  textArea: { height: 120, textAlignVertical: 'top' },
  cancelBtn: { marginTop: 20, alignItems: 'center' },
  cancelBtnText: { color: '#64748b', fontSize: 15, fontWeight: '600' }
});