import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, FlatList, ActivityIndicator, TouchableWithoutFeedback } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import TicketCard from '../../src/components/TicketCard';
import FAB from '../../src/components/FAB';
import EmptyState from '../../src/components/EmptyState';
import SearchBar from '../../src/components/SearchBar';
import TicketModal from '../../src/modals/TicketModal';
import CompanyModal from '../../src/modals/CompanyModal';
import { usePagination } from '../../src/hooks/usePagination';
import { ticketRepo, Ticket } from '../../src/db';
import { useAppStore } from '../../src/stores/appStore';
import { Colors, Spacing, FontSize, Radius } from '../../src/constants/theme';

const FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'aberto', label: 'Abertos' },
  { value: 'andamento', label: 'Andamento' },
  { value: 'aguardando', label: 'Aguardando' },
  { value: 'fechado', label: 'Fechados' },
];

const PAGE_SIZE = 30;

export default function ChamadosScreen() {
  const router = useRouter();

  const {
    currentCompanyId,
    currentCompanyName,
    viewAllCompanies,
    searchQuery,
    showToast,
    setOpenModal,
    companies,
  } = useAppStore();

  // UI state
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [openCount, setOpenCount] = useState(0);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modal state
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [editTicketId, setEditTicketId] = useState<string | null>(null);

  // ─── Load open count ─────────────────────────────────────────────────────
  const loadOpenCount = useCallback(() => {
    const companyId = viewAllCompanies ? null : currentCompanyId;
    setOpenCount(ticketRepo.countOpen(companyId));
  }, [viewAllCompanies, currentCompanyId]);

  // ─── Pagination hook ─────────────────────────────────────────────────────
  const fetcher = useCallback((page: number): Ticket[] => {
    const filter = activeFilter;
    const search = debouncedSearch;
    return viewAllCompanies
      ? ticketRepo.getAllCompanies(page, filter, search)
      : ticketRepo.getPage(currentCompanyId, page, filter, search);
  }, [activeFilter, debouncedSearch, viewAllCompanies, currentCompanyId]);

  const { items: tickets, refresh, loadMore, hasMore, loading } = usePagination(fetcher, [activeFilter, debouncedSearch, viewAllCompanies, currentCompanyId]);

  const refreshing = loading && tickets.length === 0;

  // ─── Debounce search query ───────────────────────────────────────────────
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery]);

  // ─── Reload when filter, search, or company changes ──────────────────────
  useEffect(() => {
    loadOpenCount();
  }, [activeFilter, debouncedSearch, viewAllCompanies, currentCompanyId, loadOpenCount]);

  // ─── Reload on focus ─────────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      loadOpenCount();
      refresh();
      setShowCompanyDropdown(false);
    }, [loadOpenCount, refresh])
  );

  // ─── Handlers ────────────────────────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  const handleTicketPress = useCallback((ticket: Ticket) => {
    router.push({
      pathname: '/ticket/[id]',
      params: { id: ticket.id },
    });
  }, [router]);

  const handleFABPress = useCallback(() => {
    if (viewAllCompanies) {
      showToast('Selecione uma empresa para criar chamados');
      return;
    }
    setEditTicketId(null);
    setShowTicketModal(true);
  }, [viewAllCompanies, showToast]);

  const handleEditTicket = useCallback((id: string) => {
    setEditTicketId(id);
    setShowTicketModal(true);
  }, []);

  const handleTicketModalClose = useCallback(() => {
    setShowTicketModal(false);
    setEditTicketId(null);
    refresh();
    loadOpenCount();
  }, [refresh, loadOpenCount]);

  const handleSelectCompany = useCallback((company: Company) => {
    useAppStore.getState().setViewAllCompanies(false);
    useAppStore.getState().setCurrentCompany(company.id, company.name);
    setShowCompanyDropdown(false);
  }, []);

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

  const displayCompanyName = viewAllCompanies ? 'Todas as Empresas' : currentCompanyName;

  // ─── Render company dropdown ─────────────────────────────────────────────
  const renderCompanyDropdown = () => {
    if (!showCompanyDropdown) return null;

    return (
      <View style={styles.dropdownContainer}>
        <TouchableWithoutFeedback>
          <View style={styles.dropdown}>
            <ScrollView style={styles.dropdownScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
            {companies.map(company => (
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

  // ─── Render header ───────────────────────────────────────────────────────
  const renderHeader = () => (
    <View style={styles.headerSection}>
      {/* Company selector */}
      <View style={styles.companyRow}>
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

        {openCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{openCount}</Text>
          </View>
        )}
      </View>

      {renderCompanyDropdown()}

      {/* Overlay para fechar ao clicar fora */}
      {showCompanyDropdown && (
        <TouchableWithoutFeedback onPress={handleCloseDropdown}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>
      )}

      {/* Search bar */}
      {showSearch && (
        <View style={styles.searchContainer}>
          <SearchBar
            value={searchQuery}
            onChangeText={(q) => useAppStore.getState().setSearchQuery(q)}
            onClear={() => useAppStore.getState().setSearchQuery('')}
            placeholder="Buscar chamados..."
          />
        </View>
      )}

      {/* Filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterPillsContainer}
      >
        {FILTERS.map(filter => (
          <TouchableOpacity
            key={filter.value}
            style={[
              styles.pill,
              activeFilter === filter.value && styles.pillActive,
            ]}
            onPress={() => setActiveFilter(filter.value)}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.pillText,
              activeFilter === filter.value && styles.pillTextActive,
            ]}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  // ─── Render item ─────────────────────────────────────────────────────────
  const renderItem = ({ item }: { item: Ticket }) => (
    <TicketCard
      ticket={item}
      onPress={() => handleTicketPress(item)}
      showCompanyName={viewAllCompanies}
    />
  );

  // ─── Render footer / loader ──────────────────────────────────────────────
  const renderFooter = () => {
    if (!loading) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={Colors.blue} />
      </View>
    );
  };

  // ─── Render empty ────────────────────────────────────────────────────────
  const renderEmpty = () => {
    if (loading && tickets.length === 0) return null;
    return (
      <EmptyState
        icon="ticket-outline"
        message="Nenhum chamado encontrado"
        subMessage="Crie um novo chamado ou altere os filtros"
      />
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>Chamados</Text>
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
          <TouchableOpacity
            style={styles.topBarButton}
            onPress={() => router.push('/(tabs)/stats')}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="chart-bar" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Header section with filters */}
      <View style={styles.headerWrapper}>
        {renderHeader()}
      </View>

      {/* Ticket list */}
      <FlatList
        data={tickets}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        showsVerticalScrollIndicator={false}
      />

      {/* FAB */}
      <FAB onPress={handleFABPress} />

      {/* Ticket Modal */}
      <TicketModal
        visible={showTicketModal}
        onClose={handleTicketModalClose}
        editTicketId={editTicketId}
      />

      {/* Company Modal */}
      <CompanyModal
        visible={showCompanyModal}
        onClose={() => {
          setShowCompanyModal(false);
          loadCompanies();
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
  headerWrapper: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  companyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  companyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  companyButtonText: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.base,
    fontWeight: '500',
  },
  badge: {
    backgroundColor: Colors.red,
    borderRadius: Radius.full,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  badgeText: {
    color: Colors.white,
    fontSize: FontSize.sm,
    fontWeight: 'bold',
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
  dropdown: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    marginHorizontal: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    maxHeight: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  dropdownScroll: {
    maxHeight: 280,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  dropdownItemSelected: {
    backgroundColor: Colors.blue + '10',
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
  dropdownText: {
    color: Colors.textPrimary,
    fontSize: FontSize.base,
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.md,
  },
  searchContainer: {
    marginBottom: Spacing.sm,
  },
  filterPillsContainer: {
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
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
  footerLoader: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
});
