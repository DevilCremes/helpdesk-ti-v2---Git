import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Radius } from '../constants/theme';

interface Props {
  value: string;
  onChangeText: (t: string) => void;
  onClear: () => void;
  placeholder?: string;
}

export default function SearchBar({ value, onChangeText, onClear, placeholder = 'Buscar chamados...' }: Props) {
  return (
    <View style={styles.container}>
      <MaterialCommunityIcons name="magnify" size={18} color={Colors.textMuted} style={styles.icon} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={onClear}>
          <MaterialCommunityIcons name="close-circle" size={18} color={Colors.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  icon:  { marginRight: 6 },
  input: { flex: 1, color: Colors.textPrimary, fontSize: 14 },
});
