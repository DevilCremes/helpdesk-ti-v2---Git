import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import ConfirmDialog from '../../src/components/ConfirmDialog';
import CompanyModal from '../../src/modals/CompanyModal';
import { companyRepo, categoryRepo, Company, Category } from '../../src/db';
import { useAppStore } from '../../src/stores/appStore';
import { exportBackup, importBackup } from '../../src/utils/backupUtils';
import { Colors, Spacing, FontSize, Radius } from '../../src/constants/theme';

export default function ConfigScreen() {
  const { showToast, setOpenModal } = useAppStore();

  // Companies
  const [companies, setCompanies] = useState<Company[]>([]);
  const [showCompanyModal, setShowCompanyModal] = useState(false);

  // Categories
  const [categories, setCategories] = useState<Category[]>([]);
  const [catName, setCatName] = useState('');

  // Confirm dialog
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [showUndo, setShowUndo] = useState(false);
  const [undoAction, setUndoAction] = useState<(() => void) | null>(null);
  const [undoTimeout, setUndoTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  const loadData = useCallback(() => {
    setCompanies(companyRepo.getAll());
    setCategories(categoryRepo.getAll());
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // ─── Company handlers ──────────────────────────────────────────────────
  const handleSelectCompany = (company: Company) => {
    useAppStore.getState().setCurrentCompany(company.id, company.name);
    useAppStore.getState().setViewAllCompanies(false);
    showToast(`Empresa "${company.name}" selecionada`);
  };

  const handleClearCompany = (company: Company) => {
    setConfirmMessage(`Limpar todos os chamados e tarefas de "${company.name}"?`);
    setConfirmAction(() => () => {
      companyRepo.clearData(company.id);
      showToast('Dados da empresa limpos');
      loadData();
    });
    setConfirmVisible(true);
  };

  const [lastUndoRef, setLastUndoRef] = useState<{ id: string; used: boolean } | null>(null);

  const handleDeleteCompany = (company: Company) => {
    // Clear any pending undo timeout
    if (undoTimeout) {
      clearTimeout(undoTimeout);
      setUndoTimeout(null);
    }

    // Generate unique undo ID for this deletion
    const undoId = `${company.id}_${Date.now()}`;

    // Soft delete and backup data
    let backup: { company: Company; tickets: any[]; tasks: any[] } | null = null;
    try {
      backup = companyRepo.softDelete(company.id);
    } catch (e) {
      showToast('Erro ao excluir empresa', { isError: true });
      return;
    }

    // Track undo state
    setLastUndoRef({ id: undoId, used: false });

    const undoAction = () => {
      // Prevent double undo (V5 - idempotencia)
      if (!lastUndoRef || lastUndoRef.used || lastUndoRef.id !== undoId) {
        showToast('Acao ja realizada ou expirada', { isError: true });
        return;
      }

      setLastUndoRef({ id: undoId, used: true });

      if (!backup) {
        showToast('Dados de recuperacao nao disponiveis', { isError: true });
        return;
      }

      try {
        // Check if company with same name exists (V6 - conflito de nome)
        const existingCompany = companyRepo.getById(backup.company.id);
        if (existingCompany) {
          showToast('Empresa ja existe (pode ter sido recriada)', { isError: true });
          return;
        }

        companyRepo.restore(backup);
        showToast('Exclusao desfeita');
        loadData();
        useAppStore.getState().loadCompanies();
      } catch (e: any) {
        if (e.message?.includes('UNIQUE')) {
          showToast('Nao foi possivel desfazer: conflito de nome', { isError: true });
        } else {
          showToast('Erro ao restaurar empresa', { isError: true });
        }
      }
    };

    showToast(`Empresa "${company.name}" excluida`, {
      onUndo: undoAction,
    });

    loadData();
    useAppStore.getState().loadCompanies();

    // Clear undo reference after toast timeout (V3 - cleanup)
    const timeoutId = setTimeout(() => {
      setLastUndoRef(prev => (prev?.id === undoId ? null : prev));
    }, 3600);
    setUndoTimeout(timeoutId);
  };

  // ─── Category handlers ─────────────────────────────────────────────────
  const handleAddCat = () => {
    if (!catName.trim()) { showToast('Preencha o nome da categoria', { isError: true }); return; }
    try {
      categoryRepo.create(catName.trim());
      showToast('Categoria adicionada');
      setCatName('');
      loadData();
    } catch (e: any) {
      if (e.message?.includes('UNIQUE')) showToast('Categoria ja existe', { isError: true });
      else showToast('Erro ao adicionar categoria', { isError: true });
    }
  };

  const handleCompanyModalClose = () => {
    setShowCompanyModal(false);
    loadData();
    useAppStore.getState().loadCompanies();
  };

  const handleDeleteCat = (cat: Category) => {
    setConfirmMessage(`Excluir categoria "${cat.name}"?`);
    setConfirmAction(() => () => {
      categoryRepo.delete(cat.id);
      showToast('Categoria excluida');
      loadData();
    });
    setConfirmVisible(true);
  };

  // ─── Backup handlers ───────────────────────────────────────────────────
  const handleExportBackup = async () => {
    try {
      const result = await exportBackup();
      if (result.success && result.skippedCount) {
        showToast(`${result.skippedCount} anexo(s) nao incluido(s) por exceder 1MB`);
      } else {
        showToast('Backup exportado com sucesso');
      }
    } catch {
      showToast('Erro ao exportar backup', { isError: true });
    }
  };

  const handleImportBackup = async () => {
    try {
      await importBackup();
      showToast('Backup importado com sucesso');
      loadData();
    } catch {
      showToast('Erro ao importar backup', { isError: true });
    }
  };

  // ─── Render section header ─────────────────────────────────────────────
  const renderSectionHeader = (title: string, icon: string) => (
    <View style={styles.sectionHeader}>
      <MaterialCommunityIcons name={icon as any} size={20} color={Colors.blue} />
      <Text style={styles.sectionHeaderTitle}>{title}</Text>
    </View>
  );

  // ─── Render company item ───────────────────────────────────────────────
  const renderCompanyItem = ({ item }: { item: Company }) => {
    const ticketCount = companyRepo.getTicketCount(item.id);
    const taskCount = companyRepo.getTaskCount(item.id);

    return (
      <View style={styles.companyItem}>
        <View style={styles.companyInfo}>
          <Text style={styles.companyName}>{item.name}</Text>
          <Text style={styles.companyCounts}>
            {ticketCount} chamados, {taskCount} tarefas
          </Text>
        </View>
        <View style={styles.companyActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonPrimary]}
            onPress={() => handleSelectCompany(item)}
          >
            <Text style={styles.actionButtonText}>Selecionar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonWarning]}
            onPress={() => handleClearCompany(item)}
          >
            <Text style={styles.actionButtonText}>Limpar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonDanger]}
            onPress={() => handleDeleteCompany(item)}
          >
            <MaterialCommunityIcons name="delete" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ─── Render category item ──────────────────────────────────────────────
  const renderCatItem = ({ item }: { item: Category }) => (
    <View style={styles.listItem}>
      <Text style={styles.listItemText}>{item.name}</Text>
      <TouchableOpacity
        style={styles.deleteIconButton}
        onPress={() => handleDeleteCat(item)}
      >
        <MaterialCommunityIcons name="delete" size={20} color={Colors.red} />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>Configuracoes</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Empresas */}
        {renderSectionHeader('Empresas', 'office-building')}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowCompanyModal(true)}
          >
            <MaterialCommunityIcons name="plus" size={20} color={Colors.blue} />
            <Text style={styles.addButtonText}>Nova Empresa</Text>
          </TouchableOpacity>

          <FlatList
            data={companies}
            keyExtractor={item => String(item.id)}
            renderItem={renderCompanyItem}
            scrollEnabled={false}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Nenhuma empresa cadastrada</Text>
            }
          />
        </View>

        {/* Categorias */}
        {renderSectionHeader('Categorias', 'tag')}
        <View style={styles.section}>
          <View style={styles.addInputRow}>
            <TextInput
              style={styles.addInput}
              value={catName}
              onChangeText={setCatName}
              placeholder="Nome da categoria"
              placeholderTextColor={Colors.textDim}
              onSubmitEditing={handleAddCat}
            />
            <TouchableOpacity style={styles.addIconButton} onPress={handleAddCat}>
              <MaterialCommunityIcons name="plus" size={22} color={Colors.blue} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={categories}
            keyExtractor={item => String(item.id)}
            renderItem={renderCatItem}
            scrollEnabled={false}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Nenhuma categoria cadastrada</Text>
            }
          />
        </View>

        {/* Backup */}
        {renderSectionHeader('Backup', 'database')}
        <View style={styles.section}>
          <Text style={styles.backupDescription}>
            Exporte ou importe os dados do sistema. O backup inclui empresas, chamados, tarefas e categorias.
          </Text>
          <View style={styles.backupButtons}>
            <TouchableOpacity
              style={styles.backupButton}
              onPress={handleExportBackup}
            >
              <MaterialCommunityIcons name="download" size={20} color={Colors.blue} />
              <Text style={styles.backupButtonText}>Exportar Backup</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.backupButton}
              onPress={handleImportBackup}
            >
              <MaterialCommunityIcons name="upload" size={20} color={Colors.green} />
              <Text style={styles.backupButtonText}>Importar Backup</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Company Modal */}
      <CompanyModal
        visible={showCompanyModal}
        onClose={handleCompanyModalClose}
        onConfirmed={loadData}
      />


      {/* Confirm Dialog */}
      <ConfirmDialog
        visible={confirmVisible}
        message={confirmMessage}
        onConfirm={() => {
          if (confirmAction) confirmAction();
          setConfirmVisible(false);
          setConfirmAction(null);
        }}
        onCancel={() => {
          setConfirmVisible(false);
          setConfirmAction(null);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  topBar: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  topBarTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.xl,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 80,
    gap: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sectionHeaderTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: 'bold',
  },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceAlt,
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
  },
  addButtonText: {
    color: Colors.blue,
    fontSize: FontSize.base,
    fontWeight: '600',
  },
  companyItem: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  companyInfo: {
    marginBottom: Spacing.sm,
  },
  companyName: {
    color: Colors.textPrimary,
    fontSize: FontSize.base,
    fontWeight: '600',
  },
  companyCounts: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  companyActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  actionButton: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
  },
  actionButtonPrimary: {
    backgroundColor: Colors.blue,
  },
  actionButtonWarning: {
    backgroundColor: Colors.yellow,
  },
  actionButtonDanger: {
    backgroundColor: Colors.red,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  listItemText: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.base,
  },
  actionIconButton: {
    padding: Spacing.xs,
    borderRadius: Radius.sm,
  },
  deleteIconButton: {
    padding: Spacing.xs,
  },
  addInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  addInput: {
    flex: 1,
    backgroundColor: Colors.surfaceAlt,
    color: Colors.textPrimary,
    padding: Spacing.md,
    borderRadius: Radius.md,
    fontSize: FontSize.base,
  },
  addIconButton: {
    padding: Spacing.sm,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    paddingVertical: Spacing.lg,
    textAlign: 'center',
  },
  backupDescription: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  backupButtons: {
    gap: Spacing.sm,
  },
  backupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceAlt,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  backupButtonText: {
    color: Colors.textPrimary,
    fontSize: FontSize.base,
    fontWeight: '600',
  },
});
