# Code Review — Helpdesk TI v2
**Data:** 08/05/2026  
**Revisão de:** `src/db/index.ts`, `src/stores/appStore.ts`, `src/hooks/usePagination.ts`, `app/(tabs)/index.tsx`, `app/(tabs)/tarefas.tsx`, `app/ticket/[id].tsx`, `src/modals/TicketModal.tsx`, `src/utils/`, `src/constants/theme.ts`

---

## Severidade dos itens

| Nível | Quantidade |
|---|---|
| 🔴 Bug / Erro real | 5 |
| 🟠 Problema de arquitetura | 5 |
| 🟡 Má prática / code smell | 8 |
| 🔵 Melhoria de UX / produto | 4 |

---

## 🔴 Bugs e Erros Reais

---

### B1 — `require()` dinâmico dentro de loop no `taskRepo.resetRecurring`
**Arquivo:** `src/db/index.ts` — linha ~225

```ts
// ❌ Atual — require() chamado em cada iteração do loop
for (const task of tasks) {
  const { isTaskAvailableNow } = require('../utils/scheduleUtils');
  if (isTaskAvailableNow(schedule)) { ... }
}
```
**Problema:** `require()` síncrono dentro de um loop é o único `require` dinâmico em todo o projeto. Além de ser inconsistente, cria um ciclo de dependência real: `db/index.ts` → `scheduleUtils.ts` → (nada), mas o padrão quebra o tree-shaking e pode falhar em ambientes Metro com resolução lazy. O comentário diz "para evitar ciclo" mas o ciclo não existe — `scheduleUtils` não importa `db`.

```ts
// ✅ Correto — import no topo do arquivo
import { isTaskAvailableNow, TaskSchedule } from '../utils/scheduleUtils';
```

---

### B2 — Duplicate key em `StyleSheet.create` no `tarefas.tsx`
**Arquivo:** `app/(tabs)/tarefas.tsx` — ao final dos estilos

```ts
// ❌ Atual — `dropdownContainer` declarado duas vezes
const styles = StyleSheet.create({
  // ...
  dropdownContainer: { position: 'absolute', top: 0, ... zIndex: 1000, paddingTop: 48 },
  overlay: { position: 'absolute', top: 0, ... zIndex: 999 },
  // ... 70 linhas depois ...
  dropdownContainer: { position: 'absolute', top: 0, ... zIndex: 1000, paddingTop: 48 }, // ← DUPLICADO
  overlay: { ... },
});
```
**Problema:** JavaScript silenciosamente usa o último valor. O StyleSheet gerado é diferente do que aparenta. O segundo bloco sobrescreve o primeiro sem erro em tempo de compilação.

**Solução:** Remover o segundo `dropdownContainer` e `overlay` duplicados (são idênticos ao primeiro).

---

### B3 — Tipo `Company` usado sem import em dois arquivos
**Arquivos:** `app/(tabs)/index.tsx` linha ~107 e `app/(tabs)/tarefas.tsx` linha ~130

```ts
// ❌ Atual — Company usado sem import
const handleSelectCompany = useCallback((company: Company) => { ... }, []);
```
**Problema:** `Company` não aparece nos imports de nenhum dos dois arquivos. Funciona em runtime porque TypeScript/Expo pode resolver via inferência em alguns casos, mas é um erro de tipagem que pode quebrar com `strict: true` ou ao fazer refactor.

```ts
// ✅ Correto
import { ticketRepo, Ticket, Company } from '../../src/db';
```

---

### B4 — `loadCompanies` usada mas não desestruturada no `index.tsx`
**Arquivo:** `app/(tabs)/index.tsx` — linha ~284

```tsx
// ❌ Atual — chamada a loadCompanies sem estar no destructure do store
<CompanyModal
  visible={showCompanyModal}
  onClose={() => {
    setShowCompanyModal(false);
    loadCompanies(); // ← ReferenceError em runtime
  }}
/>
```
**Problema:** `loadCompanies` não está no destructure do `useAppStore()` no topo do componente. Vai lançar `ReferenceError: loadCompanies is not defined` toda vez que o modal de empresa fechar.

```ts
// ✅ Correto — adicionar ao destructure
const {
  currentCompanyId, currentCompanyName, viewAllCompanies,
  searchQuery, showToast, setOpenModal, companies,
  loadCompanies, // ← adicionar
} = useAppStore();
```

---

### B5 — Transição de status não registra timeline
**Arquivo:** `app/ticket/[id].tsx` — `handleConfirmTransition`

```ts
// ❌ Atual — atualiza status sem gravar histórico
const handleConfirmTransition = useCallback(() => {
  if (!ticketId || !transitionTarget) return;
  ticketRepo.update(ticketId, { status: transitionTarget });
  setShowTransitionModal(false);
  // ...
}, [...]);

// Mas handleConfirmReabrir SIM registra:
const handleConfirmReabrir = useCallback(() => {
  timelineRepo.add(ticketId, 'reopen', 'Chamado reaberto.');
  ticketRepo.update(ticketId, { status: 'aberto' });
  // ...
}, [...]);
```
**Problema:** Fechar, colocar em andamento, ou aguardando não gera nenhuma entrada no histórico. Só "Reabrir" gera. O `TransitionModal` aceita uma observação do usuário mas ela nunca é salva na timeline.

```ts
// ✅ Correto
const handleConfirmTransition = useCallback((note?: string) => {
  if (!ticketId || !transitionTarget) return;
  const label = TRANSITION_LABELS[transitionTarget] ?? transitionTarget;
  const text = note?.trim()
    ? `Status: ${label}.\nObservacao: ${note.trim()}`
    : `Status alterado para: ${label}.`;
  timelineRepo.add(ticketId, 'status', text);
  ticketRepo.update(ticketId, { status: transitionTarget });
  // ...
}, [...]);
```

---

## 🟠 Problemas de Arquitetura

---

### A1 — N+1 queries no `statsRepo.getSummary`
**Arquivo:** `src/db/index.ts` — `statsRepo.getSummary`

```ts
// ❌ Atual — 6 queries separadas para o mesmo conjunto de dados
const total     = db.getFirstSync(`SELECT COUNT(*) ... FROM tickets ${where}`, ...);
const aberto    = db.getFirstSync(`... WHERE ... status = 'aberto'`, ...);
const andamento = db.getFirstSync(`... WHERE ... status = 'andamento'`, ...);
const aguardando= db.getFirstSync(`... WHERE ... status = 'aguardando'`, ...);
const fechado   = db.getFirstSync(`... WHERE ... status = 'fechado'`, ...);
```
**Problema:** 5 queries de contagem + 2 GROUP BY = 7 queries ao banco para montar uma única tela de estatísticas. Especialmente ruim quando `companyId = null` (scan de toda a tabela repetido 5x).

```ts
// ✅ Correto — 1 query agrupa tudo
const rows = db.getAllSync<{ status: string; n: number }>(
  `SELECT status, COUNT(*) as n FROM tickets ${whereClause} GROUP BY status`,
  params
);
const counts = Object.fromEntries(rows.map(r => [r.status, r.n]));
const aberto    = counts['aberto']    ?? 0;
const andamento = counts['andamento'] ?? 0;
const aguardando= counts['aguardando']?? 0;
const fechado   = counts['fechado']   ?? 0;
const total     = rows.reduce((acc, r) => acc + r.n, 0);
```

---

### A2 — Categoria armazenada como string, não como FK
**Arquivo:** `src/db/index.ts` — schema da tabela `tickets`

```sql
-- ❌ Atual
category TEXT NOT NULL  -- ex: "Hardware"
```
**Problema:** A tabela `categories` existe com `id` e `name`, mas os tickets guardam só o nome. Se o usuário renomear uma categoria, todos os tickets antigos ficam com o nome errado. Além disso, a busca por categoria precisa de `LIKE` em texto em vez de `= id`.

**Solução recomendada:** Migrar para `category_id INTEGER REFERENCES categories(id)`, com migration via `ALTER TABLE` + `UPDATE`. Enquanto a migration não for feita, pelo menos validar que a categoria existe antes de salvar.

---

### A3 — `appStore` com `setCurrentCompany` async não refletido no tipo
**Arquivo:** `src/stores/appStore.ts`

```ts
// ❌ Interface declara void, implementação é async
interface AppStore {
  setCurrentCompany: (id: number, name: string) => void; // declara void
}

// implementação:
setCurrentCompany: async (id, name) => {   // async retorna Promise
  set({ currentCompanyId: id, currentCompanyName: name });
  await SecureStore.setItemAsync('current_company_id', String(id));
  // ...
},
```
**Problema:** O tipo diz `void` mas a função retorna `Promise<void>`. Qualquer chamador que espere a operação completa (`await store.setCurrentCompany(...)`) não vai ter o tipo correto, e erros do SecureStore são silenciados.

```ts
// ✅ Correto
interface AppStore {
  setCurrentCompany: (id: number, name: string) => Promise<void>;
}
```

---

### A4 — Restore de empresa não restaura timeline nem attachments
**Arquivo:** `src/db/index.ts` — `companyRepo.restore`

```ts
// ❌ Atual — só restaura tickets e tasks
restore: (data: { company; tickets; tasks }) => {
  db.runSync('INSERT INTO companies ...', [...]);
  for (const ticket of tickets) { db.runSync('INSERT INTO tickets ...', [...]); }
  for (const task of tasks)     { db.runSync('INSERT INTO tasks ...', [...]); }
  // timeline e attachments NÃO são restaurados
}
```
**Problema:** O `softDelete` captura tickets e tasks, mas não captura `timeline` e `attachments`. Ao fazer undo de exclusão de empresa, todos os chamados voltam mas sem histórico e sem arquivos anexados.

```ts
// ✅ Correto — softDelete também coleta e restore também insere
softDelete: (id) => {
  const company    = db.getFirstSync<Company>('SELECT * FROM companies WHERE id = ?', [id])!;
  const tickets    = db.getAllSync('SELECT * FROM tickets WHERE company_id = ?', [id]);
  const tasks      = db.getAllSync('SELECT * FROM tasks WHERE company_id = ?', [id]);
  const ticketIds  = tickets.map(t => t.id);
  const timeline   = ticketIds.length
    ? db.getAllSync(`SELECT * FROM timeline WHERE ticket_id IN (${ticketIds.map(()=>'?').join(',')})`, ticketIds)
    : [];
  const attachments = ticketIds.length
    ? db.getAllSync(`SELECT * FROM attachments WHERE ticket_id IN (${ticketIds.map(()=>'?').join(',')})`, ticketIds)
    : [];
  db.runSync('DELETE FROM companies WHERE id = ?', [id]);
  return { company, tickets, tasks, timeline, attachments };
},
```

---

### A5 — `usePagination` tem stale closure e deps fracas
**Arquivo:** `src/hooks/usePagination.ts`

```ts
// ❌ Problema 1 — `refresh` tem deps erradas (falta `load`)
const refresh = useCallback(() => load(true), [...deps]);
// deveria ser:
const refresh = useCallback(() => load(true), [load]);

// ❌ Problema 2 — deps tipada como any[]
export function usePagination<T>(
  fetcher: (page: number) => T[],
  deps: any[] = []   // ← sem tipo
)

// ❌ Problema 3 — PAGE_SIZE hardcoded como 30 no hook E na tela
// index.tsx linha 22: const PAGE_SIZE = 30; (nunca usado!)
// usePagination.ts: setHasMore(newItems.length === 30); (magic number)
```

**Solução:**
```ts
export function usePagination<T>(
  fetcher: (page: number) => T[],
  deps: React.DependencyList = [],
  pageSize = 30,
) {
  // ...
  const refresh  = useCallback(() => load(true), [load]);
  const loadMore = useCallback(() => {
    if (!hasMore || loading) return;
    setLoading(true);
    load(false);
  }, [hasMore, loading, load]);
  // ...
  setHasMore(newItems.length === pageSize); // usa constante
}
```

---

## 🟡 Más Práticas / Code Smells

---

### S1 — `formatTicketDate` é uma função no-op
**Arquivo:** `app/ticket/[id].tsx` — linha ~88

```ts
// ❌ Inútil — só retorna o próprio argumento
function formatTicketDate(dateStr: string): string {
  return dateStr;
}
```
Remover a função e usar `ticket.created_at` diretamente, ou implementar uma formatação real (ex: `nowStr` já formata como `DD/MM/YYYY HH:mm`).

---

### S2 — JSX com lixo de comentários no `[id].tsx`
**Arquivo:** `app/ticket/[id].tsx` — ~linha 390

```tsx
// ❌ Comentário malformado + texto solto no JSX
<SafeAreaView ...>
  {/* Comment section end */}

      HEADER          ← texto solto, gera Warning no Metro
  /* ================================================================ */}
```
Resíduo de copy-paste. Precisa ser removido — o Metro/RN emite warnings e pode interferir com a árvore de componentes.

---

### S3 — `filtered` sem `useMemo` no `tarefas.tsx`
**Arquivo:** `app/(tabs)/tarefas.tsx`

```ts
// ❌ Atual — recalcula em todo render
const filtered = tasks.filter((task) => { ... });
```
```ts
// ✅ Correto
const filtered = useMemo(() =>
  tasks.filter((task) => {
    // ...
  }),
  [tasks, activeFilter, debouncedSearch]
);
```

---

### S4 — Key por index na lista de anexos do TicketModal
**Arquivo:** `src/modals/TicketModal.tsx`

```tsx
// ❌ key={i} — instável, causa bugs em reordenação/remoção
{attachments.map((att, i) => (
  <View key={i} style={styles.attachItem}>
```
```tsx
// ✅ Usar algo único e estável
<View key={att.savedPath ?? att.uri} style={styles.attachItem}>
```

---

### S5 — Vazamento de arquivo ao fechar modal em modo edição
**Arquivo:** `src/modals/TicketModal.tsx` — `handleClose`

```ts
// ❌ Atual — só deleta arquivos no modo criação
const handleClose = () => {
  for (const att of attachments) {
    if (att.savedPath && !isEdit) deleteFile(att.savedPath); // ← isEdit ignora novos anexos
  }
  resetForm();
  onClose();
};
```
**Problema:** Em modo edição, se o usuário adiciona um novo anexo (que já foi salvo em disco via `saveFile`) e depois cancela, o arquivo fica órfão no storage do dispositivo.

```ts
// ✅ Correto — deletar qualquer arquivo que foi salvo mas não está no banco
const handleClose = () => {
  for (const att of attachments) {
    // savedPath existe E não tinha savedPath original (foi adicionado agora)
    if (att.savedPath && !att._existingInDb) deleteFile(att.savedPath);
  }
  resetForm();
  onClose();
};
```
*(Requer adicionar flag `_existingInDb` ao tipo de attachment local.)*

---

### S6 — `companyRepo.delete` e `companyRepo.deleteWithCascade` são idênticos
**Arquivo:** `src/db/index.ts`

```ts
delete: (id: number) => db.runSync('DELETE FROM companies WHERE id = ?', [id]),

deleteWithCascade: (id: number) => {
  // Cascade delete now handled by FK constraint, but kept for compatibility
  db.runSync('DELETE FROM companies WHERE id = ?', [id]); // ← exatamente igual
},
```
`deleteWithCascade` pode ser removido. Qualquer chamador deve usar `delete` diretamente.

---

### S7 — `currentCompanyId` inicializado como `1` no store
**Arquivo:** `src/stores/appStore.ts`

```ts
// ❌ Pressupõe que a empresa de id=1 sempre existe
currentCompanyId: 1,
```
Se o usuário deletou a empresa 1, o app inicia em estado inválido. O valor inicial deveria ser `0` ou `null`, com verificação no bootstrap do app via `loadSavedCompany()`.

---

### S8 — `taskRepo.resetRecurring` chamado em todo `useFocusEffect`
**Arquivo:** `app/(tabs)/tarefas.tsx`

```ts
const loadTasks = useCallback(() => {
  taskRepo.resetRecurring(); // ← percorre todas as tarefas recorrentes toda vez que a tela ganha foco
  const all = viewAllCompanies ? taskRepo.getAll() : taskRepo.getByCompany(currentCompanyId);
  setTasks(all);
}, [viewAllCompanies, currentCompanyId]);
```
Com muitas tarefas recorrentes, isso pode ser lento. Deveria rodar uma vez por dia (verificar `todayISO()` e só resetar se já não rodou hoje) ou ser movido para o bootstrap do app (`_layout.tsx`).

---

## 🔵 Melhorias de UX / Produto

---

### U1 — Tela de detalhe não diferencia "carregando" de "não encontrado"
**Arquivo:** `app/ticket/[id].tsx`

```tsx
// ❌ Atual — mesmo estado para loading e 404
if (!ticket) {
  return <View><Text>Chamado nao encontrado</Text></View>;
}
```
Na primeira renderização, `ticket` é `null` porque o `useFocusEffect` ainda não rodou. O usuário vê brevemente "Chamado não encontrado" antes dos dados carregarem.

```tsx
// ✅ Adicionar estado de loading
const [loading, setLoading] = useState(true);

const loadData = useCallback(() => {
  setLoading(true);
  const t = ticketRepo.getById(ticketId);
  setTicket(t);
  setLoading(false);
}, [ticketId]);

if (loading) return <ActivityIndicator />;
if (!ticket) return <NotFoundView />;
```

---

### U2 — `FlashList` instalado mas não usado em nenhuma lista principal
O projeto tem `@shopify/flash-list` como dependência, mas `index.tsx`, `tarefas.tsx` e `stats.tsx` usam `FlatList` nativo. Para listas com paginação e muitos itens (tickets), `FlashList` tem performance notavelmente melhor.

```tsx
// Substituição simples
import { FlashList } from '@shopify/flash-list';

<FlashList
  data={tickets}
  keyExtractor={item => item.id}
  renderItem={renderItem}
  estimatedItemSize={80}  // ← obrigatório no FlashList
  onEndReached={loadMore}
  // ...restante igual ao FlatList
/>
```

---

### U3 — Sem feedback visual de contagem de tarefas pendentes na tab
**Arquivo:** `app/(tabs)/tarefas.tsx`

A tab de Chamados tem badge com contagem de abertos (`openCount`). A tab de Tarefas não tem badge mesmo havendo tarefas pendentes. Seria consistente mostrar a contagem de tarefas pendentes.

---

### U4 — Acentuação em strings de toast/alertas
Strings como `'Chamado nao encontrado'`, `'Titulo e obrigatorio'`, `'Comentario nao pode ser vazio'` aparecem sem acento por todo o projeto. Isso prejudica a experiência com usuários em PT-BR.

---

## Resumo Prioritário

| # | Arquivo | Problema | Impacto |
|---|---|---|---|
| B4 | `index.tsx` | `loadCompanies` não importada → crash | 🔴 Crash |
| B5 | `[id].tsx` | Transição não grava timeline | 🔴 Perda de dados |
| B1 | `db/index.ts` | `require()` dinâmico no loop | 🔴 Risco de falha |
| B2 | `tarefas.tsx` | StyleSheet key duplicada | 🟠 Style errado |
| A1 | `db/index.ts` | 7 queries na tela de stats | 🟠 Performance |
| A4 | `db/index.ts` | Restore não restaura timeline/attachments | 🟠 Perda de dados (undo) |
| S5 | `TicketModal` | Arquivo vaza ao cancelar edição | 🟡 Storage leak |
| U1 | `[id].tsx` | Flash de "não encontrado" no loading | 🔵 UX |
| U2 | Geral | FlashList instalado mas não usado | 🔵 Performance |
