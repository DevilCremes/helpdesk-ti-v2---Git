import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Crypto from 'expo-crypto';

import TimelineItem from '../../src/components/TimelineItem';
import AttachmentRow from '../../src/components/AttachmentRow';
import { StatusBadge, PriorityBadge } from '../../src/components/StatusBadge';
import ConfirmDialog from '../../src/components/ConfirmDialog';
import TicketModal from '../../src/modals/TicketModal';
import TransitionModal from '../../src/modals/TransitionModal';
import ImageViewerModal from '../../src/modals/ImageViewerModal';

import { ticketRepo, timelineRepo, attachmentRepo } from '../../src/db';
import { deleteFile, isImage, saveFile } from '../../src/utils/fileUtils';
import { useAppStore } from '../../src/stores/appStore';
import { Colors, Spacing, FontSize, Radius } from '../../src/constants/theme';
import { useMediaPermissions } from '../../src/hooks/useMediaPermissions';

// ─── CONSTANTES ───────────────────────────────────────────────────────────────

const STATUS_TRANSITIONS: Record<string, string[]> = {
  aberto:    ['andamento', 'aguardando', 'fechado'],
  andamento: ['aguardando', 'fechado'],
  aguardando:['aberto', 'andamento', 'fechado'],
  fechado:   ['aberto'],
};

const TRANSITION_LABELS: Record<string, string> = {
  aberto:    'Reabrir',
  andamento: 'Em andamento',
  aguardando:'Aguardando',
  fechado:   'Fechar',
};

const TRANSITION_ICONS: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  aberto:    'restore',
  andamento: 'play-circle-outline',
  aguardando:'pause-circle-outline',
  fechado:   'close-circle-outline',
};

function getStatusTransitions(status: string): string[] {
  return STATUS_TRANSITIONS[status] || [];
}

// ─── COMPONENTE ───────────────────────────────────────────────────────────────

export default function TicketDetailScreen() {
  const { id }   = useLocalSearchParams();
  const router   = useRouter();
  const { showToast } = useAppStore();

  const ticketId = typeof id === 'string' ? id : (id?.[0] ?? '');

  // ✅ U1 — estado de carregamento separado de "não encontrado"
  const [isLoading, setIsLoading]     = useState(true);
  const [ticket, setTicket]           = useState<ReturnType<typeof ticketRepo.getById>>(null);
  const [timeline, setTimeline]       = useState<ReturnType<typeof timelineRepo.getByTicket>>([]);
  const [attachments, setAttachments] = useState<ReturnType<typeof attachmentRepo.getByTicket>>([]);

  const [comment, setComment]                 = useState('');
  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [transitionTarget, setTransitionTarget]       = useState<string>('');
  const [showReabrirDialog, setShowReabrirDialog]     = useState(false);
  const [showDeleteDialog, setShowDeleteDialog]       = useState(false);
  const [showEditModal, setShowEditModal]             = useState(false);
  const [showAttachMenu, setShowAttachMenu]           = useState(false);
  const [showImageViewer, setShowImageViewer]         = useState(false);
  const [viewerImageUri, setViewerImageUri]           = useState('');

  // ─── CARREGAMENTO ──────────────────────────────────────────────────────────

  const loadData = useCallback(() => {
    if (!ticketId) return;
    // ✅ U1 — marca loading antes de buscar
    setIsLoading(true);
    const t = ticketRepo.getById(ticketId);
    setTicket(t);
    if (t) {
      setTimeline(timelineRepo.getByTicket(ticketId));
      setAttachments(attachmentRepo.getByTicket(ticketId));
    }
    setIsLoading(false);
  }, [ticketId]);

  useFocusEffect(
    useCallback(() => { loadData(); }, [loadData])
  );

  // ─── HANDLERS — TRANSIÇÃO DE STATUS ───────────────────────────────────────

  const handleTransition = useCallback((newStatus: string) => {
    if (newStatus === 'aberto') {
      setShowReabrirDialog(true);
    } else {
      setTransitionTarget(newStatus);
      setShowTransitionModal(true);
    }
  }, []);

  // ✅ B5 — grava timeline em toda transição (não só no Reabrir)
  const handleConfirmTransition = useCallback((note?: string) => {
    if (!ticketId || !transitionTarget) return;
    const label = TRANSITION_LABELS[transitionTarget] ?? transitionTarget;
    const text  = note?.trim()
      ? `Status alterado para: ${label}.\nObservacao: ${note.trim()}`
      : `Status alterado para: ${label}.`;
    timelineRepo.add(ticketId, 'status', text);
    ticketRepo.update(ticketId, { status: transitionTarget });
    setShowTransitionModal(false);
    setTransitionTarget('');
    loadData();
    showToast('Status atualizado');
  }, [ticketId, transitionTarget, loadData, showToast]);

  const handleConfirmReabrir = useCallback(() => {
    if (!ticketId) return;
    timelineRepo.add(ticketId, 'reopen', 'Chamado reaberto.');
    ticketRepo.update(ticketId, { status: 'aberto' });
    setShowReabrirDialog(false);
    loadData();
    showToast('Chamado reaberto');
  }, [ticketId, loadData, showToast]);

  // ─── HANDLERS — EXCLUSÃO ──────────────────────────────────────────────────

  const handleDeleteTicket = useCallback(async () => {
    if (!ticketId || !ticket) return;
    for (const att of attachments) {
      await deleteFile(att.local_path);
    }
    ticketRepo.delete(ticketId);
    router.back();
    showToast('Chamado excluido');
  }, [ticketId, ticket, attachments, router, showToast]);

  // ─── HANDLERS — COMENTÁRIOS ───────────────────────────────────────────────

  const handleSendComment = useCallback(() => {
    if (!comment.trim()) {
      showToast('Comentario nao pode ser vazio', { isError: true });
      return;
    }
    if (!ticketId) return;
    timelineRepo.add(ticketId, 'chat', comment.trim());
    setComment('');
    loadData();
    showToast('Comentario enviado');
  }, [comment, ticketId, loadData, showToast]);

  // ─── HANDLERS — UTILITÁRIOS ───────────────────────────────────────────────

  const handleCopySummary = useCallback(async () => {
    if (!ticket) return;
    const summary =
      `Chamado #${ticket.id}\n` +
      `Titulo: ${ticket.title}\n` +
      `Solicitante: ${ticket.requester}\n` +
      `Status: ${ticket.status}\n` +
      `Prioridade: ${ticket.priority}\n` +
      `Categoria: ${ticket.category}\n` +
      `Criado em: ${ticket.created_at}`;
    await Clipboard.setStringAsync(summary);
    showToast('Informacoes copiadas');
  }, [ticket, showToast]);

  // ─── HANDLERS — ANEXOS ────────────────────────────────────────────────────

  const { requestCamera, requestGallery } = useMediaPermissions();

  const handleViewAttachment = useCallback((att: {
    name: string; size: number; mime_type: string | null; local_path: string;
  }) => {
    if (isImage(att.name, att.mime_type)) {
      setViewerImageUri(att.local_path);
      setShowImageViewer(true);
    } else {
      Alert.alert(
        att.name,
        `Tamanho: ${(att.size / 1024).toFixed(1)}KB\nTipo: ${att.mime_type || 'Desconhecido'}`,
        [{ text: 'OK' }]
      );
    }
  }, []);

  const handleAddAttachment = useCallback(async (source: 'camera' | 'gallery' | 'document') => {
    if (!ticketId) return;

    let result;

    if (source === 'camera') {
      const ok = await requestCamera();
      if (!ok) return;
      result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images', 'videos'], quality: 0.8 });
    } else if (source === 'gallery') {
      const ok = await requestGallery();
      if (!ok) return;
      result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.8 });
    } else {
      result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    }

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset    = result.assets[0];
      const fileName = asset.name || asset.fileName || `file_${Crypto.randomUUID()}`;
      const fileSize = asset.size || asset.fileSize || 0;
      try {
        const localPath = await saveFile(asset.uri, fileName);
        attachmentRepo.add({ ticketId, name: fileName, size: fileSize, mimeType: asset.mimeType, localPath });
        timelineRepo.add(ticketId, 'attach', `Anexo adicionado: ${fileName}`);
        loadData();
        showToast('Anexo adicionado');
      } catch {
        showToast('Erro ao adicionar anexo', { isError: true });
      }
    }
  }, [ticketId, loadData, showToast, requestCamera, requestGallery]);

  const handleDeleteAttachment = useCallback(async (attId: number, attPath: string, attName: string) => {
    Alert.alert(
      'Excluir anexo',
      `Deseja excluir "${attName}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir', style: 'destructive',
          onPress: async () => {
            await deleteFile(attPath);
            attachmentRepo.delete(attId);
            loadData();
            showToast('Anexo excluido');
          },
        },
      ]
    );
  }, [loadData, showToast]);

  const handleEditModalClose = useCallback(() => {
    setShowEditModal(false);
    loadData();
  }, [loadData]);

  // ─── RENDERIZAÇÃO ─────────────────────────────────────────────────────────

  const transitions = ticket ? getStatusTransitions(ticket.status) : [];

  // ✅ U1 — tela de loading separada de "não encontrado"
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <MaterialCommunityIcons name="loading" size={36} color={Colors.textMuted} />
          <Text style={styles.notFoundText}>Carregando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!ticket) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <MaterialCommunityIcons name="ticket-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.notFoundText}>Chamado nao encontrado</Text>
          <TouchableOpacity style={styles.backButtonLarge} onPress={() => router.back()}>
            <Text style={styles.backButtonTextLarge}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>

      {/* ── HEADER ────────────────────────────────────────────────────── */}
      {/* ✅ S2 — removidos "HEADER" solto e comentários malformados */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1} adjustsFontSizeToFit>
          {ticket.title}
        </Text>

        <TouchableOpacity style={styles.headerBtn} onPress={handleCopySummary}>
          <MaterialCommunityIcons name="content-copy" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.headerBtn} onPress={() => setShowEditModal(true)}>
          <MaterialCommunityIcons name="pencil" size={20} color={Colors.blue} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.headerBtn} onPress={() => setShowDeleteDialog(true)}>
          <MaterialCommunityIcons name="trash-can-outline" size={20} color={Colors.red} />
        </TouchableOpacity>
      </View>

      {/* ── SCROLL CONTENT ────────────────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Botões de transição de status */}
        {transitions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Transicoes de status</Text>
            <View style={styles.transitionRow}>
              {transitions.map(ts => (
                <TouchableOpacity
                  key={ts}
                  style={[
                    styles.transitionBtn,
                    ts === 'fechado'   && styles.transitionBtnDanger,
                    ts === 'aberto'    && styles.transitionBtnWarning,
                  ]}
                  onPress={() => handleTransition(ts)}
                >
                  <MaterialCommunityIcons
                    name={TRANSITION_ICONS[ts] ?? 'swap-horizontal'}
                    size={16}
                    color={ts === 'fechado' ? '#fff' : ts === 'aberto' ? Colors.yellow : Colors.blue}
                  />
                  <Text style={[
                    styles.transitionText,
                    ts === 'fechado' && { color: '#fff' },
                    ts === 'aberto'  && { color: Colors.yellow },
                  ]}>
                    {TRANSITION_LABELS[ts] || ts}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Info grid */}
        <View style={styles.section}>
          <View style={styles.infoGrid}>
            <View style={styles.infoCell}>
              <Text style={styles.infoLabel}>Prioridade</Text>
              <PriorityBadge priority={ticket.priority} />
            </View>
            <View style={styles.infoCell}>
              <Text style={styles.infoLabel}>Categoria</Text>
              <Text style={styles.infoValue}>{ticket.category}</Text>
            </View>
            <View style={styles.infoCell}>
              <Text style={styles.infoLabel}>Solicitante</Text>
              <Text style={styles.infoValue}>{ticket.requester}</Text>
            </View>
            <View style={styles.infoCell}>
              {/* ✅ S1 — removida função no-op formatTicketDate, usa campo direto */}
              <Text style={styles.infoLabel}>Criado em</Text>
              <Text style={styles.infoValue}>{ticket.created_at}</Text>
            </View>
            <View style={styles.infoCell}>
              <Text style={styles.infoLabel}>Status</Text>
              <StatusBadge status={ticket.status} />
            </View>
          </View>
        </View>

        {/* Descrição */}
        {ticket.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Descricao</Text>
            <View style={styles.descriptionBox}>
              <Text style={styles.descriptionText}>{ticket.description}</Text>
            </View>
          </View>
        )}

        {/* Anexos */}
        <View style={styles.section}>
          <View style={styles.attachmentsHeader}>
            <Text style={styles.sectionTitle}>
              Anexos ({attachments.length})
            </Text>
            <TouchableOpacity style={styles.addAttachBtn} onPress={() => setShowAttachMenu(true)}>
              <MaterialCommunityIcons name="plus" size={18} color="#fff" />
              <Text style={styles.addAttachText}>Adicionar</Text>
            </TouchableOpacity>
          </View>
          {attachments.map(att => (
            <AttachmentRow
              key={att.id}
              attachment={att}
              onView={() => handleViewAttachment(att)}
              onDelete={() => handleDeleteAttachment(att.id, att.local_path, att.name)}
            />
          ))}
        </View>

        {/* Timeline */}
        {timeline.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Historico</Text>
            {timeline.map(entry => (
              <TimelineItem
                key={entry.id}
                type={entry.type}
                text={entry.text}
                createdAt={entry.created_at}
              />
            ))}
          </View>
        )}

        <View style={{ height: 70 }} />
      </ScrollView>

      {/* ── BARRA DE COMENTÁRIO ───────────────────────────────────────── */}
      <View style={styles.commentBar}>
        <TextInput
          style={styles.commentInput}
          placeholder="Adicionar comentario..."
          placeholderTextColor={Colors.textDim}
          value={comment}
          onChangeText={setComment}
          multiline
          maxLength={500}
        />
        {comment.length >= 400 && (
          <Text style={{ fontSize: 11, textAlign: 'right', color: Colors.textDim }}>
            {comment.length}/500
          </Text>
        )}
        <TouchableOpacity
          style={[styles.sendButton, !comment.trim() && styles.sendButtonDisabled]}
          onPress={handleSendComment}
          disabled={!comment.trim()}
        >
          <MaterialCommunityIcons
            name="send"
            size={20}
            color={!comment.trim() ? Colors.textDim : '#fff'}
          />
        </TouchableOpacity>
      </View>

      {/* ── MODAIS ────────────────────────────────────────────────────── */}

      <TransitionModal
        visible={showTransitionModal}
        onClose={() => { setShowTransitionModal(false); setTransitionTarget(''); }}
        ticketId={ticketId}
        currentStatus={ticket.status}
        newStatus={transitionTarget}
        onConfirm={handleConfirmTransition}
      />

      <ConfirmDialog
        visible={showReabrirDialog}
        title="Reabrir chamado"
        message="Deseja reabrir este chamado?"
        onConfirm={handleConfirmReabrir}
        onCancel={() => setShowReabrirDialog(false)}
      />

      <ConfirmDialog
        visible={showDeleteDialog}
        title="Excluir chamado"
        message={`Deseja excluir "${ticket.title}"? Esta acao nao pode ser desfeita.`}
        onConfirm={handleDeleteTicket}
        onCancel={() => setShowDeleteDialog(false)}
      />

      <TicketModal
        visible={showEditModal}
        onClose={handleEditModalClose}
        editTicketId={ticketId}
      />

      <ImageViewerModal
        visible={showImageViewer}
        onClose={() => setShowImageViewer(false)}
        imageUri={viewerImageUri}
      />

      {/* Menu de seleção de tipo de anexo */}
      {showAttachMenu && (
        <View style={StyleSheet.absoluteFill}>
          <TouchableOpacity
            style={styles.attachMenuOverlay}
            onPress={() => setShowAttachMenu(false)}
          >
            <View style={styles.attachMenuContainer}>
              <TouchableOpacity
                style={styles.attachMenuItem}
                onPress={() => { setShowAttachMenu(false); handleAddAttachment('camera'); }}
              >
                <MaterialCommunityIcons name="camera" size={24} color={Colors.blue} />
                <Text style={styles.attachMenuText}>Tirar foto</Text>
              </TouchableOpacity>
              <View style={styles.attachMenuDivider} />
              <TouchableOpacity
                style={styles.attachMenuItem}
                onPress={() => { setShowAttachMenu(false); handleAddAttachment('gallery'); }}
              >
                <MaterialCommunityIcons name="image" size={24} color={Colors.blue} />
                <Text style={styles.attachMenuText}>Galeria</Text>
              </TouchableOpacity>
              <View style={styles.attachMenuDivider} />
              <TouchableOpacity
                style={styles.attachMenuItem}
                onPress={() => { setShowAttachMenu(false); handleAddAttachment('document'); }}
              >
                <MaterialCommunityIcons name="file-document" size={24} color={Colors.blue} />
                <Text style={styles.attachMenuText}>Arquivo</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </View>
      )}

    </SafeAreaView>
  );
}

// ─── ESTILOS ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  notFoundText: {
    color: Colors.textMuted,
    fontSize: FontSize.lg,
  },
  backButtonLarge: {
    backgroundColor: Colors.surfaceAlt,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    marginTop: Spacing.sm,
  },
  backButtonTextLarge: {
    color: Colors.blue,
    fontSize: FontSize.base,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.xs,
  },
  headerBtn: {
    padding: Spacing.xs,
  },
  headerTitle: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: Spacing.md,
    paddingBottom: 80,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  attachmentsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addAttachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.blue,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.md,
    marginRight: Spacing.lg,
  },
  addAttachText: {
    color: '#fff',
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  attachMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  attachMenuContainer: {
    backgroundColor: Colors.surface,
    width: '90%',
    borderRadius: Radius.lg,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  attachMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  attachMenuText: {
    color: Colors.textPrimary,
    fontSize: FontSize.base,
    fontWeight: '500',
  },
  attachMenuDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.lg,
  },
  transitionRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    flexWrap: 'wrap',
  },
  transitionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceAlt,
  },
  transitionBtnDanger: {
    backgroundColor: Colors.red,
    borderColor: Colors.red,
  },
  transitionBtnWarning: {
    borderColor: Colors.yellow,
    backgroundColor: Colors.yellow + '15',
  },
  transitionText: {
    color: Colors.blue,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  infoCell: {
    width: '50%',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  infoLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
  },
  infoValue: {
    color: Colors.textPrimary,
    fontSize: FontSize.base,
    fontWeight: '500',
  },
  descriptionBox: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginHorizontal: Spacing.lg,
  },
  descriptionText: {
    color: Colors.textPrimary,
    fontSize: FontSize.base,
    lineHeight: 22,
  },
  commentBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.sm,
  },
  commentInput: {
    flex: 1,
    backgroundColor: Colors.surfaceAlt,
    color: Colors.textPrimary,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.base,
    maxHeight: 100,
    minHeight: 36,
  },
  sendButton: {
    backgroundColor: Colors.blue,
    borderRadius: Radius.full,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: Colors.surfaceAlt,
  },
});
