// app/(employee)/profile/index.tsx

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '@/store/authStore';
import {
  useProfile,
  useEmployeeStatus,
} from '@/hooks/useEmployeeApi';
import Toast from 'react-native-toast-message';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  // =========================================================
  // PROFILE API
  // =========================================================

  const {
    data: profileResponse,
    isLoading: profileLoading,
    isError: profileError,
    refetch: refetchProfile,
    isRefetching: profileRefetching,
  } = useProfile();

  // =========================================================
  // EMPLOYEE STATUS API
  //
  // This API contains:
  //
  // employee.shift.name
  // employee.shift.start_time
  // employee.shift.end_time
  //
  // =========================================================

  const {
    data: statusResponse,
    isLoading: statusLoading,
    isError: statusError,
    refetch: refetchStatus,
    isRefetching: statusRefetching,
  } = useEmployeeStatus();

  // =========================================================
  // DEBUG LOG
  // =========================================================

  console.log(
    '📋 PROFILE API RESPONSE:',
    JSON.stringify(profileResponse, null, 2)
  );

  console.log(
    '📋 EMPLOYEE STATUS RESPONSE:',
    JSON.stringify(statusResponse, null, 2)
  );

  // =========================================================
  // EXTRACT PROFILE DATA
  // =========================================================

  /*
   * Profile API may return the employee object directly.
   *
   * Employee Status API returns:
   *
   * {
   *   success: true,
   *   employee: {
   *      ...
   *      shift: {
   *         name: "General Shift",
   *         start_time: "09:00:00",
   *         end_time: "17:00:00"
   *      }
   *   }
   * }
   */

  const statusEmployee =
    statusResponse?.employee || {};

  const profileApiData =
    profileResponse || {};

  // =========================================================
  // MERGE PROFILE + STATUS DATA
  // =========================================================

  /*
   * Priority:
   *
   * 1. Employee Status API
   * 2. Profile API
   * 3. Authenticated user
   *
   * This is important because the status API definitely contains
   * the current shift information.
   */

  const profileData: any = {
    ...(user || {}),
    ...(profileApiData || {}),
    ...(statusEmployee || {}),
    shift:
      statusEmployee?.shift ??
      profileApiData?.shift ??
      user?.shift ??
      null,
  };

  console.log(
    '✅ FINAL PROFILE DATA:',
    JSON.stringify(profileData, null, 2)
  );

  // =========================================================
  // FULL NAME
  // =========================================================

  const getFullName = () => {
    if (profileData?.full_name) {
      return String(profileData.full_name).trim();
    }

    if (
      profileData?.first_name &&
      profileData?.last_name
    ) {
      return `${profileData.first_name} ${profileData.last_name}`.trim();
    }

    if (profileData?.first_name) {
      return String(profileData.first_name);
    }

    if (profileData?.name) {
      return String(profileData.name);
    }

    return 'Employee';
  };

  const fullName = getFullName();

  // =========================================================
  // INITIALS
  // =========================================================

  const initials =
    fullName
      .split(' ')
      .filter(Boolean)
      .map((name: string) => name.charAt(0))
      .join('')
      .substring(0, 2)
      .toUpperCase() || 'E';

  // =========================================================
  // FORMAT TIME
  // =========================================================

  const formatTime = (time?: string | null) => {
    if (!time) {
      return 'Not Assigned';
    }

    try {
      const value = String(time).trim();

      /*
       * Handles:
       *
       * 09:00:00
       * 17:00:00
       * 09:30
       * 17:30
       */

      const parts = value.split(':');

      if (parts.length < 2) {
        return value;
      }

      const hours = Number(parts[0]);
      const minutes = Number(parts[1]);

      if (
        Number.isNaN(hours) ||
        Number.isNaN(minutes)
      ) {
        return value;
      }

      const hour12 = hours % 12 || 12;
      const ampm = hours >= 12 ? 'PM' : 'AM';

      return `${hour12}:${String(minutes).padStart(
        2,
        '0'
      )} ${ampm}`;
    } catch {
      return String(time);
    }
  };

  // =========================================================
  // FORMAT DATE
  // =========================================================

  const formatDate = (dateString?: string | null) => {
    if (!dateString) {
      return 'Not Specified';
    }

    try {
      const date = new Date(dateString);

      if (Number.isNaN(date.getTime())) {
        return String(dateString);
      }

      return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return String(dateString);
    }
  };

  // =========================================================
  // SHIFT DETAILS
  // =========================================================

  /*
   * IMPORTANT:
   *
   * The get_emp_status API response is:
   *
   * statusResponse.employee.shift
   *
   * NOT:
   *
   * statusResponse.shift
   *
   */

  const shift = profileData?.shift;

  const getShiftName = () => {
    if (!shift) {
      return 'Not Assigned';
    }

    if (typeof shift === 'string') {
      return shift;
    }

    if (
      typeof shift === 'object' &&
      shift?.name
    ) {
      return String(shift.name);
    }

    return 'Not Assigned';
  };

  // =========================================================
  // SHIFT START TIME
  // =========================================================

  const shiftStartRaw =
    shift?.start_time ??
    profileData?.start_time ??
    null;

  // =========================================================
  // SHIFT END TIME
  // =========================================================

  const shiftEndRaw =
    shift?.end_time ??
    profileData?.end_time ??
    null;

  // =========================================================
  // SHIFT GRACE PERIOD
  // =========================================================

  const shiftGracePeriod =
    shift?.grace_period_minutes ?? null;

  const shiftName = getShiftName();

  const shiftStartTime = formatTime(
    shiftStartRaw
  );

  const shiftEndTime = formatTime(
    shiftEndRaw
  );

  const hasShiftTiming =
    Boolean(shiftStartRaw) ||
    Boolean(shiftEndRaw) ||
    Boolean(shift);

  // =========================================================
  // REFRESH
  // =========================================================

  const handleRefresh = async () => {
    try {
      await Promise.all([
        refetchProfile(),
        refetchStatus(),
      ]);
    } catch (error) {
      console.error(
        'Profile refresh error:',
        error
      );
    }
  };

  const isRefetching =
    profileRefetching || statusRefetching;

  // =========================================================
  // LOGOUT
  // =========================================================

  const handleLogout = async () => {
    try {
      await logout();

      router.replace('/(login)');

      Toast.show({
        type: 'success',
        text1: 'Logged Out',
        text2:
          'You have been logged out successfully.',
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Logout Failed',
        text2:
          'Could not logout. Please try again.',
      });
    }
  };

  // =========================================================
  // PROFILE FIELDS
  // =========================================================

  const profileFields = [
    {
      label: 'Employee Name',
      value: fullName,
      icon: 'person-outline' as const,
    },
    {
      label: 'Employee Code',
      value:
        profileData?.employee_code || '—',
      icon: 'id-card-outline' as const,
    },
    {
      label: 'Email',
      value:
        profileData?.email || '—',
      icon: 'mail-outline' as const,
    },
    {
      label: 'Mobile',
      value:
        profileData?.mobile ||
        profileData?.phone ||
        '—',
      icon: 'call-outline' as const,
    },
    {
      label: 'Role',
      value:
        profileData?.role || '—',
      icon: 'briefcase-outline' as const,
    },
    {
      label: 'Department',
      value:
        profileData?.department || '—',
      icon: 'business-outline' as const,
    },
    {
      label: 'Designation',
      value:
        profileData?.designation || '—',
      icon: 'ribbon-outline' as const,
    },
    {
      label: 'Shift',
      value: shiftName,
      icon: 'time-outline' as const,
    },
    {
      label: 'Employment Type',
      value:
        profileData?.employment_type ||
        'Not Specified',
      icon: 'briefcase-outline' as const,
    },
    {
      label: 'Joining Date',
      value: formatDate(
        profileData?.joining_date
      ),
      icon: 'calendar-outline' as const,
    },
    {
      label: 'Gender',
      value:
        profileData?.gender ||
        'Not Specified',
      icon: 'male-female-outline' as const,
    },
    {
      label: 'Date of Birth',
      value: formatDate(
        profileData?.date_of_birth
      ),
      icon: 'calendar-outline' as const,
    },
    {
      label: 'Salary',
      value: profileData?.salary
        ? `₹${profileData.salary}`
        : 'Not Specified',
      icon: 'cash-outline' as const,
    },
  ];

  // =========================================================
  // STATUS ITEMS
  // =========================================================

  const statusItems = [
    {
      label: 'Verified',
      value: profileData?.verified
        ? 'Yes'
        : 'No',
      icon: 'checkmark-circle-outline',
      color: profileData?.verified
        ? '#10b981'
        : '#ef4444',
    },
    {
      label: 'Profile Complete',
      value: profileData?.profile_completed
        ? 'Yes'
        : 'No',
      icon: 'person-outline',
      color: profileData?.profile_completed
        ? '#10b981'
        : '#f59e0b',
    },
    {
      label: 'Face Embedding',
      value: profileData?.embedding_got
        ? 'Yes'
        : 'No',
      icon: 'scan-outline',
      color: profileData?.embedding_got
        ? '#10b981'
        : '#f59e0b',
    },
    {
      label: 'Status',
      value: profileData?.status
        ? 'Active'
        : 'Inactive',
      icon: 'radio-button-on-outline',
      color: profileData?.status
        ? '#10b981'
        : '#ef4444',
    },
  ];

  // =========================================================
  // LOADING
  // =========================================================

  if (
    profileLoading &&
    statusLoading &&
    !user
  ) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
          color="#3b82f6"
        />

        <Text style={styles.loadingText}>
          Loading profile...
        </Text>
      </View>
    );
  }

  // =========================================================
  // UI
  // =========================================================

  return (
    <View style={styles.container}>

      {/* ================================================= */}
      {/* HEADER */}
      {/* ================================================= */}

      <View style={styles.header}>
        <Text style={styles.pageTitle}>
          My Profile
        </Text>

        <TouchableOpacity
          onPress={handleRefresh}
          style={styles.refreshBtn}
          disabled={isRefetching}
        >
          <Ionicons
            name={
              isRefetching
                ? 'refresh'
                : 'refresh-outline'
            }
            size={24}
            color="#3b82f6"
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 60,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
          />
        }
      >

        {/* ================================================= */}
        {/* AVATAR CARD */}
        {/* ================================================= */}

        <LinearGradient
          colors={[
            '#ffffff',
            '#f8fafc',
          ]}
          style={styles.avatarCard}
          start={{
            x: 0,
            y: 0,
          }}
          end={{
            x: 1,
            y: 1,
          }}
        >

          <LinearGradient
            colors={[
              '#3b82f6',
              '#8b5cf6',
            ]}
            style={styles.avatarCircle}
            start={{
              x: 0,
              y: 0,
            }}
            end={{
              x: 1,
              y: 1,
            }}
          >
            <Text
              style={styles.avatarInitial}
            >
              {initials}
            </Text>
          </LinearGradient>

          <Text
            style={styles.avatarName}
          >
            {fullName}
          </Text>

          <Text
            style={styles.avatarRole}
          >
            {profileData?.designation ||
              profileData?.role ||
              'Employee'}
          </Text>

          {profileData?.employee_code && (
            <Text
              style={styles.avatarCode}
            >
              ID: {profileData.employee_code}
            </Text>
          )}

          {/* VERIFIED */}

          {profileData?.verified && (
            <View
              style={styles.verifiedBadge}
            >
              <Ionicons
                name="checkmark-circle"
                size={16}
                color="#10b981"
              />

              <Text
                style={styles.verifiedText}
              >
                Verified
              </Text>
            </View>
          )}

          {/* STATUS */}

          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  profileData?.status
                    ? '#d1fae5'
                    : '#fee2e2',
              },
            ]}
          >
            <Ionicons
              name={
                profileData?.status
                  ? 'checkmark-circle'
                  : 'close-circle'
              }
              size={16}
              color={
                profileData?.status
                  ? '#059669'
                  : '#dc2626'
              }
            />

            <Text
              style={[
                styles.statusBadgeText,
                {
                  color:
                    profileData?.status
                      ? '#059669'
                      : '#dc2626',
                },
              ]}
            >
              {profileData?.status
                ? 'Active'
                : 'Inactive'}
            </Text>
          </View>
        </LinearGradient>

        {/* ================================================= */}
        {/* ERROR BANNER */}
        {/* ================================================= */}

        {(profileError || statusError) && (
          <View
            style={styles.errorBanner}
          >
            <Ionicons
              name="alert-circle-outline"
              size={20}
              color="#92400e"
            />

            <Text
              style={styles.errorText}
            >
              Some live profile information
              could not be synchronized.
            </Text>
          </View>
        )}

        {/* ================================================= */}
        {/* STATUS CARDS */}
        {/* ================================================= */}

        <View
          style={styles.statusGrid}
        >
          {statusItems.map((item) => (
            <View
              key={item.label}
              style={[
                styles.statusCard,
                {
                  borderColor:
                    item.color + '30',
                },
              ]}
            >
              <Ionicons
                name={item.icon as any}
                size={24}
                color={item.color}
              />

              <Text
                style={[
                  styles.statusValue,
                  {
                    color: item.color,
                  },
                ]}
              >
                {item.value}
              </Text>

              <Text
                style={styles.statusLabel}
              >
                {item.label}
              </Text>
            </View>
          ))}
        </View>

        {/* ================================================= */}
        {/* CURRENT SHIFT */}
        {/* ================================================= */}

        {hasShiftTiming && (
          <View
            style={
              styles.shiftHighlightCard
            }
          >

            {/* SHIFT HEADER */}

            <View
              style={
                styles.shiftHighlightHeader
              }
            >
              <Ionicons
                name="time-outline"
                size={22}
                color="#3b82f6"
              />

              <Text
                style={
                  styles.shiftHighlightTitle
                }
              >
                Current Shift
              </Text>
            </View>

            <View
              style={
                styles.shiftHighlightContent
              }
            >

              {/* SHIFT NAME */}

              <View
                style={
                  styles.shiftHighlightItem
                }
              >
                <View
                  style={
                    styles.shiftTimeLabelContainer
                  }
                >
                  <Ionicons
                    name="briefcase-outline"
                    size={18}
                    color="#64748b"
                  />

                  <Text
                    style={
                      styles.shiftHighlightLabel
                    }
                  >
                    Shift Name
                  </Text>
                </View>

                <Text
                  style={
                    styles.shiftHighlightValue
                  }
                >
                  {shiftName}
                </Text>
              </View>

              <View
                style={
                  styles.shiftHighlightDivider
                }
              />

              {/* FROM TIME */}

              <View
                style={
                  styles.shiftHighlightItem
                }
              >
                <View
                  style={
                    styles.shiftTimeLabelContainer
                  }
                >
                  <Ionicons
                    name="log-in-outline"
                    size={18}
                    color="#10b981"
                  />

                  <Text
                    style={
                      styles.shiftHighlightLabel
                    }
                  >
                    From Time
                  </Text>
                </View>

                <Text
                  style={
                    styles.shiftHighlightValue
                  }
                >
                  {shiftStartTime}
                </Text>
              </View>

              <View
                style={
                  styles.shiftHighlightDivider
                }
              />

              {/* TO TIME */}

              <View
                style={
                  styles.shiftHighlightItem
                }
              >
                <View
                  style={
                    styles.shiftTimeLabelContainer
                  }
                >
                  <Ionicons
                    name="log-out-outline"
                    size={18}
                    color="#ef4444"
                  />

                  <Text
                    style={
                      styles.shiftHighlightLabel
                    }
                  >
                    To Time
                  </Text>
                </View>

                <Text
                  style={
                    styles.shiftHighlightValue
                  }
                >
                  {shiftEndTime}
                </Text>
              </View>

              {/* GRACE PERIOD */}

              {shiftGracePeriod !== null && (
                <>
                  <View
                    style={
                      styles.shiftHighlightDivider
                    }
                  />

                  <View
                    style={
                      styles.shiftHighlightItem
                    }
                  >
                    <View
                      style={
                        styles.shiftTimeLabelContainer
                      }
                    >
                      <Ionicons
                        name="timer-outline"
                        size={18}
                        color="#f59e0b"
                      />

                      <Text
                        style={
                          styles.shiftHighlightLabel
                        }
                      >
                        Grace Period
                      </Text>
                    </View>

                    <Text
                      style={
                        styles.shiftHighlightValue
                      }
                    >
                      {shiftGracePeriod} minutes
                    </Text>
                  </View>
                </>
              )}

            </View>
          </View>
        )}

        {/* ================================================= */}
        {/* PROFILE DETAILS */}
        {/* ================================================= */}

        <View
          style={styles.detailsCard}
        >
          {profileFields.map(
            (field, index) => (
              <View
                key={field.label}
                style={[
                  styles.row,
                  index ===
                    profileFields.length - 1 &&
                    styles.rowLast,
                ]}
              >
                <View
                  style={styles.rowLeft}
                >
                  <Ionicons
                    name={field.icon}
                    size={18}
                    color="#64748b"
                    style={
                      styles.rowIcon
                    }
                  />

                  <Text
                    style={styles.rowLabel}
                  >
                    {field.label}
                  </Text>
                </View>

                <Text
                  style={styles.rowValue}
                >
                  {field.value}
                </Text>
              </View>
            )
          )}
        </View>

        {/* ================================================= */}
        {/* LOGOUT */}
        {/* ================================================= */}

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
        >
          <Ionicons
            name="log-out-outline"
            size={20}
            color="#dc2626"
          />

          <Text
            style={styles.logoutText}
          >
            Logout
          </Text>
        </TouchableOpacity>

        <Text
          style={styles.versionText}
        >
          Version 1.0.0
        </Text>

      </ScrollView>

      <Toast />
    </View>
  );
}

// ===========================================================
// STYLES
// ===========================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 24,
    paddingTop: 60,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },

  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
  },

  refreshBtn: {
    padding: 8,
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    marginTop: 12,
    color: '#64748b',
    fontSize: 14,
  },

  // =========================================================
  // AVATAR
  // =========================================================

  avatarCard: {
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#64748b',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  avatarCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#3b82f6',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },

  avatarInitial: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
  },

  avatarName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },

  avatarRole: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 2,
  },

  avatarCode: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },

  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
    gap: 4,
  },

  verifiedText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600',
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
    gap: 4,
  },

  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // =========================================================
  // ERROR
  // =========================================================

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },

  errorText: {
    color: '#92400e',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },

  // =========================================================
  // STATUS
  // =========================================================

  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },

  statusCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#64748b',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },

  statusValue: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },

  statusLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 2,
  },

  // =========================================================
  // SHIFT
  // =========================================================

  shiftHighlightCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#3b82f6',
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#3b82f6',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },

  shiftHighlightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 8,
  },

  shiftHighlightTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e40af',
  },

  shiftHighlightContent: {
    padding: 16,
  },

  shiftHighlightItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  shiftTimeLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  shiftHighlightLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },

  shiftHighlightValue: {
    fontSize: 15,
    color: '#0f172a',
    fontWeight: '700',
  },

  shiftHighlightDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 10,
  },

  // =========================================================
  // DETAILS
  // =========================================================

  detailsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 16,
    overflow: 'hidden',
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },

  rowLast: {
    borderBottomWidth: 0,
  },

  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  rowIcon: {
    marginRight: 10,
  },

  rowLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
    flex: 1,
  },

  rowValue: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '700',
    maxWidth: '55%',
    textAlign: 'right',
    flexShrink: 1,
  },

  // =========================================================
  // LOGOUT
  // =========================================================

  logoutBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fee2e2',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
  },

  logoutText: {
    color: '#dc2626',
    fontWeight: '700',
    fontSize: 15,
  },

  versionText: {
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 12,
  },
});