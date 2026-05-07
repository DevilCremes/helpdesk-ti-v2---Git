import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing } from '../constants/theme';

interface EmptyStateProps {
  icon?: string;
  message: string;
  subMessage?: string;
}

export default function EmptyState({ icon = 'ticket-outline', message, subMessage }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <MaterialCommunityIcons name={icon as any} size={64} color={Colors.textDim} />
      <Text style={styles.message}>{message}</Text>
      {subMessage && <Text style={styles.subMessage}>{subMessage}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xxl },
  message: { color: Colors.textMuted, fontSize: FontSize.lg, textAlign: 'center', marginTop: Spacing.md },
  subMessage: { color: Colors.textDim, fontSize: FontSize.sm, textAlign: 'center', marginTop: Spacing.xs },
});
