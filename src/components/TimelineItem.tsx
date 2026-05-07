import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, FontSize } from '../constants/theme';

interface TimelineItemProps { type: string; text: string; createdAt: string; }

const typeConfig: Record<string, { color: string }> = {
  open:   { color: Colors.green },
  status: { color: Colors.blue },
  chat:   { color: Colors.purple },
  attach: { color: Colors.green },
  reopen: { color: Colors.yellow },
  close:  { color: Colors.textMuted },
  edit:   { color: Colors.orange },
};

export default function TimelineItem({ type, text, createdAt }: TimelineItemProps) {
  const config = typeConfig[type] || typeConfig.chat;
  return (
    <View style={styles.container}>
      <View style={[styles.dot, { backgroundColor: config.color }]} />
      <View style={styles.line} />
      <View style={styles.content}>
        <Text style={styles.text}>{text}</Text>
        <Text style={styles.date}>{createdAt}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 4, marginRight: Spacing.sm },
  line: { width: 2, backgroundColor: Colors.border, marginRight: Spacing.sm, position: 'absolute', left: 5, top: 16, bottom: 0 },
  content: { flex: 1 },
  text: { color: Colors.textPrimary, fontSize: FontSize.sm, lineHeight: 20 },
  date: { color: Colors.textDim, fontSize: FontSize.xs, marginTop: 2 },
});
