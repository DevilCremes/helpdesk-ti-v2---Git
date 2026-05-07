import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBadge, PriorityBadge } from './StatusBadge';
import { attachmentRepo } from '../db';
import { priColor, Colors, Spacing, FontSize, Radius } from '../constants/theme';
import { isImage } from '../utils/fileUtils';

interface TicketCardProps {
  ticket: any;
  onPress: () => void;
  showCompanyName?: boolean;
}

export default function TicketCard({ ticket, onPress, showCompanyName }: TicketCardProps) {
  const [thumbPath, setThumbPath] = useState<string | null>(null);

  useEffect(() => {
    const loadThumb = async () => {
      const atts = attachmentRepo.getByTicket(ticket.id);
      const firstImg = atts.find(a => isImage(a.name, a.mime_type));
      if (firstImg) setThumbPath(firstImg.local_path);
    };
    loadThumb();
  }, [ticket.id]);

  const priClr = priColor(ticket.priority);

  return (
    <TouchableOpacity style={[styles.card, { borderLeftColor: priClr, borderLeftWidth: 4 }]} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {thumbPath ? (
            <Image source={{ uri: thumbPath }} style={styles.thumb} />
          ) : null}
          <View style={styles.titleWrap}>
            <Text style={styles.title} numberOfLines={2}>{ticket.title}</Text>
            <View style={styles.badges}>
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
            </View>
          </View>
        </View>
      </View>
      <Text style={styles.requester}>{ticket.requester}</Text>
      {ticket.description ? <Text style={styles.description} numberOfLines={2}>{ticket.description}</Text> : null}
      <View style={styles.footer}>
        <Text style={styles.category}>{ticket.category}</Text>
        <Text style={styles.date}>{ticket.created_at}</Text>
      </View>
      {showCompanyName && ticket.company_name && (
        <View style={styles.companyBadge}>
          <MaterialCommunityIcons name="office-building" size={12} color={Colors.blue} />
          <Text style={styles.companyText}>{ticket.company_name}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 4 },
  header: { marginBottom: Spacing.xs },
  headerLeft: { flexDirection: 'row', alignItems: 'flex-start' },
  thumb: { width: 40, height: 40, borderRadius: Radius.sm, marginRight: Spacing.sm },
  titleWrap: { flex: 1 },
  title: { color: Colors.textPrimary, fontSize: FontSize.base, fontWeight: '600', marginBottom: Spacing.xs },
  badges: { flexDirection: 'row', gap: Spacing.xs },
  requester: { color: Colors.textSecondary, fontSize: FontSize.sm, marginBottom: Spacing.xs },
  description: { color: Colors.textMuted, fontSize: FontSize.sm, marginBottom: Spacing.sm },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  category: { color: Colors.textMuted, fontSize: FontSize.xs },
  date: { color: Colors.textDim, fontSize: FontSize.xs },
  companyBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.blue + '15', paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.sm, marginTop: Spacing.xs, gap: 4, alignSelf: 'flex-start' },
  companyText: { color: Colors.blue, fontSize: FontSize.xs, fontWeight: '500' },
});
