import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import BottomSheet from '../components/BottomSheet';
import { ticketRepo, attachmentRepo, timelineRepo, categoryRepo, Category } from '../db';
import { useAppStore } from '../stores/appStore';
import { useMediaPermissions } from '../hooks/useMediaPermissions';
import { saveFile, deleteFile } from '../utils/fileUtils';
import { fmtSize } from '../utils/dateUtils';
import { Colors, Spacing, FontSize, Radius, priColor } from '../constants/theme';

interface TicketModalProps {
  visible: boolean;
  onClose: () => void;
  editTicketId?: string | null;
}

const PRIORITY_OPTIONS = ['baixa', 'media', 'alta', 'urgente'];
const PRIORITY_LABELS: Record<string, string> = { baixa: 'Baixa', media: 'Media', alta: 'Alta', urgente: 'Urgente' };

export default function TicketModal({ visible, onClose, editTicketId }: TicketModalProps) {
  const { currentCompanyId, showToast } = useAppStore();
  const { requestCamera, requestGallery } = useMediaPermissions();

  const [titulo, setTitulo] = useState('');
  const [solicitante, setSolicitante] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [prioridade, setPrioridade] = useState('media');
  const [descricao, setDescricao] = useState('');
  const [attachments, setAttachments] = useState<{ uri: string; name: string; size: number; mimeType?: string; savedPath?: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [showCatPicker, setShowCatPicker] = useState(false);

  const isEdit = !!editTicketId;
  const [originalValues, setOriginalValues] = useState<Record<string, any> | null>(null);
  const selectedCat = useMemo(() => categories.find(c => c.id === categoryId), [categories, categoryId]);

  // ─── Load data for edit mode ──────────────────────────────────────────────
  useEffect(() => {
    if (visible && isEdit) {
      const ticket = ticketRepo.getById(editTicketId!);
      if (ticket) {
        setTitulo(ticket.title);
        setSolicitante(ticket.requester);
        setPrioridade(ticket.priority);
        setDescricao(ticket.description ?? '');

        const cats = categoryRepo.getAll();
        const cat = cats.find(c => c.name === ticket.category);
        setCategoryId(cat?.id ?? null);

        const atts = attachmentRepo.getByTicket(editTicketId!);
        setAttachments(atts.map(a => ({ uri: a.local_path, name: a.name, size: a.size, mimeType: a.mime_type ?? undefined, savedPath: a.local_path })));

        setOriginalValues({
          title: ticket.title, requester: ticket.requester,
          category: ticket.category, priority: ticket.priority,
          description: ticket.description,
        });
      }
    }
  }, [visible, editTicketId, isEdit]);

  // ─── Load pickers on open ─────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      setCategories(categoryRepo.getAll());
      if (!isEdit) {
        setTitulo(''); setSolicitante(''); setCategoryId(null);
        setPrioridade('media'); setDescricao('');
        setAttachments([]); setOriginalValues(null);
      }
    }
  }, [visible, isEdit]);

  // ─── Attachment handling ──────────────────────────────────────────────────
  const pickFromCamera = async () => {
    const ok = await requestCamera();
    if (!ok) return;
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images', 'videos'], quality: 0.8 });
    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      setAttachments(prev => [...prev, { uri: asset.uri, name: asset.fileName ?? `photo_${Crypto.randomUUID()}.jpg`, size: asset.fileSize ?? 0, mimeType: asset.mimeType }]);
    }
  };

  const pickFromGallery = async () => {
    const ok = await requestGallery();
    if (!ok) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.8 });
    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      setAttachments(prev => [...prev, { uri: asset.uri, name: asset.fileName ?? `file_${Crypto.randomUUID()}`, size: asset.fileSize ?? 0, mimeType: asset.mimeType }]);
    }
  };

  const removeAttachment = (index: number) => {
    const att = attachments[index];
    if (att.savedPath) deleteFile(att.savedPath);
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // ─── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!titulo.trim()) { showToast('Titulo e obrigatorio', { isError: true }); return; }
    if (!solicitante.trim()) { showToast('Solicitante e obrigatorio', { isError: true }); return; }

    setLoading(true);
    try {
      const savedPaths: { path: string; name: string; size: number; mime?: string }[] = [];
      for (const att of attachments) {
        if (!att.savedPath) {
          const localPath = await saveFile(att.uri, att.name);
          savedPaths.push({ path: localPath, name: att.name, size: att.size, mime: att.mimeType });
        }
      }

      if (isEdit && editTicketId) {
        const changes: string[] = [];
        const updates: Record<string, any> = {};

        if (titulo.trim() !== originalValues?.title) { changes.push(`Titulo: "${originalValues?.title}" -> "${titulo.trim()}"`); updates.title = titulo.trim(); }
        if (solicitante.trim() !== originalValues?.requester) { changes.push(`Solicitante: "${originalValues?.requester}" -> "${solicitante.trim()}"`); updates.requester = solicitante.trim(); }

        const newCat = selectedCat?.name ?? categories[0]?.name ?? 'Outro';
        if (newCat !== originalValues?.category) { changes.push(`Categoria: "${originalValues?.category}" -> "${newCat}"`); updates.category = newCat; }

        if (prioridade !== originalValues?.priority) { changes.push(`Prioridade: "${originalValues?.priority}" -> "${prioridade}"`); updates.priority = prioridade; }
        if (descricao.trim() !== originalValues?.description) { changes.push(`Descricao atualizada`); updates.description = descricao.trim(); }

        ticketRepo.update(editTicketId, updates);

        if (changes.length > 0) {
          timelineRepo.add(editTicketId, 'edit', `Campos editados:\n${changes.join('\n')}`);
        }

        for (const sp of savedPaths) {
          attachmentRepo.add({ ticketId: editTicketId, name: sp.name, size: sp.size, mimeType: sp.mime, localPath: sp.path });
          timelineRepo.add(editTicketId, 'attach', `Anexo adicionado: ${sp.name}`);
        }

        showToast('Chamado atualizado!');
      } else {
        const catName = selectedCat?.name ?? categories[0]?.name ?? 'Outro';
        const ticketId = ticketRepo.create({
          companyId: currentCompanyId,
          title: titulo.trim(),
          requester: solicitante.trim(),
          category: catName,
          priority: prioridade,
          description: descricao.trim(),
        });

        for (const sp of savedPaths) {
          attachmentRepo.add({ ticketId, name: sp.name, size: sp.size, mimeType: sp.mime, localPath: sp.path });
        }

        showToast('Chamado criado!');
      }

      resetForm();
      onClose();
    } catch (e: any) {
      showToast('Erro ao salvar chamado', { isError: true });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitulo(''); setSolicitante(''); setCategoryId(null);
    setPrioridade('media'); setDescricao('');
    setAttachments([]); setOriginalValues(null);
  };

  const handleClose = () => {
    for (const att of attachments) {
      if (att.savedPath && !isEdit) deleteFile(att.savedPath);
    }
    resetForm();
    onClose();
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <BottomSheet visible={visible} onClose={handleClose} height={600}>
      <View style={styles.header}>
        <Text style={styles.title}>{isEdit ? 'Editar Chamado' : 'Novo Chamado'}</Text>
        <TouchableOpacity onPress={handleClose}>
          <MaterialCommunityIcons name="close" size={24} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Titulo *</Text>
        <TextInput style={styles.input} value={titulo} onChangeText={setTitulo} placeholder="Resumo do problema" placeholderTextColor={Colors.textDim} />

        <Text style={styles.label}>Solicitante *</Text>
        <TextInput style={styles.input} value={solicitante} onChangeText={setSolicitante} placeholder="Nome do solicitante" placeholderTextColor={Colors.textDim} />

        <Text style={styles.label}>Categoria</Text>
        <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowCatPicker(!showCatPicker)}>
          <Text style={[styles.pickerBtnText, !selectedCat && { color: Colors.textDim }]}>
            {selectedCat?.name ?? 'Selecionar categoria...'}
          </Text>
          <MaterialCommunityIcons name="chevron-down" size={20} color={Colors.textMuted} />
        </TouchableOpacity>
        {showCatPicker && (
          <View style={styles.pickerDropdown}>
            <ScrollView showsVerticalScrollIndicator={true} nestedScrollEnabled={true}>
              {categories.map(cat => (
                <TouchableOpacity key={cat.id} style={styles.pickerOption} onPress={() => { setCategoryId(cat.id); setShowCatPicker(false); }}>
                  <Text style={styles.pickerOptionText}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <Text style={styles.label}>Prioridade</Text>
        <View style={styles.priRow}>
          {PRIORITY_OPTIONS.map(pri => (
            <TouchableOpacity key={pri} style={[styles.priBtn, prioridade === pri && { borderColor: priColor(pri), backgroundColor: priColor(pri) + '20' }]} onPress={() => setPrioridade(pri)}>
              <Text style={[styles.priBtnText, prioridade === pri && { color: priColor(pri) }]}>{PRIORITY_LABELS[pri]}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Descricao</Text>
        <TextInput style={[styles.input, styles.textArea]} value={descricao} onChangeText={setDescricao} placeholder="Descricao detalhada..." placeholderTextColor={Colors.textDim} multiline numberOfLines={4} textAlignVertical="top" />

        <Text style={styles.label}>Anexos</Text>
        <View style={styles.attachActions}>
          <TouchableOpacity style={styles.attachBtn} onPress={pickFromCamera}>
            <MaterialCommunityIcons name="camera" size={20} color={Colors.blue} />
            <Text style={styles.attachBtnText}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.attachBtn} onPress={pickFromGallery}>
            <MaterialCommunityIcons name="folder-image" size={20} color={Colors.blue} />
            <Text style={styles.attachBtnText}>Galeria</Text>
          </TouchableOpacity>
        </View>
        {attachments.length > 0 && (
          <View style={styles.attachList}>
            {attachments.map((att, i) => (
              <View key={i} style={styles.attachItem}>
                <View style={styles.attachInfo}>
                  <Text style={styles.attachName} numberOfLines={1}>{att.name}</Text>
                  <Text style={styles.attachSize}>{fmtSize(att.size)}</Text>
                </View>
                <TouchableOpacity onPress={() => removeAttachment(i)}>
                  <MaterialCommunityIcons name="close-circle" size={22} color={Colors.red} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {loading ? (
          <ActivityIndicator color={Colors.blue} style={styles.saveButton} />
        ) : (
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>{isEdit ? 'Atualizar Chamado' : 'Criar Chamado'}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  title: { color: Colors.textPrimary, fontSize: FontSize.xl, fontWeight: 'bold' },
  scroll: { paddingBottom: 20 },
  label: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600', marginTop: Spacing.md, marginBottom: Spacing.xs },
  input: { backgroundColor: Colors.surfaceAlt, color: Colors.textPrimary, padding: Spacing.md, borderRadius: Radius.md, fontSize: FontSize.base },
  textArea: { minHeight: 80 },
  pickerBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.surfaceAlt, padding: Spacing.md, borderRadius: Radius.md },
  pickerBtnText: { color: Colors.textPrimary, fontSize: FontSize.base },
  pickerDropdown: { backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, marginTop: 4, maxHeight: 150, overflow: 'hidden' },
  pickerOption: { padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  pickerOptionText: { color: Colors.textPrimary, fontSize: FontSize.base },
  priRow: { flexDirection: 'row', gap: Spacing.xs },
  priBtn: { flex: 1, padding: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceAlt, alignItems: 'center' },
  priBtnText: { color: Colors.textMuted, fontSize: FontSize.sm, fontWeight: '600' },
  attachActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  attachBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.surfaceAlt, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.md },
  attachBtnText: { color: Colors.blue, fontSize: FontSize.base, fontWeight: '500' },
  attachList: { marginTop: Spacing.sm },
  attachItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surfaceAlt, padding: Spacing.sm, borderRadius: Radius.md, marginBottom: Spacing.xs },
  attachInfo: { flex: 1, marginRight: Spacing.sm },
  attachName: { color: Colors.textPrimary, fontSize: FontSize.base },
  attachSize: { color: Colors.textMuted, fontSize: FontSize.xs },
  saveButton: { backgroundColor: Colors.blue, padding: Spacing.lg, borderRadius: Radius.lg, alignItems: 'center', marginTop: Spacing.xl },
  saveButtonText: { color: '#fff', fontSize: FontSize.lg, fontWeight: 'bold' },
});
