import React from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export interface AttendanceReasonDialogProps {
  visible: boolean;
  title: string;
  message: string;
  placeholder: string;
  value: string;
  isSubmitting: boolean;
  onChangeText: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export default function AttendanceReasonDialog({
  visible,
  title,
  message,
  placeholder,
  value,
  isSubmitting,
  onChangeText,
  onSubmit,
  onCancel,
}: AttendanceReasonDialogProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <TextInput
            style={styles.input}
            placeholder={placeholder}
            placeholderTextColor="#94a3b8"
            value={value}
            onChangeText={onChangeText}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            editable={!isSubmitting}
            autoFocus
            accessibilityLabel={placeholder}
          />

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
              disabled={isSubmitting}
              accessibilityRole="button"
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.submitButton,
                (!value.trim() || isSubmitting) && styles.disabledButton,
              ]}
              onPress={onSubmit}
              disabled={!value.trim() || isSubmitting}
              accessibilityRole="button"
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>Submit</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.58)',
  },
  dialog: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 22,
  },
  title: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '800',
  },
  message: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 16,
  },
  input: {
    minHeight: 108,
    maxHeight: 180,
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: '#0f172a',
    fontSize: 15,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 18,
  },
  button: {
    minWidth: 100,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 11,
  },
  cancelButton: {
    backgroundColor: '#f1f5f9',
  },
  cancelText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '700',
  },
  submitButton: {
    backgroundColor: '#2563eb',
  },
  submitText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.55,
  },
});
