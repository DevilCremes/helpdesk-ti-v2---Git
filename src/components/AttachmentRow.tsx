import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { fmtSize } from '../utils/dateUtils';
import { isImage } from '../utils/fileUtils';
import { Colors, Spacing, FontSize, Radius } from '../constants/theme';

interface AttachmentRowProps {
  attachment: { id: number; name: string; size: number; mime_type: string | null; local_path: string; };
  onView: () => void;
  onDelete: () => void;
}

function AttachmentRow({ attachment, onView, onDelete }: AttachmentRowProps) {
  const img = isImage(attachment.name, attachment.mime_type);
  return (
    <View style={styles.container}>
      {img ? <Image source={{ uri: attachment.local_path }} style={styles.imageThumb} resizeMode="cover" /> : <View style={styles.iconBox}><MaterialCommunityIcons name="file-document-outline" size={24} color={Colors.textMuted} /></View>}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{attachment.name}</Text>
        <Text style={styles.size}>{fmtSize(attachment.size)}</Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={onView}><MaterialCommunityIcons name="eye" size={18} color={Colors.blue} /></TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onDelete}><MaterialCommunityIcons name="trash-can-outline" size={18} color={Colors.red} /></TouchableOpacity>
      </View>
    </View>
  );
}

export default React.memo(AttachmentRow);

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.xs },
  imageThumb: { width: 40, height: 40, borderRadius: Radius.sm, marginRight: Spacing.sm },
  iconBox: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.sm },
  info: { flex: 1 },
  name: { color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: '500' },
  size: { color: Colors.textDim, fontSize: FontSize.xs },
  actions: { flexDirection: 'row', gap: Spacing.xs },
  actionBtn: { padding: Spacing.xs },
});
