import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import Toast from 'react-native-toast-message';
import { legacyApi as api, getApiErrorMessage } from '@/api/axios';

interface OTPModalProps {
  visible: boolean;
  email: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function OTPModal({ visible, email, onClose, onSuccess }: OTPModalProps) {
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleVerify = async () => {
    if (!otp || otp.length < 6) {
      Toast.show({ type: 'error', text1: 'Invalid OTP', text2: 'Please enter a valid 6-digit OTP' });
      return;
    }

    setIsLoading(true);
    try {
      await api.put('/verifyuserRegister', { email, otp });
      Toast.show({ type: 'success', text1: 'Verified!', text2: 'You can now log in.' });
      setOtp('');
      onSuccess();
    } catch (error: any) {
      Toast.show({ 
        type: 'error', 
        text1: 'Verification Failed', 
        text2: getApiErrorMessage(error) 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setIsLoading(true);
    try {
      await api.post('/users/resendOTP', { email });
      Toast.show({ type: 'success', text1: 'OTP Resent', text2: 'Check your email again.' });
    } catch (error: any) {
      Toast.show({ 
        type: 'error', 
        text1: 'Failed to resend', 
        text2: getApiErrorMessage(error) 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.title}>Verify Your Account</Text>
          <Text style={styles.subtitle}>Enter the 6-digit OTP sent to {email}</Text>

          <TextInput
            style={styles.input}
            placeholder="000000"
            value={otp}
            onChangeText={setOtp}
            keyboardType="number-pad"
            maxLength={6}
            textAlign="center"
          />

          <TouchableOpacity style={styles.primaryBtn} onPress={handleVerify} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Verify</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={handleResend} disabled={isLoading}>
            <Text style={styles.secondaryBtnText}>Resend OTP</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={isLoading}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Toast /> 
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalContainer: { backgroundColor: '#fff', padding: 24, borderRadius: 16, alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#0f172a', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 24 },
  input: { backgroundColor: '#f8fafc', width: '100%', padding: 16, borderRadius: 12, fontSize: 24, letterSpacing: 8, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 24 },
  primaryBtn: { backgroundColor: '#3b82f6', width: '100%', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  secondaryBtn: { padding: 12 },
  secondaryBtnText: { color: '#3b82f6', fontSize: 15, fontWeight: '600' },
  cancelBtn: { marginTop: 8 },
  cancelText: { color: '#94a3b8', fontSize: 15 }
});