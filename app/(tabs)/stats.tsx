import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { statsRepo, taskRepo } from '../../src/db';
import { useAppStore } from '../../src/stores/appStore';
import { Colors, Spacing, FontSize, Radius, statusColor, priColor } from '../../src/constants/theme';
import { startOfWeekISO, startOfMonthISO } from '../../src/utils/dateUtils';

interface Summary {
  total: number;
  aberto: number;
  andamento: number;
  aguardando: number;
  fechado: number;
  byCat: { category: string; n: number }[];
  byPri: { priority: string; n: number }[];
}

interface TaskSummary {
  total: number;
  done: number;
}

interface PeriodSummary {
  weekTotal: number;
  monthTotal: number;
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function DataRow({ icon, label, value, color, max }: { icon: string; label: string; value: number; color: string; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <View style={styles.dataRow}>
      <View style={styles.dataRowHeader}>
        <Text style={styles.dataRowLabel}>{label}</Text>
        <Text style={styles.dataRowValue}>{value}</Text>
      </View>
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export default function StatsScreen() {
  const { currentCompanyId, viewAllCompanies } = useAppStore();

  const [summary, setSummary] = useState<Summary>({
    total: 0, aberto: 0, andamento: 0, aguardando: 0, fechado: 0, byCat: [], byPri: [],
  });
  const [taskSummary, setTaskSummary] = useState<TaskSummary>({ total: 0, done: 0 });
  const [periodSummary, setPeriodSummary] = useState<PeriodSummary>({ weekTotal: 0, monthTotal: 0 });

  const companyId = viewAllCompanies ? null : currentCompanyId;

  const loadData = useCallback(() => {
    const coId = viewAllCompanies ? null : currentCompanyId;
    // Total geral
    setSummary(statsRepo.getSummary(coId));
    // Tarefas
    setTaskSummary(statsRepo.getTaskSummary(coId));
    // Periodos: esta semana e este mes
    const weekSummary = statsRepo.getSummary(coId, startOfWeekISO());
    const monthSummary = statsRepo.getSummary(coId, startOfMonthISO());
    setPeriodSummary({ weekTotal: weekSummary.total, monthTotal: monthSummary.total });
  }, [viewAllCompanies, currentCompanyId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const fechamentoRate = summary.total > 0
    ? Math.round((summary.fechado / summary.total) * 100)
    : 0;

  const taskDonePct = taskSummary.total > 0
    ? Math.round((taskSummary.done / taskSummary.total) * 100)
    : 0;

  const maxCat = summary.byCat.length > 0 ? summary.byCat[0].n : 0;
  const maxPri = summary.byPri.length > 0 ? summary.byPri[0].n : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>Relatorio</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Summary cards 2x2 */}
        <View style={styles.grid2x2}>
          <StatCard label="Total" value={summary.total} color={Colors.blue} />
          <StatCard label="Abertos" value={summary.aberto} color={Colors.green} />
          <StatCard label="Andamento" value={summary.andamento} color={Colors.yellow} />
          <StatCard label="Aguardando" value={summary.aguardando} color={Colors.purple} />
        </View>
        <View style={styles.fullWidthCard}>
          <StatCard label="Fechados" value={summary.fechado} color={Colors.textMuted} />
        </View>

        {/* Fechamento rate */}
        <View style={styles.rateCard}>
          <Text style={styles.rateLabel}>Taxa de Fechamento</Text>
          <Text style={[styles.rateValue, { color: fechamentoRate >= 50 ? Colors.green : Colors.yellow }]}>
            {fechamentoRate}%
          </Text>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${fechamentoRate}%`,
                  backgroundColor: fechamentoRate >= 50 ? Colors.green : Colors.yellow,
                },
              ]}
            />
          </View>
        </View>

        {/* By Category */}
        {summary.byCat.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Por Categoria</Text>
            {summary.byCat.map((c) => (
              <DataRow
                key={c.category}
                icon="tag"
                label={c.category}
                value={c.n}
                color={Colors.blue}
                max={maxCat}
              />
            ))}
          </View>
        )}

        {/* By Priority */}
        {summary.byPri.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Por Prioridade</Text>
            {summary.byPri.map((p) => (
              <DataRow
                key={p.priority}
                icon="flag"
                label={p.priority}
                value={p.n}
                color={priColor(p.priority)}
                max={maxPri}
              />
            ))}
          </View>
        )}

        {/* Checklist today */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Checklist Hoje</Text>
          <View style={styles.checklistRow}>
            <Text style={styles.checklistText}>
              {taskSummary.done} de {taskSummary.total} tarefas concluidas
            </Text>
            <Text style={[styles.checklistPct, { color: taskDonePct >= 50 ? Colors.green : Colors.yellow }]}>
              {taskDonePct}%
            </Text>
          </View>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${taskDonePct}%`,
                  backgroundColor: taskDonePct >= 50 ? Colors.green : Colors.yellow,
                },
              ]}
            />
          </View>
        </View>

        {/* Periods */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Periodos</Text>
          <View style={styles.periodRow}>
            <Text style={styles.periodLabel}>Esta semana</Text>
            <Text style={styles.periodValue}>{periodSummary.weekTotal} chamados</Text>
          </View>
          <View style={styles.periodRow}>
            <Text style={styles.periodLabel}>Este mes</Text>
            <Text style={styles.periodValue}>{periodSummary.monthTotal} chamados</Text>
          </View>
        </View>
      </ScrollView>
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
  grid2x2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  fullWidthCard: {
    width: '100%',
  },
  statCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderLeftWidth: 4,
  },
  statValue: {
    color: Colors.textPrimary,
    fontSize: FontSize.xl,
    fontWeight: 'bold',
  },
  statLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  rateCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  rateLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  rateValue: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    marginBottom: Spacing.sm,
  },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.base,
    fontWeight: 'bold',
    marginBottom: Spacing.sm,
  },
  dataRow: {
    marginBottom: Spacing.sm,
  },
  dataRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  dataRowLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },
  dataRowValue: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: Radius.sm,
  },
  checklistRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  checklistText: {
    color: Colors.textSecondary,
    fontSize: FontSize.base,
  },
  checklistPct: {
    fontSize: FontSize.base,
    fontWeight: 'bold',
  },
  periodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  periodLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.base,
  },
  periodValue: {
    color: Colors.textPrimary,
    fontSize: FontSize.base,
    fontWeight: '600',
  },
});
