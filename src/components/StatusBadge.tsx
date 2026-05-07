import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { statusColor, statusLabel, priColor, Colors, Radius, FontSize } from '../constants/theme';

interface StatusBadgeProps { status: string; }

export function StatusBadge({ status }: StatusBadgeProps) {
  const color = statusColor(status);
  return (
    <View style={[styles.badge, { backgroundColor: color + '20', borderColor: color }]}>
      <Text style={[styles.text, { color }]}>{statusLabel(status)}</Text>
    </View>
  );
}

interface PriorityBadgeProps { priority: string; }

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const color = priColor(priority);
  const label = priority.charAt(0).toUpperCase() + priority.slice(1);
  return (
    <View style={[styles.badge, { backgroundColor: color + '20', borderColor: color }]}>
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.sm, borderWidth: 1, alignSelf: 'flex-start' },
  text: { fontSize: FontSize.xs, fontWeight: '600' },
});
