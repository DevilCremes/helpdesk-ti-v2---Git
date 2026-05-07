import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ScrollView, TouchableWithoutFeedback } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import TaskCard from '../../src/components/TaskCard';
import FAB from '../../src/components/FAB';
import EmptyState from '../../src/components/EmptyState';
import TaskModal from '../../src/modals/TaskModal';
import ConfirmDialog from '../../src/components/ConfirmDialog';
import CompanyModal from '../../src/modals/CompanyModal';
import SearchBar from '../../src/components/SearchBar';
import { taskRepo, Task } from '../../src/db';
import { useAppStore } from '../../src/stores/appStore';
import { Colors, Spacing, FontSize, Radius } from '../../src/constants/theme';

const FILTERS = [
  { value: 'pending', label: 'Pendentes' },
  { value: 'done', label: 'Concluidas' },
  { value: 'rec', label: 'Recorrentes' },
  { value: 'one', label: 'Unicas' },
];

export default function TarefasScreen() {
  const { currentCompanyId, currentCompanyName, viewAllCompanies, showToast, setOpenModal, companies } = useAppStore();

  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);

  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Company selector state
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [showCompanyModal, setShowCompanyModal] = useState(false);

  // ─── Load tasks on focus ──────────────────────────────────────────────
  const loadTasks = useCallback(() => {
    taskRepo.resetRecurring();
    const all = viewAllCompanies ? taskRepo.getAll() : taskRepo.getByCompany(currentCompanyId);
    setTasks(all);
  }, [viewAllCompanies, currentCompanyId]);

  useFocusEffect(
    useCallback(() => {
      loadTasks();
      setShowCompanyDropdown(false);
    }, [loadTasks])
  );

  // ─── Debounce search query ───────────────────────────────────────────
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery]);

  // ─── Filter tasks ─────────────────────────────────────────────────────
  const filtered = tasks.filter((task) => {
    // Filter by status/type first
    let matchesFilter = true;
    switch (activeFilter) {
      case 'pending':
        matchesFilter = task.is_done === 0;
        break;
      case 'done':
        matchesFilter = task.is_done === 1;
        break;
      case 'rec':
        matchesFilter = task.task_type === 'rec';
        break;
      case 'one':
        matchesFilter = task.task_type === 'one';
        break;
    }

    // Filter by search query (case insensitive)
    const matchesSearch = debouncedSearch.trim() === '' ||
      task.name.toLowerCase().includes(debouncedSearch.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  // ─── Handlers ─────────────────────────────────────────────────────────
  const handleToggle = useCallback(
    (task: Task) => {
      const isDone = task.is_done === 1;
      if (isDone) {
        taskRepo.markUndone(task.id);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        showToast('Tarefa desmarcada');
      } else {
        taskRepo.markDone(task.id);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        showToast('Tarefa concluida!', {
          onUndo: () => {
            taskRepo.markUndone(task.id);
            loadTasks();
          },
        });
      }
      loadTasks();
    },
    [showToast, loadTasks]
  );

  const handleDelete = useCallback(() => {
    if (!deleteTarget) return;
    taskRepo.delete(deleteTarget.id);
    showToast('Tarefa excluida');
    setDeleteTarget(null);
    loadTasks();
  }, [deleteTarget, showToast, loadTasks]);

  const handleFABPress = useCallback(() => {
    if (viewAllCompanies) {
      showToast('Selecione uma empresa para criar tarefas');
      return;
    }
    setShowTaskModal(true);
  }, [viewAllCompanies, showToast]);

  const handleTaskModalClose = useCallback(() => {
    setShowTaskModal(false);
    loadTasks();
  }, [loadTasks]);

  const handleCompanyModalClose = useCallback(() => {
    setShowCompanyModal(false);
    loadTasks();
    useAppStore.getState().loadCompanies();
  }, [loadTasks]);

  const handleSelectCompany = (company: Company) => {
    useAppStore.getState().setViewAllCompanies(false);
    useAppStore.getState().setCurrentCompany(company.id, company.name);
    setShowCompanyDropdown(false);
  };

  // Ativa "Ver todas" ou fecha o dropdown se já estiver marcado
  const handleToggleViewAll = useCallback(() => {
    if (!viewAllCompanies) {
      useAppStore.getState().setViewAllCompanies(true);
    }
    setShowCompanyDropdown(false);
  }, [viewAllCompanies]);

  const handleOpenDropdown = useCallback(() => {
    setShowCompanyDropdown(true);
  }, []);

  const handleCloseDropdown = useCallback(() => {
    setShowCompanyDropdown(false);
  }, []);

  // ─── Render header ────────────────────────────────────────────────────
  const renderHeader = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterPillsContainer}
    >
      {FILTERS.map((filter) => (
        <TouchableOpacity
          key={filter.value}
          style={[styles.pill, activeFilter === filter.value && styles.pillActive]}
          onPress={() => setActiveFilter(activeFilter === filter.value ? null : filter.value)}
          activeOpacity={0.7}
        >
          <Text style={[styles.pillText, activeFilter === filter.value && styles.pillTextActive]}>
            {filter.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const displayCompanyName = viewAllCompanies ? 'Todas as Empresas' : currentCompanyName;

  // ─── Render company dropdown ─────────────────────────────────────────────
  const renderCompanyDropdown = () => {
    if (!showCompanyDropdown) return null;

    return (
      <View style={styles.dropdownContainer}>
        <TouchableWithoutFeedback>
          <View style={styles.dropdown}>
            <ScrollView style={styles.dropdownScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
            {companies.map((company) => (
              <TouchableOpacity
                key={company.id}
                style={[
                  styles.dropdownItem,
                  company.id === currentCompanyId && !viewAllCompanies && styles.dropdownItemSelected,
                ]}
                onPress={() => handleSelectCompany(company)}
              >
                <MaterialCommunityIcons
                  name={company.id === currentCompanyId && !viewAllCompanies ? 'radiobox-marked' : 'radiobox-blank'}
                  size={18}
                  color={company.id === currentCompanyId && !viewAllCompanies ? Colors.blue : Colors.textMuted}
                />
                <Text style={[
                  styles.dropdownItemText,
                  company.id === currentCompanyId && !viewAllCompanies && styles.dropdownItemTextSelected,
                ]} numberOfLines={1}>
                  {company.name}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.dropdownDivider} onPress={handleToggleViewAll} />
            <TouchableOpacity
              style={[styles.dropdownItem, viewAllCompanies && styles.dropdownItemSelected]}
              onPress={handleToggleViewAll}
            >
              <MaterialCommunityIcons
                name={viewAllCompanies ? 'radiobox-marked' : 'radiobox-blank'}
                size={18}
                color={viewAllCompanies ? Colors.blue : Colors.textMuted}
              />
              <Text style={[
                styles.dropdownItemText,
                viewAllCompanies && styles.dropdownItemTextSelected,
                styles.dropdownItemTextBold,
              ]}>
                Ver todas
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => { setShowCompanyDropdown(false); setShowCompanyModal(true); }}
            >
              <MaterialCommunityIcons name="plus-circle" size={18} color={Colors.green} />
              <Text style={styles.dropdownText}>Nova Empresa</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
        </TouchableWithoutFeedback>
      </View>
    );
  };

  // ─── Render company selector ──────────────────────────────────────────
  const renderCompanySelector = () => (
    <View style={styles.companySelector}>
      <TouchableOpacity
        style={styles.companyButton}
        onPress={showCompanyDropdown ? handleCloseDropdown : handleOpenDropdown}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons name="office-building" size={18} color={Colors.blue} />
        <Text style={styles.companyButtonText} numberOfLines={1}>{displayCompanyName}</Text>
        <MaterialCommunityIcons
          name={showCompanyDropdown ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={Colors.textMuted}
        />
      </TouchableOpacity>

      {renderCompanyDropdown()}

      {/* Overlay para fechar ao clicar fora */}
      {showCompanyDropdown && (
        <TouchableWithoutFeedback onPress={handleCloseDropdown}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>
      )}
    </View>
  );

  // ─── Render item ──────────────────────────────────────────────────────
  const renderItem = ({ item }: { item: Task }) => (
    <TaskCard
      task={item}
      onToggle={() => handleToggle(item)}
      onDelete={() => setDeleteTarget(item)}
    />
  );

  // ─── Render empty ─────────────────────────────────────────────────────
  const renderEmpty = () => (
    <EmptyState
      icon="clipboard-text-outline"
      message="Nenhuma tarefa encontrada"
      subMessage="Crie uma nova tarefa ou altere os filtros"
    />
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>Tarefas</Text>
        <View style={styles.topBarActions}>
          <TouchableOpacity
            style={styles.topBarButton}
            onPress={() => setShowSearch(!showSearch)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name={showSearch ? 'close' : 'magnify'}
              size={22}
              color={Colors.textPrimary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search bar */}
      {showSearch && (
        <View style={styles.searchContainer}>
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            onClear={() => setSearchQuery('')}
            placeholder="Buscar tarefas..."
          />
        </View>
      )}

      {/* Company selector */}
      {renderCompanySelector()}

      {/* Click-outside overlay to close dropdown */}
      {showCompanyDropdown && (
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setShowCompanyDropdown(false)}
        />
      )}

      {/* Filter pills */}
      <View style={styles.headerWrapper}>{renderHeader()}</View>

      {/* Task list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
      />

      {/* FAB */}
      <FAB onPress={handleFABPress} />

      {/* Task Modal */}
      <TaskModal visible={showTaskModal} onClose={handleTaskModalClose} />

      {/* Company Modal */}
      <CompanyModal
        visible={showCompanyModal}
        onClose={handleCompanyModalClose}
      />

      {/* Confirm Dialog */}
      <ConfirmDialog
        visible={deleteTarget !== null}
        title="Excluir Tarefa"
        message={`Deseja excluir "${deleteTarget?.name}"?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  topBarButton: {
    padding: Spacing.xs,
  },
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  companySelector: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    position: 'relative',
  },
  companyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  companyButtonText: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.base,
    fontWeight: '500',
  },
  dropdown: {
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  dropdownContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingTop: 48,
  },
  dropdownScroll: {
    maxHeight: 280,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  dropdownItemText: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.base,
  },
  dropdownItemTextSelected: {
    color: Colors.blue,
    fontWeight: '600',
  },
  dropdownItemTextBold: {
    fontWeight: '600',
  },
  dropdownItemSelected: {
    backgroundColor: Colors.blue + '10',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.md,
  },
  headerWrapper: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterPillsContainer: {
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.lg,
  },
  pill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceAlt,
    marginRight: Spacing.xs,
  },
  pillActive: {
    backgroundColor: Colors.blue,
    borderColor: Colors.blue,
  },
  pillText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  pillTextActive: {
    color: Colors.white,
    fontWeight: '600',
  },
  listContent: {
    padding: Spacing.lg,
    paddingBottom: 80,
  },
  dropdownContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingTop: 48,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
});
