import React from 'react';
import { TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';

interface FABProps {
  onPress: () => void;
  icon?: string;
  color?: string;
  bottom?: number;
}

export default function FAB({ onPress, icon = 'plus', color = Colors.red, bottom }: FABProps) {
  const bottomValue = bottom ?? (Platform.OS === 'ios' ? 72 : 68);

  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: color, bottom: bottomValue }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <MaterialCommunityIcons name={icon as any} size={28} color="#fff" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute', right: 16, width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center', elevation: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 6, zIndex: 9999,
  },
});
