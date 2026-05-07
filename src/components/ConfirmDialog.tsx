import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../constants/theme';

interface ConfirmDialogProps {
  visible: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  showUndo?: boolean;
  onUndo?: () => void;
  undoLabel?: string;
}

export default function ConfirmDialog({
  visible,
  message,
  onConfirm,
  onCancel,
  title = 'Confirmar',
  showUndo = false,
  onUndo,
  undoLabel = 'Desfazer',
}: ConfirmDialogProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          {showUndo ? (
            <View style={styles.buttons}>
              <TouchableOpacity style={[styles.button, styles.undoButton]} onPress={onUndo}>
                <Text style={styles.undoText}>{undoLabel}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.buttons}>
              <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onCancel}>
                <Text style={styles.cancelText}>Nao</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.confirmButton]} onPress={onConfirm}>
                <Text style={styles.confirmText}>Sim</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  dialog: { backgroundColor: Colors.surface, borderRadius: 12, padding: 20, width: '80%', maxWidth: 320 },
  title: { color: Colors.textPrimary, fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  message: { color: Colors.textSecondary, fontSize: 14, marginBottom: 20, lineHeight: 20 },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  button: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6 },
  cancelButton: { backgroundColor: Colors.surfaceAlt },
  cancelText: { color: Colors.textSecondary, fontWeight: '600' },
  confirmButton: { backgroundColor: Colors.red },
  confirmText: { color: '#fff', fontWeight: '600' },
  undoButton: { backgroundColor: Colors.blue, alignSelf: 'center' },
  undoText: { color: '#fff', fontWeight: '600' },
});
