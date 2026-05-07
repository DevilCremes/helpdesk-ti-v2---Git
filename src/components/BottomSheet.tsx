import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, TouchableOpacity, StyleSheet, Animated, Dimensions } from 'react-native';
import { Colors } from '../constants/theme';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  height?: number;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;

export default function BottomSheet({ visible, onClose, children, height = SCREEN_HEIGHT * 0.85 }: BottomSheetProps) {
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      translateY.setValue(SCREEN_HEIGHT);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 12,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setRendered(false);
      });
    }
  }, [visible, translateY]);

  return (
    <Modal visible={rendered} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <Animated.View
          style={[styles.sheet, { height, transform: [{ translateY }] }]}
        >
          <TouchableOpacity activeOpacity={1} style={styles.content}>
            {children}
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: 'hidden' },
  content: { flex: 1, padding: 16 },
});
