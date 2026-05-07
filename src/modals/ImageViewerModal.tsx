import React from 'react';
import { Modal, View, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Spacing } from '../constants/theme';

interface ImageViewerModalProps {
  visible: boolean;
  onClose: () => void;
  imageUri: string;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function ImageViewerModal({ visible, onClose, imageUri }: ImageViewerModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <MaterialCommunityIcons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <Image
          source={{ uri: imageUri }}
          style={styles.image}
          resizeMode="contain"
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: Spacing.lg,
    zIndex: 10,
    padding: Spacing.sm,
  },
  image: {
    width: screenWidth,
    height: screenHeight * 0.8,
  },
});
