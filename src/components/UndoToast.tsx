import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/theme';
import { useAppStore } from '../stores/appStore';

export default function Toast() {
  const { toast, hideToast } = useAppStore();
  const insets = useSafeAreaInsets();

  if (!toast) return null;

  return (
    <View style={[styles.container, { top: insets.top + 12 }]}>
      <Text style={styles.msg} numberOfLines={2}>{toast.message}</Text>
      {toast.onUndo && (
        <TouchableOpacity onPress={() => { toast.onUndo?.(); hideToast(); }}>
          <Text style={styles.undo}>DESFAZER</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16, right: 16,
    zIndex: 9999,
    backgroundColor: '#23863d',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  msg:  { flex: 1, color: Colors.white, fontSize: 14 },
  undo: { color: Colors.white, fontWeight: '700', fontSize: 13, marginLeft: 12 },
});
