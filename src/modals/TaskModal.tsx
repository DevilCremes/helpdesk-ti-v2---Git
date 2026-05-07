import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import BottomSheet from '../components/BottomSheet';
import { taskRepo } from '../db';
import { useAppStore } from '../stores/appStore';
import { nowStr } from '../utils/dateUtils';
import { Colors, Spacing, FontSize, Radius } from '../constants/theme';

interface TaskModalProps { visible: boolean; onClose: () => void; }

const SCHEDULE_OPTIONS = [
  { value: 'daily', label: 'Diario' }, { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensal' }, { value: 'xmonths', label: 'A cada X meses' },
  { value: 'yearly', label: 'Anual' }, { value: 'xyears', label: 'A cada X anos' },
  { value: 'bom', label: 'Inicio do mes' }, { value: 'eom', label: 'Fim do mes' },
];
const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

export default function TaskModal({ visible, onClose }: TaskModalProps) {
  const { currentCompanyId, showToast } = useAppStore();
  const [name, setName] = useState('');
  const [taskType, setTaskType] = useState<'one' | 'rec'>('rec');
  const [scheduleType, setScheduleType] = useState('daily');
  const [scheduleDays, setScheduleDays] = useState<number[]>([1,2,3,4,5]);
  const [periodNumber, setPeriodNumber] = useState('2');
  const [timeFrom, setTimeFrom] = useState('08:00');
  const [timeTo, setTimeTo] = useState('18:00');
  const [timeError, setTimeError] = useState<string | null>(null);

  const handleSave = () => {
    if (!name.trim()) { showToast('Preencha o nome da tarefa', { isError: true }); return; }

    // Valida horario: time_from deve ser menor que time_to
    if (taskType === 'rec' && timeTo <= timeFrom) {
      setTimeError('Horario de inicio deve ser anterior ao de fim');
      return;
    }
    setTimeError(null);

    const scheduleDaysStr = taskType === 'rec' && scheduleType === 'weekly' ? JSON.stringify(scheduleDays) : null;
    const periodNum = (scheduleType === 'xmonths' || scheduleType === 'xyears') ? parseInt(periodNumber) || 2 : null;
    taskRepo.create({ companyId: currentCompanyId, name: name.trim(), taskType, scheduleType, scheduleDays: scheduleDaysStr ? JSON.parse(scheduleDaysStr) : undefined, periodNumber: periodNum ?? undefined, timeFrom, timeTo });
    showToast('Tarefa criada!');
    resetForm(); onClose();
  };

  const resetForm = () => { setName(''); setTaskType('rec'); setScheduleType('daily'); setScheduleDays([1,2,3,4,5]); setPeriodNumber('2'); setTimeFrom('08:00'); setTimeTo('18:00'); setTimeError(null); };
  const toggleDay = (day: number) => { setScheduleDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]); };
  const clearTimeError = () => { setTimeError(null); };

  return (
    <BottomSheet visible={visible} onClose={() => { onClose(); resetForm(); }}>
      <View style={styles.header}>
        <Text style={styles.title}>Nova Tarefa</Text>
        <TouchableOpacity onPress={() => { onClose(); resetForm(); }}><MaterialCommunityIcons name="close" size={24} color={Colors.textMuted} /></TouchableOpacity>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.label}>Nome da Tarefa *</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ex: Backup diario" placeholderTextColor={Colors.textDim} />
        <Text style={styles.label}>Tipo</Text>
        <View style={styles.typeRow}>
          <TouchableOpacity style={[styles.typeBtn, taskType === 'rec' && styles.typeBtnActive]} onPress={() => setTaskType('rec')}><Text style={[styles.typeBtnText, taskType === 'rec' && styles.typeBtnTextActive]}>Recorrente</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.typeBtn, taskType === 'one' && styles.typeBtnActive]} onPress={() => setTaskType('one')}><Text style={[styles.typeBtnText, taskType === 'one' && styles.typeBtnTextActive]}>Unica</Text></TouchableOpacity>
        </View>
        {taskType === 'rec' && (<>
          <Text style={styles.label}>Frequencia</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scheduleScroll}>
            {SCHEDULE_OPTIONS.map(opt => (
              <TouchableOpacity key={opt.value} style={[styles.schedulePill, scheduleType === opt.value && styles.schedulePillActive]} onPress={() => setScheduleType(opt.value)}><Text style={[styles.schedulePillText, scheduleType === opt.value && styles.schedulePillTextActive]}>{opt.label}</Text></TouchableOpacity>
            ))}
          </ScrollView>
          {scheduleType === 'weekly' && (<>
            <Text style={styles.label}>Dias da Semana</Text>
            <View style={styles.daysGrid}>
              {DAY_NAMES.map((day, i) => (<TouchableOpacity key={i} style={[styles.dayBtn, scheduleDays.includes(i) && styles.dayBtnActive]} onPress={() => toggleDay(i)}><Text style={[styles.dayBtnText, scheduleDays.includes(i) && styles.dayBtnTextActive]}>{day}</Text></TouchableOpacity>))}
            </View>
          </>)}
          {(scheduleType === 'xmonths' || scheduleType === 'xyears') && (<>
            <Text style={styles.label}>Periodo (numero)</Text>
            <TextInput style={styles.input} value={periodNumber} onChangeText={setPeriodNumber} placeholder="Ex: 2" placeholderTextColor={Colors.textDim} keyboardType="numeric" />
          </>)}
          <Text style={styles.label}>Horario</Text>
          <View style={styles.timeRow}>
            <View style={styles.timeInputWrapper}>
              <Text style={styles.timeLabel}>Inicio</Text>
              <TextInput
                style={[styles.timeInput, timeError && styles.timeInputError]}
                value={timeFrom}
                onChangeText={(v) => { setTimeFrom(v); clearTimeError(); }}
                placeholder="08:00"
                placeholderTextColor={Colors.textDim}
              />
            </View>
            <View style={styles.timeInputWrapper}>
              <Text style={styles.timeLabel}>Fim</Text>
              <TextInput
                style={[styles.timeInput, timeError && styles.timeInputError]}
                value={timeTo}
                onChangeText={(v) => { setTimeTo(v); clearTimeError(); }}
                placeholder="18:00"
                placeholderTextColor={Colors.textDim}
              />
            </View>
          </View>
          {timeError !== null && (
            <Text style={styles.timeErrorText}>{timeError}</Text>
          )}
        </>)}
        <TouchableOpacity
          style={[styles.saveButton, timeError !== null && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={timeError !== null}
        >
          <Text style={[styles.saveButtonText, timeError !== null && styles.saveButtonTextDisabled]}>Salvar Tarefa</Text>
        </TouchableOpacity>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  title: { color: Colors.textPrimary, fontSize: FontSize.xl, fontWeight: 'bold' },
  scroll: { paddingBottom: 20 },
  label: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600', marginTop: Spacing.md, marginBottom: Spacing.xs },
  input: { backgroundColor: Colors.surfaceAlt, color: Colors.textPrimary, padding: Spacing.md, borderRadius: Radius.md, fontSize: FontSize.base },
  typeRow: { flexDirection: 'row', gap: Spacing.sm },
  typeBtn: { flex: 1, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceAlt, alignItems: 'center' },
  typeBtnActive: { borderColor: Colors.blue, backgroundColor: Colors.blue + '20' },
  typeBtnText: { color: Colors.textMuted, fontSize: FontSize.base, fontWeight: '600' },
  typeBtnTextActive: { color: Colors.blue },
  scheduleScroll: { marginBottom: Spacing.sm },
  schedulePill: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceAlt, marginRight: Spacing.xs },
  schedulePillActive: { borderColor: Colors.blue, backgroundColor: Colors.blue + '20' },
  schedulePillText: { color: Colors.textMuted, fontSize: FontSize.sm, fontWeight: '500' },
  schedulePillTextActive: { color: Colors.blue },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  dayBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceAlt },
  dayBtnActive: { borderColor: Colors.blue, backgroundColor: Colors.blue + '20' },
  dayBtnText: { color: Colors.textMuted, fontSize: FontSize.sm, fontWeight: '500' },
  dayBtnTextActive: { color: Colors.blue },
  timeRow: { flexDirection: 'row', gap: Spacing.md },
  timeInputWrapper: { flex: 1 },
  timeLabel: { color: Colors.textSecondary, fontSize: FontSize.xs, marginBottom: 4 },
  timeInput: { backgroundColor: Colors.surfaceAlt, color: Colors.textPrimary, padding: Spacing.md, borderRadius: Radius.md, fontSize: FontSize.base, textAlign: 'center' },
  timeInputError: { borderColor: Colors.red, borderWidth: 1 },
  timeErrorText: { color: Colors.red, fontSize: FontSize.xs, marginTop: Spacing.xs, marginLeft: Spacing.sm },
  saveButton: { backgroundColor: Colors.blue, padding: Spacing.lg, borderRadius: Radius.lg, alignItems: 'center', marginTop: Spacing.xl },
  saveButtonDisabled: { backgroundColor: Colors.surfaceAlt, opacity: 0.5 },
  saveButtonText: { color: '#fff', fontSize: FontSize.lg, fontWeight: 'bold' },
  saveButtonTextDisabled: { color: Colors.textMuted },
});
