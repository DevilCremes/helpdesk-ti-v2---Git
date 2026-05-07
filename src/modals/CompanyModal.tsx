import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import BottomSheet from '../components/BottomSheet';
import { companyRepo } from '../db';
import { useAppStore } from '../stores/appStore';
import { Colors, Spacing, FontSize, Radius } from '../constants/theme';

interface CompanyModalProps { visible: boolean; onClose: () => void; onConfirmed?: () => void; }

export default function CompanyModal({ visible, onClose }: CompanyModalProps) {
  const [name, setName] = useState('');
  const { showToast } = useAppStore();

  const handleSave = () => {
    if (!name.trim()) { showToast('Preencha o nome da empresa', { isError: true }); return; }
    try {
      companyRepo.create(name.trim());
      showToast('Empresa criada!');
      setName('');
      if (onConfirmed) onConfirmed();
      onClose();
    } catch (e: any) {
      if (e.message?.includes('UNIQUE')) showToast('Empresa ja existe', { isError: true });
      else showToast('Erro ao criar empresa', { isError: true });
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} height={250}>
      <View style={styles.header}>
        <Text style={styles.title}>Nova Empresa</Text>
        <TouchableOpacity onPress={onClose}>
          <MaterialCommunityIcons name="close" size={24} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>
      <Text style={styles.label}>Nome da Empresa</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ex: Empresa ABC" placeholderTextColor={Colors.textDim} autoFocus onSubmitEditing={handleSave} />
      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Salvar</Text>
      </TouchableOpacity>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  title: { color: Colors.textPrimary, fontSize: FontSize.xl, fontWeight: 'bold' },
  label: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600', marginBottom: Spacing.xs },
  input: { backgroundColor: Colors.surfaceAlt, color: Colors.textPrimary, padding: Spacing.md, borderRadius: Radius.md, fontSize: FontSize.base },
  saveButton: { backgroundColor: Colors.blue, padding: Spacing.lg, borderRadius: Radius.lg, alignItems: 'center', marginTop: Spacing.xl },
  saveButtonText: { color: '#fff', fontSize: FontSize.lg, fontWeight: 'bold' },
});
