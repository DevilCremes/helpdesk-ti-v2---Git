/**
 * Tela de Detalhes do Chamado (Ticket Detail Screen)
 *
 * Este arquivo contém a implementação da tela que exibe os detalhes completos
 * de um chamado de suporte técnico, incluindo:
 * - Informações do chamado (título, solicitante, status, prioridade, categoria)
 * - Timeline de eventos e comentários
 * - Anexos (fotos, documentos, áudios)
 * - Controles de transição de status
 * - Edição e exclusão do chamado
 *
 * Funcionalidades principais:
 * - Visualização de anexos com modal fullscreen para imagens
 * - Adição de anexos via câmera, galeria ou seletor de arquivos
 * - Exclusão de anexos com confirmação
 * - Envio de comentários
 * - Transição de status do chamado
 * - Cópia de resumo do chamado para a área de transferência
 */

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

// Componentes customizados
import TimelineItem from '../../src/components/TimelineItem';
import AttachmentRow from '../../src/components/AttachmentRow';
import { StatusBadge, PriorityBadge } from '../../src/components/StatusBadge';
import ConfirmDialog from '../../src/components/ConfirmDialog';
import TicketModal from '../../src/modals/TicketModal';
import TransitionModal from '../../src/modals/TransitionModal';
import ImageViewerModal from '../../src/modals/ImageViewerModal';

// Repositórios de dados
import { ticketRepo, timelineRepo, attachmentRepo } from '../../src/db';

// Utilitários
import { deleteFile, isImage, saveFile } from '../../src/utils/fileUtils';
import { nowStr } from '../../src/utils/dateUtils';

// Estado global e tema
import { useAppStore } from '../../src/stores/appStore';
import { Colors, Spacing, FontSize, Radius } from '../../src/constants/theme';
import { useMediaPermissions } from '../../src/hooks/useMediaPermissions';

// ============================================================================
// CONSTANTES DE TRANSIÇÃO DE STATUS
// ============================================================================

/**
 * Define as transições de status possíveis para cada estado do chamado.
 * Chave: status atual. Valor: array de status permitidos para transição.
 */
const STATUS_TRANSITIONS: Record<string, string[]> = {
  aberto: ['andamento', 'aguardando', 'fechado'],
  andamento: ['aguardando', 'fechado'],
  aguardando: ['aberto', 'andamento', 'fechado'],
  fechado: ['aberto'],
};

/**
 * Rótulos amigáveis para os botões de transição de status.
 */
const TRANSITION_LABELS: Record<string, string> = {
  aberto: 'Reabrir',
  andamento: 'Em andamento',
  aguardando: 'Aguardando',
  fechado: 'Fechar',
};

/**
 * Ícones associados a cada transição de status.
 */
const TRANSITION_ICONS: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  aberto: 'restore',
  andamento: 'play-circle-outline',
  aguardando: 'pause-circle-outline',
  fechado: 'close-circle-outline',
};

/**
 * Retorna os status de transição permitidos para um status atual.
 * @param status Status atual do chamado
 * @returns Array de status permitidos para transição
 */
function getStatusTransitions(status: string): string[] {
  return STATUS_TRANSITIONS[status] || [];
}

/**
 * Formata a data do chamado para exibição.
 * @param dateStr String da data
 * @returns Data formatada
 */
function formatTicketDate(dateStr: string): string {
  return dateStr;
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

/**
 * Componente principal da tela de detalhes do chamado.
 * Gerencia o estado e a interação do usuário com as informações do chamado.
 */
export default function TicketDetailScreen() {
  // -------------------------------------------------------------------------
  // HOOKS E ESTADO
  // -------------------------------------------------------------------------

  // Obtém parâmetros da URL e router para navegação
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { showToast } = useAppStore();

  // ID do chamado atual (string extraída dos parâmetros da URL)
  const ticketId = typeof id === 'string' ? id : (id?.[0] ?? '');

  // Estado dos dados do chamado
  const [ticket, setTicket] = useState<ReturnType<typeof ticketRepo.getById>>(null);
  const [timeline, setTimeline] = useState<ReturnType<typeof timelineRepo.getByTicket>>([]);
  const [attachments, setAttachments] = useState<ReturnType<typeof attachmentRepo.getByTicket>>([]);

  // Estado do input de comentário
  const [comment, setComment] = useState('');

  // Controle de modais
  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [transitionTarget, setTransitionTarget] = useState<string>('');
  const [showReabrirDialog, setShowReabrirDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  // Visualizador de imagem em fullscreen
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [viewerImageUri, setViewerImageUri] = useState('');

  // -------------------------------------------------------------------------
  // CARREGAMENTO DE DADOS
  // -------------------------------------------------------------------------

  /**
   * Carrega os dados do chamado, timeline e anexos do banco de dados.
   * Executado quando o componente é montado ou o ticketId muda.
   */
  const loadData = useCallback(() => {
    if (!ticketId) return;
    const t = ticketRepo.getById(ticketId);
    setTicket(t);
    if (t) {
      setTimeline(timelineRepo.getByTicket(ticketId));
      setAttachments(attachmentRepo.getByTicket(ticketId));
    }
  }, [ticketId]);

  // Recarrega dados quando a tela ganha foco (após navegação)
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // -------------------------------------------------------------------------
  // HANDLERS - TRANSIÇÃO DE STATUS
  // -------------------------------------------------------------------------

  /**
   * Inicia o processo de transição de status.
   * Se for 'aberto', mostra diálogo de confirmação.
   * Caso contrário, abre o modal de transição.
   * @param newStatus Status destino da transição
   */
  const handleTransition = useCallback((newStatus: string) => {
    if (newStatus === 'aberto') {
      setShowReabrirDialog(true);
    } else {
      setTransitionTarget(newStatus);
      setShowTransitionModal(true);
    }
  }, []);

  /**
   * Confirma a transição de status no banco de dados.
   */
  const handleConfirmTransition = useCallback(() => {
    if (!ticketId || !transitionTarget) return;
    ticketRepo.update(ticketId, { status: transitionTarget });
    setShowTransitionModal(false);
    setTransitionTarget('');
    loadData();
    showToast('Status atualizado');
  }, [ticketId, transitionTarget, loadData, showToast]);

  /**
   * Confirma a reabertura do chamado.
   * Adiciona entrada no timeline e atualiza o status.
   */
  const handleConfirmReabrir = useCallback(() => {
    if (!ticketId) return;
    timelineRepo.add(ticketId, 'reopen', 'Chamado reaberto.');
    ticketRepo.update(ticketId, { status: 'aberto' });
    setShowReabrirDialog(false);
    loadData();
    showToast('Chamado reaberto');
  }, [ticketId, loadData, showToast]);

  // -------------------------------------------------------------------------
  // HANDLERS - EXCLUSÃO DO CHAMADO
  // -------------------------------------------------------------------------

  /**
   * Exclui o chamado e todos os seus anexos do sistema.
   * Primeiro remove os arquivos do sistema de arquivos,
   * depois exclui do banco de dados (anexos são excluídos em cascata).
   */
  const handleDeleteTicket = useCallback(async () => {
    if (!ticketId || !ticket) return;
    // Exclui anexos do sistema de arquivos
    for (const att of attachments) {
      await deleteFile(att.local_path);
    }
    // Exclui do banco (anexos excluídos via ON DELETE CASCADE)
    ticketRepo.delete(ticketId);
    router.back();
    showToast('Chamado excluido');
  }, [ticketId, ticket, attachments, router, showToast]);

  // -------------------------------------------------------------------------
  // HANDLERS - COMENTÁRIOS
  // -------------------------------------------------------------------------

  /**
   * Envia um novo comentário para o chamado.
   * Valida se o comentário não está vazio antes de enviar.
   */
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

  // -------------------------------------------------------------------------
  // HANDLERS - UTILITÁRIOS
  // -------------------------------------------------------------------------

  /**
   * Copia o resumo do chamado para a área de transferência.
   * Inclui: ID, título, solicitante, status, prioridade, categoria e data.
   */
  const handleCopySummary = useCallback(async () => {
    if (!ticket) return;
    const summary = `Chamado #${ticket.id}
Titulo: ${ticket.title}
Solicitante: ${ticket.requester}
Status: ${ticket.status}
Prioridade: ${ticket.priority}
Categoria: ${ticket.category}
Criado em: ${ticket.created_at}`;
    await Clipboard.setStringAsync(summary);
    showToast('Informacoes copiadas');
  }, [ticket, showToast]);

  // -------------------------------------------------------------------------
  // HANDLERS - ANEXOS
  // -------------------------------------------------------------------------

  /**
   * Hooks para gerenciar permissões de acesso à câmera e galeria.
   * Solicita permissão ao usuário quando necessário.
   */
  const { requestCamera, requestGallery } = useMediaPermissions();

  /**
   * Visualiza um anexo específico.
   * Se for imagem, abre o visualizador em fullscreen.
   * Se for outro tipo de arquivo, exibe informações em um Alert.
   * @param att Objeto do anexo com nome, tamanho, tipo MIME e caminho local
   */
  const handleViewAttachment = useCallback((att: {
    name: string;
    size: number;
    mime_type: string | null;
    local_path: string;
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

  /**
   * Adiciona um novo anexo ao chamado.
   * Suporta três fontes: câmera, galeria e seletor de documentos.
   * Salva o arquivo no sistema de arquivos do app e registra no banco.
   * Adiciona entrada automática no timeline.
   * @param source Fonte do anexo: 'camera' | 'gallery' | 'document'
   */
  const handleAddAttachment = useCallback(async (source: 'camera' | 'gallery' | 'document') => {
    if (!ticketId) return;

    let result;

    if (source === 'camera') {
      // Solicita permissão e abre a câmera
      const ok = await requestCamera();
      if (!ok) return;
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images', 'videos'],
        quality: 0.8,
      });
    } else if (source === 'gallery') {
      // Solicita permissão e abre a galeria
      const ok = await requestGallery();
      if (!ok) return;
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        quality: 0.8,
      });
    } else {
      // Abre seletor de documentos para qualquer tipo de arquivo
      result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
    }

    // Processa o resultado se não foi cancelado
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      const fileName = asset.name || asset.fileName || `file_${Crypto.randomUUID()}`;
      const fileSize = asset.size || asset.fileSize || 0;

      try {
        // Salva arquivo no sistema de arquivos do app
        const localPath = await saveFile(asset.uri, fileName);

        // Registra no banco de dados
        attachmentRepo.add({
          ticketId,
          name: fileName,
          size: fileSize,
          mimeType: asset.mimeType,
          localPath,
        });

        // Adiciona entrada no timeline
        timelineRepo.add(ticketId, 'attach', `Anexo adicionado: ${fileName}`);

        // Recarrega dados e mostra confirmação
        loadData();
        showToast('Anexo adicionado');
      } catch (e) {
        showToast('Erro ao adicionar anexo', { isError: true });
      }
    }
  }, [ticketId, loadData, showToast, requestCamera, requestGallery]);

  /**
   * Exclui um anexo do chamado.
   * Mostra diálogo de confirmação antes de excluir.
   * Remove do sistema de arquivos e do banco de dados.
   * @param attId ID do anexo no banco
   * @param attPath Caminho do arquivo no sistema de arquivos
   * @param attName Nome do arquivo para exibição
   */
  const handleDeleteAttachment = useCallback(async (attId: number, attPath: string, attName: string) => {
    Alert.alert(
      'Excluir anexo',
      `Deseja excluir "${attName}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
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

  /**
   * Fecha o modal de edição e recarrega os dados do chamado.
   * Chamado após salvar alterações no TicketModal.
   */
  const handleEditModalClose = useCallback(() => {
    setShowEditModal(false);
    loadData();
  }, [loadData]);

  // -------------------------------------------------------------------------
  // RENDERIZAÇÃO
  // -------------------------------------------------------------------------

  // Calcula transições de status permitidas para o status atual
  const transitions = ticket ? getStatusTransitions(ticket.status) : [];

  // Estado de carregamento ou chamado não encontrado
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
      {/* Comment section end */}

        HEADER
      /* ================================================================ */}
      <View style={styles.header}>
        {/* Botão voltar */}
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>

        {/* Título do chamado */}
        <Text style={styles.headerTitle} numberOfLines={1} adjustsFontSizeToFit>
          {ticket.title}
        </Text>

        {/* Botão copiar resumo */}
        <TouchableOpacity style={styles.headerBtn} onPress={handleCopySummary}>
          <MaterialCommunityIcons name="content-copy" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>

        {/* Botão editar */}
        <TouchableOpacity style={styles.headerBtn} onPress={() => setShowEditModal(true)}>
          <MaterialCommunityIcons name="pencil" size={20} color={Colors.blue} />
        </TouchableOpacity>

        {/* Botão excluir */}
        <TouchableOpacity style={styles.headerBtn} onPress={() => setShowDeleteDialog(true)}>
          <MaterialCommunityIcons name="trash-can-outline" size={20} color={Colors.red} />
        </TouchableOpacity>
      </View>

      {/* ================================================================
SCROLL CONTENT
=============================================================== */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ----------------------------------------------------------- */
        /* TRANSITION BUTTONS - Botões de transição de status          */
        /* ----------------------------------------------------------- */}
        {transitions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Transicoes de status</Text>
            <View style={styles.transitionRow}>
              {transitions.map(ts => (
                <TouchableOpacity
                  key={ts}
                  style={[
                    styles.transitionBtn,
                    ts === 'fechado' && styles.transitionBtnDanger,
                    ts === 'aberto' && styles.transitionBtnWarning,
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
                    ts === 'aberto' && { color: Colors.yellow },
                  ]}>
                    {TRANSITION_LABELS[ts] || ts}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ----------------------------------------------------------- */
        /* INFO GRID - Informações do chamado                          */
        /* ----------------------------------------------------------- */}
        <View style={styles.section}>
          <View style={styles.infoGrid}>
            {/* Prioridade */}
            <View style={styles.infoCell}>
              <Text style={styles.infoLabel}>Prioridade</Text>
              <PriorityBadge priority={ticket.priority} />
            </View>
            {/* Categoria */}
            <View style={styles.infoCell}>
              <Text style={styles.infoLabel}>Categoria</Text>
              <Text style={styles.infoValue}>{ticket.category}</Text>
            </View>
            {/* Solicitante */}
            <View style={styles.infoCell}>
              <Text style={styles.infoLabel}>Solicitante</Text>
              <Text style={styles.infoValue}>{ticket.requester}</Text>
            </View>
            {/* Data de criação */}
            <View style={styles.infoCell}>
              <Text style={styles.infoLabel}>Criado em</Text>
              <Text style={styles.infoValue}>{formatTicketDate(ticket.created_at)}</Text>
            </View>
            {/* Status */}
            <View style={styles.infoCell}>
              <Text style={styles.infoLabel}>Status</Text>
              <StatusBadge status={ticket.status} />
            </View>
          </View>
        </View>

        {/* ----------------------------------------------------------- */
        /* DESCRIPTION - Descrição do chamado                          */
        /* ----------------------------------------------------------- */}
        {ticket.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Descricao</Text>
            <View style={styles.descriptionBox}>
              <Text style={styles.descriptionText}>{ticket.description}</Text>
            </View>
          </View>
        )}

        {/* ----------------------------------------------------------- */
        /* ATTACHMENTS - Anexos do chamado                             */
        /* ----------------------------------------------------------- */}
        <View style={styles.section}>
          {/* Cabeçalho com título e botão adicionar */}
          <View style={styles.attachmentsHeader}>
            <Text style={styles.sectionTitle}>
              Anexos ({attachments.length})
            </Text>
            <TouchableOpacity style={styles.addAttachBtn} onPress={() => setShowAttachMenu(true)}>
              <MaterialCommunityIcons name='plus' size={18} color='#fff' />
              <Text style={styles.addAttachText}>Adicionar</Text>
            </TouchableOpacity>
          </View>
          {/* Lista de anexos */}
          {attachments.map(att => (
            <AttachmentRow
              key={att.id}
              attachment={att}
              onView={() => handleViewAttachment(att)}
              onDelete={() => handleDeleteAttachment(att.id, att.local_path, att.name)}
            />
          ))}
        </View>

        {/* ----------------------------------------------------------- */
        /* TIMELINE - Histórico de eventos                             */
        /* ----------------------------------------------------------- */}
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

        {/* Espaço reservado para barra de comentário fixa */}
        <View style={{ height: 70 }} />
      </ScrollView>

      
      {/* COMMENT BAR - Barra de comentário fixa na parte inferior */}
      {/* Comment section end */}

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
          <Text style={{fontSize:11, textAlign:'right', color: Colors.textDim}}>
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

      {/* ================================================================
        MODAIS
================================================================ */}

      {/* Modal de transição de status (com observação opcional) */}
      <TransitionModal
        visible={showTransitionModal}
        onClose={() => { setShowTransitionModal(false); setTransitionTarget(''); }}
        ticketId={ticketId}
        currentStatus={ticket.status}
        newStatus={transitionTarget}
        onConfirm={handleConfirmTransition}
      />

      {/* Diálogo de confirmação para reabrir chamado */}
      <ConfirmDialog
        visible={showReabrirDialog}
        title="Reabrir chamado"
        message="Deseja reabrir este chamado?"
        onConfirm={handleConfirmReabrir}
        onCancel={() => setShowReabrirDialog(false)}
      />

      {/* Diálogo de confirmação para excluir chamado */}
      <ConfirmDialog
        visible={showDeleteDialog}
        title="Excluir chamado"
        message={`Deseja excluir "${ticket.title}"? Esta acao nao pode ser desfeita.`}
        onConfirm={handleDeleteTicket}
        onCancel={() => setShowDeleteDialog(false)}
      />

      {/* Modal de edição do chamado */}
      <TicketModal
        visible={showEditModal}
        onClose={handleEditModalClose}
        editTicketId={ticketId}
      />

      {/* Visualizador de imagem em fullscreen */}
      <ImageViewerModal
        visible={showImageViewer}
        onClose={() => setShowImageViewer(false)}
        imageUri={viewerImageUri}
      />

      {/* --------------------------------------------------------------- */}
      {/* MENU DE ANEXOS - Modal inferior para escolher tipo de anexo    */}
      {/* --------------------------------------------------------------- */}
      {showAttachMenu && (
        <View style={StyleSheet.absoluteFill}>
          {/* Overlay escuro com dismiss ao tocar fora */}
          <TouchableOpacity style={styles.attachMenuOverlay} onPress={() => setShowAttachMenu(false)}>
            {/* Container do menu */}
            <View style={styles.attachMenuContainer}>
              {/* Opção: Câmera */}
              <TouchableOpacity
                style={styles.attachMenuItem}
                onPress={() => { setShowAttachMenu(false); handleAddAttachment('camera'); }}
              >
                <MaterialCommunityIcons name='camera' size={24} color={Colors.blue} />
                <Text style={styles.attachMenuText}>Tirar foto</Text>
              </TouchableOpacity>
              <View style={styles.attachMenuDivider} />
              {/* Opção: Galeria */}
              <TouchableOpacity
                style={styles.attachMenuItem}
                onPress={() => { setShowAttachMenu(false); handleAddAttachment('gallery'); }}
              >
                <MaterialCommunityIcons name='image' size={24} color={Colors.blue} />
                <Text style={styles.attachMenuText}>Galeria</Text>
              </TouchableOpacity>
              <View style={styles.attachMenuDivider} />
              {/* Opção: Documento (qualquer arquivo) */}
              <TouchableOpacity
                style={styles.attachMenuItem}
                onPress={() => { setShowAttachMenu(false); handleAddAttachment('document'); }}
              >
                <MaterialCommunityIcons name='file-document' size={24} color={Colors.blue} />
                <Text style={styles.attachMenuText}>Arquivo</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

// ==============================================================================
// ESTILOS
// ==============================================================================

const styles = StyleSheet.create({
  // Container principal da tela
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },

  // Tela centralizada para estados de carregamento/erro
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

  // ---------------------------------------------------------------------------
  // HEADER - Cabeçalho da tela
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // SCROLL - Área de conteúdo rolável
  // ---------------------------------------------------------------------------
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: Spacing.md,
    paddingBottom: 80,
  },

  // ---------------------------------------------------------------------------
  // SECTIONS - Seções de conteúdo
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // ATTACHMENTS HEADER - Cabeçalho da seção de anexos
  // ---------------------------------------------------------------------------
  attachmentsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  /**
   * Botão principal "Adicionar" para abrir o menu de opções de anexo.
   * Combina ícone plus com texto em um botão azul arredondado.
   */
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

  // ---------------------------------------------------------------------------
  // ATTACHMENT MENU - Modal de seleção de tipo de anexo
  // ---------------------------------------------------------------------------
  /**
   * Overlay escuro semitransparente que cobre toda a tela.
   * Fecha o menu ao tocar fora do container.
   */
  attachMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  /**
   * Container do menu, posicionado na parte inferior da tela.
   * Estilo modal "bottom sheet" com bordas arredondadas.
   */
  attachMenuContainer: {
    backgroundColor: Colors.surface,
    width: '90%',
    borderRadius: Radius.lg,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  /**
   * Item individual do menu (linha clicável com ícone + texto).
   */
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
  /**
   * Divisor horizontal entre os itens do menu.
   */
  attachMenuDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.lg,
  },

  // ---------------------------------------------------------------------------
  // TRANSITIONS - Botões de transição de status
  // ---------------------------------------------------------------------------
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
  /**
   * Estilo para botão de transição perigosa (ex: Fechar chamado).
   * Vermelho com texto branco.
   */
  transitionBtnDanger: {
    backgroundColor: Colors.red,
    borderColor: Colors.red,
  },
  /**
   * Estilo para botão de transição de aviso (ex: Reabrir).
   * Borda amarela com fundo levemente amarelado.
   */
  transitionBtnWarning: {
    borderColor: Colors.yellow,
    backgroundColor: Colors.yellow + '15',
  },
  transitionText: {
    color: Colors.blue,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },

  // ---------------------------------------------------------------------------
  // INFO GRID - Grid de informações do chamado
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // DESCRIPTION - Caixa de descrição do chamado
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // COMMENT BAR - Barra de comentário fixa na parte inferior
  // ---------------------------------------------------------------------------
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
