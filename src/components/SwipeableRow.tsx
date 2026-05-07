import React, { useRef } from 'react';
import { Animated, TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Colors, Radius } from '../constants/theme';

interface Props {
  children: React.ReactNode;
  onDelete?: () => void;
  onEdit?: () => void;
}

export default function SwipeableRow({ children, onDelete, onEdit }: Props) {
  const ref = useRef<Swipeable>(null);

  const renderRight = onDelete
    ? () => (
        <TouchableOpacity
          style={styles.actionRight}
          onPress={() => { ref.current?.close(); onDelete(); }}
        >
          <Text style={styles.actionText}>Excluir</Text>
        </TouchableOpacity>
      )
    : undefined;

  const renderLeft = onEdit
    ? () => (
        <TouchableOpacity
          style={styles.actionLeft}
          onPress={() => { ref.current?.close(); onEdit(); }}
        >
          <Text style={styles.actionText}>Editar</Text>
        </TouchableOpacity>
      )
    : undefined;

  return (
    <Swipeable
      ref={ref}
      renderRightActions={renderRight}
      renderLeftActions={renderLeft}
      overshootRight={false}
      overshootLeft={false}
    >
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  actionRight: {
    backgroundColor: '#da3633', justifyContent: 'center', alignItems: 'center',
    width: 80, borderRadius: Radius.md, marginBottom: 10, marginLeft: 4,
  },
  actionLeft: {
    backgroundColor: Colors.header, justifyContent: 'center', alignItems: 'center',
    width: 80, borderRadius: Radius.md, marginBottom: 10, marginRight: 4,
  },
  actionText: { color: Colors.white, fontWeight: '600', fontSize: 13 },
});
