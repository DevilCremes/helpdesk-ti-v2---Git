import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import BottomSheet from '../components/BottomSheet';
import { timelineRepo } from '../db';
import { nowStr } from '../utils/dateUtils';
import { useAppStore } from '../stores/appStore';
import { Colors, Spacing, FontSize, Radius } from '../constants/theme';

interface TransitionModalProps {
  visible: boolean; onClose: () => void; ticketId: string;
  currentStatus: string; newStatus: string; onConfirm: () => void;
}

const transitionLabels: Record<string, string> = {
  andamento: 'Iniciar atendimento', aguardando: 'Aguardando retorno',
  fechado: 'Fechar chamado', aberto: 'Reabrir chamado',
};

const suggestionChips: Record<string, string[]> = {
  andamento: ['Análise iniciada', 'Aguardando usuário', 'Em desenvolvimento'],
  aguardando: ['Aguardando resposta', 'Pendente aprovação', 'Aguardando material'],
  fechado: ['Problema resolvido', 'Chamado encerrado', 'Solução aplicada'],
  aberto: ['Reaberto para análise', 'Problema recorrente', 'Necessária revisão'],
};

export default function TransitionModal({ visible, onClose, ticketId, currentStatus, newStatus, onConfirm }: TransitionModalProps) {
  const [comment, setComment] = useState('');
  const { showToast } = useAppStore();

  const commentLength = comment.length;
  const showCounter = commentLength >= 400;
  const counterColor = commentLength > 480 ? Colors.red : Colors.yellow;

  const handleConfirm = () => {
    if (!comment.trim()) { showToast('Comentario e obrigatorio', { isError: true }); return; }
    const now = nowStr();
    let type = 'status';
    if (newStatus === 'aberto') type = 'reopen';
    if (newStatus === 'fechado') type = 'close';
    timelineRepo.add(ticketId, type, `${transitionLabels[newStatus] || 'Status alterado'}\n${comment.trim()}`);
    onConfirm();
    setComment('');
  };

  const chips = suggestionChips[newStatus] || [];

  const handleChipPress = (text: string) => {
    setComment(prev => prev ? prev + ' ' + text : text);
  };

  return (
    <BottomSheet visible={visible} onClose={() => { onClose(); setComment(''); }} height={450}>
      <View style={styles.header}>
        <Text style={styles.title}>Mudar Status</Text>
        <Text style={styles.subtitle}>De "{currentStatus}" para "{transitionLabels[newStatus] || newStatus}"</Text>
      </View>
      <Text style={styles.label}>Comentario obrigatorio</Text>
      {chips.length > 0 && (
        <View style={styles.chipsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContent}>
            {chips.map((chip, index) => (
              <TouchableOpacity key={index} style={styles.chip} onPress={() => handleChipPress(chip)}>
                <Text style={styles.chipText}>{chip}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
      <TextInput style={[styles.input, styles.textArea]} value={comment} onChangeText={setComment} placeholder="Descreva o que foi feito..." placeholderTextColor={Colors.textDim} multiline numberOfLines={6} textAlignVertical="top" autoFocus maxLength={500} />
      {showCounter && (
        <Text style={[styles.counter, { color: counterColor }]}>
          {commentLength}/500
        </Text>
      )}
      <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
        <Text style={styles.confirmButtonText}>Confirmar</Text>
      </TouchableOpacity>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: Spacing.lg },
  title: { color: Colors.textPrimary, fontSize: FontSize.xl, fontWeight: 'bold', marginBottom: Spacing.xs },
  subtitle: { color: Colors.textSecondary, fontSize: FontSize.base },
  label: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600', marginBottom: Spacing.xs },
  input: { backgroundColor: Colors.surfaceAlt, color: Colors.textPrimary, padding: Spacing.md, borderRadius: Radius.md, fontSize: FontSize.base },
  textArea: { minHeight: 120 },
  confirmButton: { backgroundColor: Colors.blue, padding: Spacing.lg, borderRadius: Radius.lg, alignItems: 'center', marginTop: Spacing.xl },
  confirmButtonText: { color: '#fff', fontSize: FontSize.lg, fontWeight: 'bold' },
  chipsContainer: { marginBottom: Spacing.md },
  chipsContent: { gap: Spacing.xs },
  chip: { backgroundColor: Colors.blue + '20', paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.full, marginRight: Spacing.xs, borderWidth: 1, borderColor: Colors.blue + '40' },
  chipText: { color: Colors.blue, fontSize: FontSize.sm, fontWeight: '500' },
  counter: { fontSize: FontSize.xs, textAlign: 'right', marginTop: Spacing.xs, marginRight: Spacing.sm },
});
