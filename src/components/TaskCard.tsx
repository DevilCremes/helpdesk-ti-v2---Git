import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { scheduleLabel, nextAvailLabel, isTaskAvailableNow, TaskSchedule } from '../utils/scheduleUtils';
import { Colors, Spacing, FontSize, Radius } from '../constants/theme';

interface TaskCardProps {
  task: any;
  onToggle: () => void;
  onDelete: () => void;
}

export default function TaskCard({ task, onToggle, onDelete }: TaskCardProps) {
  const isDone = task.is_done === 1;
  const sched = { task_type: task.task_type, schedule_type: task.schedule_type, schedule_days: task.schedule_days, period_number: task.period_number, time_from: task.time_from, time_to: task.time_to, last_done_at: task.last_done_at } as TaskSchedule;
  const schedLabel = scheduleLabel(sched);
  const available = isTaskAvailableNow(sched);
  const nextLabel = nextAvailLabel(sched);

  return (
    <View style={[styles.card, isDone && styles.cardDone]}>
      <TouchableOpacity style={styles.checkbox} onPress={onToggle} activeOpacity={0.7}>
        <MaterialCommunityIcons name={isDone ? 'checkbox-marked' : 'checkbox-blank-outline'} size={24} color={isDone ? Colors.green : Colors.textMuted} />
      </TouchableOpacity>
      <View style={styles.content}>
        <Text style={[styles.name, isDone && styles.nameDone]} numberOfLines={2}>{task.name}</Text>
        <View style={styles.badge}><Text style={styles.badgeText}>{schedLabel}</Text></View>
        {isDone && task.last_done_at ? <Text style={styles.doneText}>Feita as {task.last_done_at.split(' ')[1]}</Text> : null}
        {!isDone && !available && nextLabel ? <Text style={styles.nextText}>Disponivel: {nextLabel}</Text> : null}
      </View>
      <TouchableOpacity style={styles.deleteBtn} onPress={onDelete} activeOpacity={0.7}>
        <MaterialCommunityIcons name="trash-can-outline" size={20} color={Colors.red} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  cardDone: { opacity: 0.6 },
  checkbox: { marginRight: Spacing.md },
  content: { flex: 1 },
  name: { color: Colors.textPrimary, fontSize: FontSize.base, fontWeight: '600', marginBottom: Spacing.xs },
  nameDone: { textDecorationLine: 'line-through', color: Colors.textMuted },
  badge: { backgroundColor: Colors.blue + '15', paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.sm, alignSelf: 'flex-start' },
  badgeText: { color: Colors.blue, fontSize: FontSize.xs, fontWeight: '500' },
  doneText: { color: Colors.green, fontSize: FontSize.xs, marginTop: 2 },
  nextText: { color: Colors.textDim, fontSize: FontSize.xs, marginTop: 2, fontStyle: 'italic' },
  deleteBtn: { padding: Spacing.xs },
});
