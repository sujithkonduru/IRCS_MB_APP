// app/(auth)/register.tsx

import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  ActivityIndicator, ScrollView, KeyboardAvoidingView, 
  Platform, Modal, SafeAreaView, StatusBar 
} from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '@/store/authStore';
import { api, unwrap, getApiErrorMessage } from '@/api/axios';
import OTPModal from '@/components/OTPModal';

export default function RegisterScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  
  // Master Data State
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  
  // Dropdown visibility
  const [showDropdown, setShowDropdown] = useState<{ 
    type: 'department' | 'designation' | 'role' | 'shift' | null; 
    visible: boolean 
  }>({ type: null, visible: false });
  
  const [isFetchingMasterData, setIsFetchingMasterData] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  
  const { setPendingEmail, pendingEmail } = useAuthStore();

  const [formData, setFormData] = useState({
    employee_code: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    email: '',
    mobile: '',
    password: '',
    confirm_password: '',
    department_id: '',
    designation_id: '',
    role_id: '',
    shift_id: '',
    gender: '',
    date_of_birth: '',
    employment_type: '',
    joining_date: '',
    salary: ''
  });

  // --- FETCH MASTER DATA ---
  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const response = await api.get('/api/hr/get/master');
        const masterData = unwrap(response.data);
        
        if (masterData) {
          setDepartments(masterData.departments || []);
          setDesignations(masterData.designations || []);
          setRoles(masterData.roles || []);
          setShifts(masterData.shifts || []);
        }
      } catch (error: any) {
        Toast.show({ 
          type: 'error', 
          text1: 'Error', 
          text2: 'Failed to load required data' 
        });
      } finally {
        setIsFetchingMasterData(false);
      }
    };

    fetchMasterData();
  }, []);

  const validateForm = () => {
    const { 
      first_name, email, mobile, password, confirm_password,
      employee_code, department_id, designation_id, role_id, shift_id 
    } = formData;
    
    const missingFields = [];
    
    if (!employee_code.trim()) missingFields.push('Employee Code');
    if (!first_name.trim()) missingFields.push('First Name');
    if (!email.trim()) missingFields.push('Email');
    if (!mobile.trim()) missingFields.push('Mobile Number');
    if (!department_id) missingFields.push('Department');
    if (!designation_id) missingFields.push('Designation');
    if (!role_id) missingFields.push('Role');
    if (!shift_id) missingFields.push('Shift');
    if (!password.trim()) missingFields.push('Password');
    
    if (missingFields.length > 0) {
      Toast.show({ 
        type: 'error', 
        text1: 'Missing Required Fields', 
        text2: `Please fill: ${missingFields.join(', ')}`,
        visibilityTime: 5000
      });
      return false;
    }
    
    if (!email.includes('@') || !email.includes('.')) {
      Toast.show({ type: 'error', text1: 'Invalid Email', text2: 'Please enter a valid email address' });
      return false;
    }
    
    if (password.length < 6) {
      Toast.show({ type: 'error', text1: 'Weak Password', text2: 'Password must be at least 6 characters' });
      return false;
    }
    
    if (password !== confirm_password) {
      Toast.show({ type: 'error', text1: 'Password Mismatch', text2: 'Passwords do not match' });
      return false;
    }
    
    if (!agreeToTerms) {
      Toast.show({ type: 'error', text1: 'Terms Required', text2: 'Please agree to the terms and conditions' });
      return false;
    }
    
    return true;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const payload = {
        employee_code: formData.employee_code.trim().toUpperCase(),
        first_name: formData.first_name.trim(),
        middle_name: formData.middle_name.trim() || null,
        last_name: formData.last_name.trim() || null,
        gender: formData.gender || null,
        date_of_birth: formData.date_of_birth || null,
        email: formData.email.trim().toLowerCase(),
        mobile: formData.mobile.trim(),
        department_id: formData.department_id,
        designation_id: formData.designation_id,
        role_id: formData.role_id,
        shift_id: formData.shift_id,
        employment_type: formData.employment_type || null,
        joining_date: formData.joining_date || null,
        salary: formData.salary ? parseFloat(formData.salary) : null,
        password: formData.password
      };

      const response = await api.post('/createEmployee', payload);
      const responseData = unwrap(response.data);
      
      setPendingEmail(responseData.email || formData.email);
      
      Toast.show({ 
        type: 'success', 
        text1: 'Registration Successful', 
        text2: 'OTP sent to your email. Please verify.' 
      });
      
      setShowOtpModal(true);

    } catch (error: any) {
      console.error('Registration error:', error);

      const errorMessage = getApiErrorMessage(error);

      Toast.show({ 
        type: 'error', 
        text1: 'Registration Failed', 
        text2: errorMessage,
        visibilityTime: 5000
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getDisplayName = (item: any) => {
    return item?.role_name || item?.name || item?.Name || '';
  };

  const getIdAsString = (id: any) => {
    if (id === null || id === undefined) return '';
    return id.toString();
  };

  const renderDropdownItems = (items: any[], selectedId: string, onSelect: (id: string) => void) => {
    if (items.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={40} color="#94a3b8" />
          <Text style={styles.emptyText}>No items available</Text>
          <Text style={styles.emptySubText}>Please contact administrator</Text>
        </View>
      );
    }
    return items.map((item, index) => {
      const itemId = getIdAsString(item.id);
      const displayName = getDisplayName(item);
      const isSelected = selectedId === itemId;
      
      return (
        <TouchableOpacity 
          key={index} 
          style={[styles.dropdownItem, isSelected && styles.dropdownItemActive]}
          onPress={() => {
            onSelect(itemId);
            setShowDropdown({ type: null, visible: false });
          }}
        >
          <View style={styles.dropdownItemContent}>
            <Text style={[styles.dropdownItemText, isSelected && styles.dropdownItemTextActive]}>
              {displayName}
            </Text>
            {isSelected && (
              <Ionicons name="checkmark-circle" size={20} color="#3b82f6" />
            )}
          </View>
        </TouchableOpacity>
      );
    });
  };

  const renderField = (label: string, value: string, placeholder: string, setter: (val: string) => void, required: boolean = false, keyboardType: any = 'default') => (
    <View style={styles.fieldContainer}>
      <View style={styles.fieldLabelContainer}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {required && <Text style={styles.requiredStar}>*</Text>}
      </View>
      <TextInput
        style={[styles.fieldInput, required && styles.fieldInputRequired]}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        value={value}
        onChangeText={setter}
        keyboardType={keyboardType}
        autoCapitalize={label === 'Email' ? 'none' : label === 'Employee Code' ? 'characters' : 'sentences'}
      />
    </View>
  );

  const renderDropdownField = (label: string, value: string, type: 'department' | 'designation' | 'role' | 'shift', items: any[]) => {
    const getDisplayValue = () => {
      if (!value) return `Select ${label}`;
      const found = items.find(item => getIdAsString(item.id) === value);
      return found ? getDisplayName(found) : `Select ${label}`;
    };

    return (
      <View style={styles.fieldContainer}>
        <View style={styles.fieldLabelContainer}>
          <Text style={styles.fieldLabel}>{label}</Text>
          <Text style={styles.requiredStar}>*</Text>
        </View>
        <TouchableOpacity
          style={[styles.dropdownField, value && styles.dropdownFieldSelected]}
          onPress={() => setShowDropdown({ type, visible: true })}
          disabled={isFetchingMasterData}
        >
          {isFetchingMasterData ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#3b82f6" />
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
          ) : (
            <>
              <Text style={[styles.dropdownFieldText, value && styles.dropdownFieldTextSelected]}>
                {getDisplayValue()}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#94a3b8" />
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer} 
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#0f172a" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Create Account</Text>
            <View style={styles.headerSpacer} />
          </View>

          <Text style={styles.subtitle}>Fill in your details to get started</Text>

          {/* Progress Steps */}
          <View style={styles.progressContainer}>
            <View style={styles.progressStep}>
              <View style={[styles.progressDot, styles.progressDotActive]}>
                <Text style={styles.progressDotText}>1</Text>
              </View>
              <Text style={[styles.progressLabel, styles.progressLabelActive]}>Details</Text>
            </View>
            <View style={styles.progressLine} />
            <View style={styles.progressStep}>
              <View style={[styles.progressDot, styles.progressDotInactive]}>
                <Text style={styles.progressDotText}>2</Text>
              </View>
              <Text style={styles.progressLabel}>Verify</Text>
            </View>
            <View style={styles.progressLine} />
            <View style={styles.progressStep}>
              <View style={[styles.progressDot, styles.progressDotInactive]}>
                <Text style={styles.progressDotText}>3</Text>
              </View>
              <Text style={styles.progressLabel}>Complete</Text>
            </View>
          </View>

          {/* Personal Information Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="person-outline" size={20} color="#3b82f6" />
              <Text style={styles.sectionTitle}>Personal Information</Text>
            </View>
            
            {renderField('Employee Code', formData.employee_code, 'Enter employee code', (t) => setFormData({ ...formData, employee_code: t }), true)}
            {renderField('First Name', formData.first_name, 'Enter first name', (t) => setFormData({ ...formData, first_name: t }), true)}
            {renderField('Middle Name', formData.middle_name, 'Enter middle name (optional)', (t) => setFormData({ ...formData, middle_name: t }), false)}
            {renderField('Last Name', formData.last_name, 'Enter last name (optional)', (t) => setFormData({ ...formData, last_name: t }), false)}
            {renderField('Email', formData.email, 'Enter email address', (t) => setFormData({ ...formData, email: t }), true, 'email-address')}
            {renderField('Mobile Number', formData.mobile, 'Enter mobile number', (t) => setFormData({ ...formData, mobile: t }), true, 'phone-pad')}
            {renderField('Gender', formData.gender, 'Enter gender (optional)', (t) => setFormData({ ...formData, gender: t }), false)}
            {renderField('Date of Birth', formData.date_of_birth, 'YYYY-MM-DD (optional)', (t) => setFormData({ ...formData, date_of_birth: t }), false)}
          </View>

          {/* Employment Information Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="briefcase-outline" size={20} color="#3b82f6" />
              <Text style={styles.sectionTitle}>Employment Information</Text>
            </View>

            {renderDropdownField('Department', formData.department_id, 'department', departments)}
            {renderDropdownField('Designation', formData.designation_id, 'designation', designations)}
            {renderDropdownField('Role', formData.role_id, 'role', roles)}
            {renderDropdownField('Shift', formData.shift_id, 'shift', shifts)}
            {renderField('Employment Type', formData.employment_type, 'Enter employment type (optional)', (t) => setFormData({ ...formData, employment_type: t }), false)}
            {renderField('Joining Date', formData.joining_date, 'YYYY-MM-DD (optional)', (t) => setFormData({ ...formData, joining_date: t }), false)}
            {renderField('Salary', formData.salary, 'Enter salary (optional)', (t) => setFormData({ ...formData, salary: t }), false, 'numeric')}
          </View>

          {/* Security Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="lock-closed-outline" size={20} color="#3b82f6" />
              <Text style={styles.sectionTitle}>Security</Text>
            </View>

            <View style={styles.fieldContainer}>
              <View style={styles.fieldLabelContainer}>
                <Text style={styles.fieldLabel}>Password</Text>
                <Text style={styles.requiredStar}>*</Text>
              </View>
              <View style={[styles.passwordField, styles.fieldInputRequired]}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Enter password (min 6 characters)"
                  placeholderTextColor="#94a3b8"
                  value={formData.password}
                  onChangeText={(t) => setFormData({ ...formData, password: t })}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                  <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={22} color="#94a3b8" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.fieldContainer}>
              <View style={styles.fieldLabelContainer}>
                <Text style={styles.fieldLabel}>Confirm Password</Text>
                <Text style={styles.requiredStar}>*</Text>
              </View>
              <View style={[styles.passwordField, styles.fieldInputRequired]}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Confirm your password"
                  placeholderTextColor="#94a3b8"
                  value={formData.confirm_password}
                  onChangeText={(t) => setFormData({ ...formData, confirm_password: t })}
                  secureTextEntry={!showConfirmPassword}
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeButton}>
                  <Ionicons name={showConfirmPassword ? 'eye-off' : 'eye'} size={22} color="#94a3b8" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Terms and Conditions */}
          <TouchableOpacity 
            style={styles.termsContainer} 
            onPress={() => setAgreeToTerms(!agreeToTerms)}
          >
            <View style={[styles.checkbox, agreeToTerms && styles.checkboxChecked]}>
              {agreeToTerms && <Ionicons name="checkmark" size={16} color="#fff" />}
            </View>
            <Text style={styles.termsText}>
              I agree to the <Text style={styles.termsLink}>Terms & Conditions</Text> and <Text style={styles.termsLink}>Privacy Policy</Text>
            </Text>
          </TouchableOpacity>

          {/* Register Button */}
          <TouchableOpacity
            style={[styles.registerButton, (isLoading || isFetchingMasterData) && styles.registerButtonDisabled]}
            onPress={handleRegister}
            disabled={isLoading || isFetchingMasterData}
          >
            <LinearGradient
              colors={['#3b82f6', '#8b5cf6']}
              style={styles.registerButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={styles.registerButtonContent}>
                  <Text style={styles.registerButtonText}>Create Account</Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Login Link */}
          <TouchableOpacity style={styles.loginLink} onPress={() => router.back()}>
            <Text style={styles.loginLinkText}>
              Already have an account? <Text style={styles.loginLinkHighlight}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Dropdown Modal */}
        <Modal 
          visible={showDropdown.visible} 
          transparent 
          animationType="slide"
          onRequestClose={() => setShowDropdown({ type: null, visible: false })}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity 
              style={styles.modalBackdrop} 
              activeOpacity={1}
              onPress={() => setShowDropdown({ type: null, visible: false })}
            />
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select {showDropdown.type}</Text>
                <TouchableOpacity 
                  onPress={() => setShowDropdown({ type: null, visible: false })}
                  style={styles.modalCloseButton}
                >
                  <Ionicons name="close" size={24} color="#64748b" />
                </TouchableOpacity>
              </View>
              <View style={styles.modalDivider} />
              <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
                {showDropdown.type === 'department' && renderDropdownItems(departments, formData.department_id, (id) => setFormData({ ...formData, department_id: id }))}
                {showDropdown.type === 'designation' && renderDropdownItems(designations, formData.designation_id, (id) => setFormData({ ...formData, designation_id: id }))}
                {showDropdown.type === 'role' && renderDropdownItems(roles, formData.role_id, (id) => setFormData({ ...formData, role_id: id }))}
                {showDropdown.type === 'shift' && renderDropdownItems(shifts, formData.shift_id, (id) => setFormData({ ...formData, shift_id: id }))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        <OTPModal 
          visible={showOtpModal} 
          email={pendingEmail || formData.email} 
          onClose={() => setShowOtpModal(false)}
          onSuccess={() => {
            setShowOtpModal(false);
            router.replace('/login');
          }}
        />
        <Toast />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerSpacer: {
    width: 44,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 24,
  },
  
  // Progress Steps
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  progressStep: {
    alignItems: 'center',
  },
  progressDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  progressDotActive: {
    backgroundColor: '#3b82f6',
  },
  progressDotInactive: {
    backgroundColor: '#e2e8f0',
  },
  progressDotText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  progressLabel: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '500',
  },
  progressLabelActive: {
    color: '#3b82f6',
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 4,
  },

  // Sections
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },

  // Fields
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  requiredStar: {
    color: '#ef4444',
    marginLeft: 4,
    fontSize: 14,
  },
  fieldInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#0f172a',
  },
  fieldInputRequired: {
    borderColor: '#ef4444',
    borderWidth: 1.5,
  },
  
  // Password Field
  passwordField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#f5f4f4',
    borderRadius: 12,
    overflow: 'hidden',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#0f172a',
  },
  eyeButton: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },

  // Dropdown Field
  dropdownField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#f8f5f5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dropdownFieldSelected: {
    borderColor: '#3b82f6',
    borderWidth: 2,
  },
  dropdownFieldText: {
    fontSize: 15,
    color: '#94a3b8',
  },
  dropdownFieldTextSelected: {
    color: '#0f172a',
  },
  
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingText: {
    marginLeft: 8,
    color: '#94a3b8',
    fontSize: 14,
  },

  // Dropdown Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginHorizontal: 20,
  },
  modalList: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  dropdownItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  dropdownItemActive: {
    backgroundColor: '#eff6ff',
    borderRadius: 8,
  },
  dropdownItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownItemText: {
    fontSize: 15,
    color: '#334155',
  },
  dropdownItemTextActive: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 12,
  },
  emptySubText: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
  },

  // Terms
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  termsText: {
    fontSize: 13,
    color: '#475569',
    flex: 1,
  },
  termsLink: {
    color: '#3b82f6',
    fontWeight: '600',
  },

  // Register Button
  registerButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  registerButtonDisabled: {
    opacity: 0.6,
  },
  registerButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  registerButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Login Link
  loginLink: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  loginLinkText: {
    fontSize: 14,
    color: '#64748b',
  },
  loginLinkHighlight: {
    color: '#3b82f6',
    fontWeight: '700',
  },
});