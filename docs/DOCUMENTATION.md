# Helpdesk TI v2 - Documentação Completa

Aplicativo React Native (Expo) para gerenciamento de chamados de suporte técnico (helpdesk) com múltiplas empresas.

---

## Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura](#arquitetura)
3. [Banco de Dados](#banco-de-dados)
4. [Gerenciamento de Estado](#gerenciamento-de-estado)
5. [Estrutura de Arquivos](#estrutura-de-arquivos)
6. [Telas (Screens)](#telas-screens)
7. [Componentes](#componentes)
8. [Modais](#modais)
9. [Hooks Customizados](#hooks-customizados)
10. [Utilitários](#utilitários)
11. [Temas e Estilos](#temas-e-estilos)
12. [Fluxos Principais](#fluxos-principais)
13. [Issues Conhecidos e TODOs](#issues-conhecidos-e-todos)

---

## Visão Geral

**Propósito**: Sistema de helpdesk para gerenciamento de chamados de TI com suporte a múltiplas empresas, tarefas recorrentes, anexos de arquivos e timeline de eventos.

**Stack Tecnológico**:
- React Native 0.81.5
- Expo SDK 54
- TypeScript 5.9
- SQLite (expo-sqlite) para armazenamento local
- Zustand para gerenciamento de estado global
- Expo Router para navegação baseada em arquivos

**Funcionalidades Principais**:
- CRUD de empresas (clientes)
- CRUD de chamados com anexos
- Tarefas recorrentes e únicas com agendamento
- Timeline de eventos por chamado
- Filtro por empresa e status
- Busca textual em chamados
- Backup/Restore via JSON
- Notificações locais (stub)

---

## Arquitetura

```
app/                    # Rotas do Expo Router (telas)
  (tabs)/               # Tab navigation principal
    index.tsx           # Tela de Chamados
    tarefas.tsx         # Tela de Tarefas
    stats.tsx           # Tela de Relatório
    config.tsx          # Tela de Configurações
    _layout.tsx         # Layout das tabs
  ticket/[id].tsx       # Detalhe do chamado
  _layout.tsx           # Root layout

src/
  db/
    index.ts            # Camada de dados SQLite + repositórios
  stores/
    appStore.ts         # Zustand store (estado global)
  components/           # Componentes reutilizáveis
  modals/               # Modais (BottomSheet)
  hooks/                # Hooks customizados
  utils/                # Funções utilitárias
  constants/
    theme.ts            # Cores, spacing, tipografia
```

**Padrão Arquitetural**: Repository Pattern para acesso a dados + Zustand para estado global + Componentes funcionais com hooks.

---

## Banco de Dados

### Schema SQLite

**Arquivo**: `src/db/index.ts`

#### Tabelas

##### `companies`
Armazena as empresas/clientes.
```sql
CREATE TABLE companies (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
```

##### `categories`
Categorias de chamados (Hardware, Software, Rede, etc.).
```sql
CREATE TABLE categories (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);
```

##### `tickets`
Chamados/suportes.
```sql
CREATE TABLE tickets (
  id           TEXT PRIMARY KEY,
  company_id   INTEGER NOT NULL REFERENCES companies(id),
  title        TEXT NOT NULL,
  requester    TEXT NOT NULL,
  category     TEXT NOT NULL,
  priority     TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'aberto',
  description  TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
```

**Status possíveis**: `aberto`, `andamento`, `aguardando`, `fechado`

**Prioridades**: `baixa`, `media`, `alta`, `urgente`

##### `attachments`
Anexos de arquivos dos chamados.
```sql
CREATE TABLE attachments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id  TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  size       INTEGER NOT NULL,
  mime_type  TEXT,
  local_path TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

##### `timeline`
Histórico de eventos de cada chamado.
```sql
CREATE TABLE timeline (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id  TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  text       TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

**Tipos de evento**: `open`, `close`, `reopen`, `status`, `chat`, `attach`, `edit`

##### `tasks`
Tarefas recorrentes e únicas.
```sql
CREATE TABLE tasks (
  id              TEXT PRIMARY KEY,
  company_id      INTEGER NOT NULL REFERENCES companies(id),
  name            TEXT NOT NULL,
  task_type       TEXT NOT NULL DEFAULT 'rec',  -- 'rec' ou 'one'
  schedule_type   TEXT,        -- daily, weekly, monthly, xmonths, yearly, xyears, bom, eom
  schedule_days   TEXT,        -- JSON array [0,1,2,3,4] para weekly
  period_number   INTEGER DEFAULT 1,
  time_from       TEXT DEFAULT '08:00',
  time_to         TEXT DEFAULT '18:00',
  is_done         INTEGER NOT NULL DEFAULT 0,
  last_done_at    TEXT,
  last_reset_date TEXT,
  created_at      TEXT NOT NULL
);
```

##### `settings`
Chave-valor para configurações gerais.
```sql
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

### Repositórios

Cada tabela tem um repositório exportado com operações CRUD:

| Repositório | Funções Principais |
|-------------|-------------------|
| `companyRepo` | `getAll()`, `getById()`, `create()`, `delete()`, `clearData()`, `getTicketCount()`, `getTaskCount()` |
| `categoryRepo` | `getAll()`, `create()`, `delete()` |
| `ticketRepo` | `getPage()`, `getAllCompanies()`, `getById()`, `create()`, `update()`, `delete()`, `countOpen()` |
| `timelineRepo` | `getByTicket()`, `add()` |
| `attachmentRepo` | `getByTicket()`, `add()`, `delete()` |
| `taskRepo` | `getByCompany()`, `getAll()`, `create()`, `markDone()`, `markUndone()`, `resetRecurring()`, `delete()` |
| `settingsRepo` | `get()`, `set()` |
| `statsRepo` | `getSummary()`, `getTaskSummary()` |

### Inicialização

```typescript
initDatabase(): void
```
- Executa `PRAGMA journal_mode = WAL` e `PRAGMA foreign_keys = ON`
- Cria tabelas se não existirem
- Cria índices para performance
- Seed inicial de categorias padrão

**Auto-execução**: `initDatabase()` é chamado automaticamente ao importar o módulo.

---

## Gerenciamento de Estado

**Arquivo**: `src/stores/appStore.ts`

**Biblioteca**: Zustand

### State Shape

```typescript
interface AppStore {
  // Empresa selecionada
  currentCompanyId: number;
  currentCompanyName: string;
  viewAllCompanies: boolean;  // true = mostra todas empresas
  
  // Toast de feedback
  toast: Toast | null;
  
  // Busca
  searchQuery: string;
  
  // Modal global (não utilizado atualmente)
  openModal: string | null;
}
```

### Actions

| Action | Parâmetros | Descrição |
|--------|------------|-----------|
| `setCurrentCompany` | `(id: number, name: string)` | Define empresa atual e persiste no SecureStore |
| `setViewAllCompanies` | `(v: boolean)` | Alterna entre visualizar empresa específica ou todas |
| `showToast` | `(msg, opts?)` | Exibe toast com mensagem e opção de undo opcional |
| `hideToast` | - | Remove toast |
| `setSearchQuery` | `(q: string)` | Define termo de busca |
| `setOpenModal` | `(name: string | null)` | Abre/facha modal global |

### Persistência

- `currentCompanyId` e `currentCompanyName` são persistidos no `SecureStore`
- `loadSavedCompany()`: Carrega empresa salva ao iniciar o app

---

## Estrutura de Arquivos

### Camada de Apresentação (app/)

| Arquivo | Responsabilidade |
|---------|-----------------|
| `app/_layout.tsx` | Root layout, providers (SafeArea, GestureHandler), carrega empresa salva, solicita permissões |
| `app/(tabs)/_layout.tsx` | Configuração das tabs (ícones, cores, altura da tabBar) |
| `app/(tabs)/index.tsx` | Lista de chamados com filtros, paginação, busca, company selector |
| `app/(tabs)/tarefas.tsx` | Lista de tarefas com filtros, auto-reset diário, company selector |
| `app/(tabs)/stats.tsx` | Relatórios e estatísticas, resumo de chamados e tarefas |
| `app/(tabs)/config.tsx` | Gerenciamento de empresas, categorias, backup/restore |
| `app/ticket/[id].tsx` | Detalhe de chamado, timeline, anexos, comentários, transições de status |
| `app/+not-found.tsx` | Tela 404 (não utilizada atualmente) |

### Camada de Dados (src/db/)

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/db/index.ts` | Schema SQLite, repositórios, inicialização |

### Componentes (src/components/)

| Componente | Props | Descrição |
|------------|-------|-----------|
| `TicketCard` | `ticket`, `onPress`, `showCompanyName` | Card de chamado na lista |
| `TaskCard` | `task`, `onToggle`, `onDelete` | Card de tarefa com checkbox |
| `StatusBadge` | `status` | Badge colorida por status |
| `PriorityBadge` | `priority` | Badge colorida por prioridade |
| `TimelineItem` | `type`, `text`, `createdAt` | Item de histórico |
| `AttachmentRow` | `attachment`, `onView`, `onDelete` | Linha de anexo com thumbnail |
| `BottomSheet` | `visible`, `onClose`, `children`, `height` | Modal bottom sheet animado |
| `ConfirmDialog` | `visible`, `title`, `message`, `onConfirm`, `onCancel` | Dialog de confirmação |
| `EmptyState` | `icon`, `message`, `subMessage` | Estado vazio com ícone |
| `FAB` | `onPress`, `icon`, `color`, `bottom` | Floating Action Button |
| `SearchBar` | `value`, `onChangeText`, `onClear`, `placeholder` | Barra de busca |
| `UndoToast` | - | Toast com ação de desfazer |
| `SwipeableRow` | `onDelete?`, `onEdit?` | Wrapper com swipe para esquerda/direita |

### Modais (src/modals/)

| Modal | Props | Descrição |
|-------|-------|-----------|
| `TicketModal` | `visible`, `onClose`, `editTicketId` | Criar/editar chamado |
| `TaskModal` | `visible`, `onClose` | Criar tarefa |
| `CompanyModal` | `visible`, `onClose` | Criar empresa |
| `TransitionModal` | `visible`, `onClose`, `ticketId`, `currentStatus`, `newStatus`, `onConfirm` | Mudar status com comentário |

### Hooks (src/hooks/)

| Hook | Retorno | Descrição |
|------|---------|-----------|
| `useMediaPermissions` | `{ requestCamera, requestGallery }` | Permissões de câmera e galeria |
| `useNotifications` | - | Stub para notificações push |
| `usePagination` | - | (não implementado, usar paginação manual) |

### Utilitários (src/utils/)

| Arquivo | Funções | Descrição |
|---------|---------|-----------|
| `dateUtils.ts` | `nowStr()`, `todayISO()`, `fmtSize()` | Formatação de data/tamanho |
| `fileUtils.ts` | `ensureDir()`, `saveFile()`, `deleteFile()`, `readBase64()`, `isImage()` | Manipulação de arquivos |
| `scheduleUtils.ts` | `isTaskAvailableNow()`, `nextAvailLabel()`, `scheduleLabel()` | Lógica de tarefas recorrentes |
| `backupUtils.ts` | `exportBackup()`, `importBackup()`, `confirmAndImportBackup()` | Backup/Restore JSON |

### Constantes (src/constants/)

| Arquivo | Conteúdo |
|---------|----------|
| `theme.ts` | `Colors`, `Spacing`, `FontSize`, `Radius`, `priColor()`, `statusColor()`, `statusLabel()` |

---

## Telas (Screens)

### `app/_layout.tsx` - Root Layout

**Responsabilidades**:
- Envolve app com `GestureHandlerRootView` (necessário para swipe/scroll)
- Envolve app com `SafeAreaProvider`
- Configura `Stack` navigation com `headerShown: false`
- Carrega empresa salva do SecureStore ao montar
- Solicita permissões de notificação
- Renderiza `Toast` global

**Configuração de Navegação**:
```typescript
<Stack>
  <Stack.Screen name="(tabs)" />
  <Stack.Screen
    name="ticket/[id]"
    options={{ presentation: 'card', animation: 'slide_from_right' }}
  />
</Stack>
```

### `app/(tabs)/_layout.tsx` - Tab Layout

**Responsabilidades**:
- Configura 4 tabs: Chamados, Tarefas, Relatorio, Config
- Define ícones (MaterialCommunityIcons) por tab
- Calcula altura da tabBar considerando safe area inset
- Define cores ativas/inativas conforme tema

**Altura da TabBar**:
```typescript
const tabBarHeight = 60;
const totalHeight = tabBarHeight + (insets.bottom > 0 ? insets.bottom : 6);
```

### `app/(tabs)/index.tsx` - Chamados

**Estado Local**:
- `showCompanyDropdown`: Controla dropdown de empresas
- `showSearch`: Mostra/esconde barra de busca
- `activeFilter`: Filtro de status (all, aberto, andamento, aguardando, fechado)
- `companies`: Lista de empresas
- `openCount`: Contagem de chamados abertos
- `tickets`, `page`, `loading`, `refreshing`, `hasMore`: Paginação
- `debouncedSearch`: Busca com debounce (300ms)
- `showTicketModal`, `editTicketId`: Modal de criar/editar
- `showCompanyModal`: Modal de nova empresa

**Filtros**:
```typescript
const FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'aberto', label: 'Abertos' },
  { value: 'andamento', label: 'Andamento' },
  { value: 'aguardando', label: 'Aguardando' },
  { value: 'fechado', label: 'Fechados' },
];
```

**Paginação**:
- Page size: 30 itens
- `loadMore()` carrega próxima página ao rolar
- `onEndReachedThreshold={0.3}`

**Company Selector**:
- Dropdown com lista de empresas
- Opção "Ver todas" para visualizar todas as empresas
- Persista seleção no Zustand store

### `app/(tabs)/tarefas.tsx` - Tarefas

**Estado Local**:
- `activeFilter`: pending, done, rec, one
- `tasks`: Lista de tarefas
- `showTaskModal`: Modal de nova tarefa
- `deleteTarget`: Tarefa para excluir
- `showCompanyDropdown`, `companies`: Seletor de empresa
- `showCompanyModal`: Modal de nova empresa

**Filtros**:
```typescript
const FILTERS = [
  { value: 'pending', label: 'Pendentes' },
  { value: 'done', label: 'Concluidas' },
  { value: 'rec', label: 'Recorrentes' },
  { value: 'one', label: 'Unicas' },
];
```

**Auto-reset diário**:
- `taskRepo.resetRecurring()` é chamado ao focar a tela
- Reseta tarefas recorrentes concluídas se `last_reset_date != today`

### `app/(tabs)/stats.tsx` - Relatório

**Estatísticas**:
- Cards 2x2: Total, Abertos, Andamento, Aguardando
- Card full-width: Fechados
- Taxa de fechamento (% de fechados sobre total)
- Por categoria (barra de progresso)
- Por prioridade (barra de progresso)
- Checklist hoje (% de tarefas concluídas)
- Periodos (esta semana, este mês)

**Filtro implícito**: Usa `viewAllCompanies` do Zustand

### `app/(tabs)/config.tsx` - Configurações

**Seções**:

1. **Empresas**:
   - Lista com nome, contagem de chamados/tarefas
   - Ações: Selecionar, Limpar (dados), Excluir
   - Botão "Nova Empresa"

2. **Categorias**:
   - Input para adicionar nova
   - Lista com botão de excluir

3. **Backup**:
   - Exportar: Gera JSON e abre share sheet
   - Importar: Pick de arquivo JSON e restaura

**Delete cascade**: Ao excluir empresa, remove tickets e tasks associados primeiro (ver `companyRepo.delete()`).

### `app/ticket/[id].tsx` - Detalhe do Chamado

**Propósito**: Tela completa de visualização e gestão de um chamado específico, incluindo informações detalhadas, timeline de eventos, anexos, comentários e transições de status.

**Estado Local**:
- `ticket`, `timeline`, `attachments`: Dados do chamado carregados do banco
- `comment`: Input de comentário (max 500 caracteres)
- `showTransitionModal`, `transitionTarget`: Modal de mudança de status
- `showReabrirDialog`: Dialog de reabertura (quando status='aberto')
- `showDeleteDialog`: Dialog de exclusão do chamado
- `showEditModal`: Modal de edição do chamado
- `showAttachMenu`: Menu inferior para seleção de tipo de anexo
- `showImageViewer`, `viewerImageUri`: Estado do visualizador de imagem fullscreen

**Transições de Status**:
```typescript
const STATUS_TRANSITIONS = {
  aberto: ['andamento', 'aguardando', 'fechado'],
  andamento: ['aguardando', 'fechado'],
  aguardando: ['aberto', 'andamento', 'fechado'],
  fechado: ['aberto'],
};
```
- Botões de transição dinâmicos baseados no status atual
- Transição especial ('aberto') abre dialog de confirmação
- Outras abrem `TransitionModal` para comentário

**Comentários**:
- Input fixo no bottom com suporte a multiline
- Limite de 500 caracteres
- Adiciona entrada `chat` na timeline ao enviar
- Estado vazio impede envio (botão desabilitado)

**Anexos**:
- **Visualização**: Imagens abrem em modal fullscreen (`ImageViewerModal`)
- **Outros arquivos**: Exibem informações em `Alert` (nome, tamanho, tipo)
- **Adição**: Menu bottom sheet com 3 opções:
  - "Tirar foto" - Abre câmera com `ImagePicker.launchCameraAsync`
  - "Galeria" - Abre galeria com `ImagePicker.launchImageLibraryAsync`
  - "Arquivo" - Abre seletor de documentos com `DocumentPicker.getDocumentAsync`
- **Exclusão**: Confirmação via `Alert.alert` antes de remover do filesystem e BD
- **Armazenamento**: Arquivos salvos em `FileSystem.documentDirectory/attachments`

**Funções Principais**:
- `handleViewAttachment()`: Decide entre visualização fullscreen (imagem) ou info (outros)
- `handleAddAttachment()`: Gerencia processo de seleção e salvamento de anexos
- `handleDeleteAttachment()`: Remove anexo do filesystem e do banco
- `handleConfirmTransition()`: Atualiza status do chamado
- `handleDeleteTicket()`: Remove chamado e todos os seus anexos em cascata
- `handleCopySummary()`: Copia resumo do chamado para clipboard
---

## Componentes

### `TicketCard`

**Props**:
```typescript
interface TicketCardProps {
  ticket: Ticket;
  onPress: () => void;
  showCompanyName?: boolean;
}
```

**Features**:
- Borda colorida à esquerda conforme prioridade
- Thumbnail do primeiro anexo (se imagem)
- Badges de status e prioridade
- Descrição com 2 linhas máximo
- Company badge (se `showCompanyName=true`)

### `TaskCard`

**Props**:
```typescript
interface TaskCardProps {
  task: Task;
  onToggle: () => void;
  onDelete: () => void;
}
```

**Features**:
- Checkbox marcado/desmarcado
- Badge com label de agendamento
- "Feita as HH:mm" se concluída
- "Disponivel: ..." se não disponível no momento
- Opacidade reduzida se concluída

### `StatusBadge` / `PriorityBadge`

**Props**:
```typescript
interface StatusBadgeProps { status: string; }
interface PriorityBadgeProps { priority: string; }
```

**Cores**:
- Status: aberto=green, andamento=yellow, aguardando=purple, fechado=muted
- Prioridade: baixa=muted, media=yellow, alta=orange, urgente=red

### `TimelineItem`

**Props**:
```typescript
interface TimelineItemProps {
  type: string;
  text: string;
  createdAt: string;
}
```

**Tipos e cores**:
- `open`: green
- `status`: blue
- `chat`: purple
- `attach`: green
- `reopen`: yellow
- `close`: muted
- `edit`: orange

**Layout**: Dot colorido + linha vertical + conteúdo

### `AttachmentRow`

**Props**:
```typescript
interface AttachmentRowProps {
  attachment: Attachment;
  onView: () => void;
  onDelete: () => void;
}
```

**Features**:
- Thumbnail de imagem ou ícone de arquivo
- Nome e tamanho formatado
- Botões de visualizar e excluir

### `BottomSheet`

**Props**:
```typescript
interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  height?: number;
}
```

**Animação**:
- Slide up com spring (tension: 65, friction: 12)
- Slide down com timing (250ms)
- Overlay com backdrop blur (rgba(0,0,0,0.5))

### `ConfirmDialog`

**Props**:
```typescript
interface ConfirmDialogProps {
  visible: boolean;
  title?: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}
```

**Layout**: Modal centralizado com botões "Nao" e "Sim"

### `EmptyState`

**Props**:
```typescript
interface EmptyStateProps {
  icon?: string;
  message: string;
  subMessage?: string;
}
```

### `FAB`

**Props**:
```typescript
interface FABProps {
  onPress: () => void;
  icon?: string;
  color?: string;
  bottom?: number;
}
```

**Posicionamento**:
- Fixed no bottom-right
- bottom padrão: 68 (Android) / 72 (iOS)
- zIndex: 9999

### `SearchBar`

**Props**:
```typescript
interface SearchBarProps {
  value: string;
  onChangeText: (t: string) => void;
  onClear: () => void;
  placeholder?: string;
}
```

### `UndoToast`

**Estado**: Lê `toast` do Zustand store

**Features**:
- Mensagem com botão "DESFAZER" opcional
- Auto-hide após 2500ms (sem undo) ou 3500ms (com undo)
- Posicionado abaixo da safe area top

### `SwipeableRow`

**Props**:
```typescript
interface SwipeableRowProps {
  children: React.ReactNode;
  onDelete?: () => void;
  onEdit?: () => void;
}
```

**Features**:
- Usa `Swipeable` do `react-native-gesture-handler`
- Swipe para direita: botão "Excluir" (vermelho)
- Swipe para esquerda: botão "Editar" (azul)
- Fecha automaticamente após ação
- `overshootRight={false}` e `overshootLeft={false}`

---

## Modais

### `TicketModal`

**Props**:
```typescript
interface TicketModalProps {
  visible: boolean;
  onClose: () => void;
  editTicketId?: string | null;
}
```

**Campos**:
- Título (obrigatório)
- Solicitante (obrigatório)
- Categoria (dropdown)
- Prioridade (4 botões)
- Descrição (multiline)
- Anexos (câmera/galeria)

**Modo Edição**:
- Carrega dados existentes
- Compara com valores originais
- Registra mudanças na timeline

**Anexos**:
- Armazena em `attachments` array temporário
- Salva no filesystem ao confirmar
- Remove do filesystem se cancelar (modo criação)

### `TaskModal`

**Props**:
```typescript
interface TaskModalProps {
  visible: boolean;
  onClose: () => void;
}
```

**Campos**:
- Nome (obrigatório)
- Tipo: Recorrente / Única
- Frequência: Diário, Semanal, Mensal, A cada X meses, Anual, A cada X anos, Início do mês, Fim do mês
- Dias da semana (para semanal)
- Período (para xmonths/xyears)
- Horário de início/fim

### `CompanyModal`

**Props**:
```typescript
interface CompanyModalProps {
  visible: boolean;
  onClose: () => void;
}
```

**Campos**:
- Nome da empresa (obrigatório, único)

### `TransitionModal`

**Props**:
```typescript
interface TransitionModalProps {
  visible: boolean;
  onClose: () => void;
  ticketId: string;
  currentStatus: string;
  newStatus: string;
  onConfirm: () => void;
}
```

**Campos**:
- Comentário obrigatório
- Exibe transição atual ("De X para Y")
- Adiciona entrada na timeline com tipo apropriado

---

## Hooks Customizados

### `useMediaPermissions`

**Arquivo**: `src/hooks/useMediaPermissions.ts`

**Retorno**:
```typescript
{
  requestCamera: () => Promise<boolean>;
  requestGallery: () => Promise<boolean>;
}
```

**Comportamento**:
- Solicita permissões via `ImagePicker`
- Exibe Alert com link para Settings se negado
- Retorna `true` se concedido

### `useNotifications`

**Arquivo**: `src/hooks/useNotifications.ts`

**Stubs**:
- `requestNotificationPermission()`: Sempre retorna `true`
- `scheduleTaskNotification()`: No-op
- `cancelTaskNotification()`: No-op
- `updateBadge()`: No-op

**Nota**: Notificações requerem development build (não funciona em Expo Go)

### `usePagination`

**Arquivo**: `src/hooks/usePagination.ts`

**Assinatura**:
```typescript
function usePagination<T>(
  fetcher: (page: number) => T[],
  deps: any[] = []
): {
  items: T[];
  refresh: () => void;
  loadMore: () => void;
  hasMore: boolean;
  loading: boolean;
}
```

**Comportamento**:
- Gerencia paginação com page size de 30 itens
- `refresh()`: Reseta para página 0 e recarrega
- `loadMore()`: Carrega próxima página se houver mais dados
- `hasMore`: `true` se última fetch retornou 30 itens

**Nota**: Hook não é utilizado nas telas atualmente (paginação manual implementada).

---

## Utilitários

### `dateUtils.ts`

```typescript
nowStr(): string       // "DD/MM/YYYY HH:mm"
todayISO(): string     // "YYYY-MM-DD"
fmtSize(bytes): string // "1.2MB" ou "340.5KB"
```

### `fileUtils.ts`

```typescript
ensureDir(): Promise<void>
saveFile(uri, name): Promise<string>  // Retorna path destino
deleteFile(path): Promise<void>
readBase64(path): Promise<string>
isImage(name, mimeType?): boolean
```

**Diretório**: `FileSystem.documentDirectory/attachments`

### `scheduleUtils.ts`

**Interface**:
```typescript
interface TaskSchedule {
  task_type: string;
  schedule_type: string | null;
  schedule_days: string | null;
  period_number: number | null;
  time_from: string | null;
  time_to: string | null;
  last_done_at: string | null;
}
```

**Funções**:

```typescript
isTaskAvailableNow(task: TaskSchedule): boolean
```
- Verifica se tarefa pode ser executada agora
- Considera horário (time_from/time_to)
- Considera frequência e último execution

```typescript
nextAvailLabel(task: TaskSchedule): string
```
- Retorna label "Próximo X às HH:mm"

```typescript
scheduleLabel(task: TaskSchedule): string
```
- Retorna label legível "Diário 08:00-18:00", "Seg, Qua, Sex 08:00-18:00", etc.

**Lógica de Frequências**:

| Tipo | Condição de Disponível |
|------|----------------------|
| `daily` | last_done < hoje |
| `weekly` | dia da semana incluso E last_done < hoje |
| `monthly` | last_done mês diferente de hoje |
| `xmonths` | diff de meses >= period_number |
| `yearly` | last_done ano diferente de hoje |
| `xyears` | diff de anos >= period_number |
| `bom` | Hoje é primeiro dia útil do mês |
| `eom` | Hoje é último dia útil do mês |

### `backupUtils.ts`

```typescript
exportBackup(): Promise<{ success: boolean; error?: string }>
```
- Exporta todas as tabelas para JSON
- Anexos em base64 (skip se > 1MB)
- Abre share sheet para salvar

```typescript
importBackup(): Promise<{ success: boolean; summary?: string; error?: string; json?: string }>
```
- Pick de arquivo JSON
- Valida estrutura
- Retorna resumo e JSON cru

```typescript
confirmAndImportBackup(json: string): Promise<{ success: boolean; error?: string }>
```
- Deleta todos os dados atuais
- Recria a partir do JSON
- Restaura anexos em base64

---

## Temas e Estilos

**Arquivo**: `src/constants/theme.ts`

### Cores

```typescript
Colors = {
  bg:         '#0d1117',  // Fundo principal
  surface:    '#161b22',  // Cards, superfícies
  surfaceAlt: '#21262d',  // Elementos secundários
  header:     '#0f3460',  // Header (não utilizado)
  border:     '#21262d',  // Bordas

  textPrimary:   '#e6edf3',  // Texto principal
  textSecondary: '#c9d1d9',  // Texto secundário
  textMuted:     '#8b949e',  // Texto desativado
  textDim:       '#484f58',  // Texto fraco

  blue:   '#58a6ff',  // Ações, links
  green:  '#3fb950',  // Sucesso, aberto
  red:    '#e94560',  // Erro, urgente, fechar
  yellow: '#d29922',  // Warning, andamento
  orange: '#f0883e',  // Alta prioridade
  purple: '#a371f7',  // Aguardando
  white:  '#ffffff',
}
```

### Helpers

```typescript
priColor(p: string): string      // Cor por prioridade
statusColor(s: string): string   // Cor por status
statusLabel(s: string): string   // Label formatada por status
```

### Espaçamento

```typescript
Spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24
}
```

### Tipografia

```typescript
FontSize = {
  xs: 11, sm: 12, md: 13, base: 14, lg: 16, xl: 18
}
```

### Border Radius

```typescript
Radius = {
  sm: 6, md: 8, lg: 10, xl: 12, full: 999
}
```

---

## Fluxos Principais

### Criar Chamado

1. User clica FAB na tela Chamados
2. Valida empresa selecionada (não pode ser "Ver todas")
3. `TicketModal` abre
4. Preenche campos obrigatórios (título, solicitante)
5. Opcional: categoria, prioridade, descrição, anexos
6. Ao salvar:
   - Gera ID `tk_${Date.now()}`
   - Insert em `tickets`
   - Insert em `timeline` (tipo `open`)
   - Salva anexos no filesystem
   - Insert em `attachments`
7. Toast de sucesso
8. Recarrega lista

### Editar Chamado

1. User clica no card do chamado
2. Navega para `ticket/[id].tsx`
3. Clica ícone de lápis
4. `TicketModal` abre com dados preenchidos
5. Edita campos
6. Ao salvar:
   - Compara com valores originais
   - Update em `tickets` (apenas campos alterados)
   - Insert em `timeline` (tipo `edit`) com diff
7. Toast de sucesso
8. Recarrega dados

### Mudar Status

1. Na tela de detalhe, clica botão de transição
2. Se `fechado`: `ConfirmDialog` de reabertura
3. Se outro: `TransitionModal` abre
4. Digita comentário obrigatório
5. Ao confirmar:
   - Insert em `timeline` (tipo `status`, `close`, ou `reopen`)
   - Update em `tickets.status`
   - Update em `tickets.updated_at`
6. Toast de sucesso
7. Recarrega dados

### Criar Tarefa

1. User clica FAB na tela Tarefas
2. Valida empresa selecionada
3. `TaskModal` abre
4. Preenche nome, tipo, frequência, horário
5. Ao salvar:
   - Gera ID `ts_${Date.now()}`
   - Insert em `tasks`
   - `schedule_days` serializado como JSON
6. Toast de sucesso
7. Recarrega lista

### Concluir Tarefa

1. User clica checkbox da tarefa
2. Se não concluída: `taskRepo.markDone()`
   - Set `is_done = 1`
   - Set `last_done_at = now()`
   - Set `last_reset_date = todayISO()`
   - Haptic feedback
   - Toast com undo
3. Se concluída: `taskRepo.markUndone()`
   - Set `is_done = 0`
   - Set `last_done_at = NULL`
   - Haptic feedback
   - Toast
4. Recarrega lista

### Auto-reset de Tarefas Recorrentes

1. Ao focar tela Tarefas: `taskRepo.resetRecurring()`
2. SQL:
   ```sql
   UPDATE tasks
   SET is_done = 0
   WHERE task_type = 'rec'
     AND is_done = 1
     AND (last_reset_date IS NULL OR last_reset_date != today)
   ```
3. Reseta tarefas que foram concluídas em outro dia

### Excluir Empresa

1. Em Config, clica "Excluir" em empresa
2. `ConfirmDialog` abre
3. Ao confirmar: `companyRepo.delete(id)`
4. Cascade delete:
   - Delete de `attachments` (via tickets)
   - Delete de `timeline` (via tickets)
   - Delete de `tickets`
   - Delete de `tasks`
   - Delete de `companies`
5. Toast de sucesso
6. Recarrega lista

### Backup

**Exportar**:
1. Em Config, clica "Exportar Backup"
2. `exportBackup()`:
   - Lê todas as tabelas
   - Para cada anexo: lê como base64 (skip se > 1MB)
   - Monta objeto JSON
   - Salva em `FileSystem.documentDirectory/backups/`
   - Abre share sheet
3. Toast de sucesso/erro

**Importar**:
1. Em Config, clica "Importar Backup"
2. `importBackup()`:
   - Pick de arquivo JSON
   - Valida estrutura
   - Retorna resumo
3. `confirmAndImportBackup(json)`:
   - Deleta todas as tabelas
   - Recria na ordem: companies, categories, tickets, attachments, timeline, tasks
   - Restaura anexos base64 no filesystem
4. Toast de sucesso/erro

---

## Issues Conhecidos e TODOs

### Bugs Conhecidos

Nenhum bug crítico conhecido no momento.

### Melhorias Pendentes

1. **Notificações**: `useNotifications.ts` é stub. Implementar com `expo-notifications` em development build.

2. **Badge de notificação**: `updateBadge()` é stub. Requer `expo-notifications` no iOS.

3. **Periodos no Stats**: Tela de relatório mostra "Esta semana" e "Este mês" com o mesmo valor (total). Implementar filtro por data.

4. **Busca em Tarefas**: Não há busca na tela de tarefas. Adicionar `SearchBar`.

5. **Undo em exclusão de empresa**: `showToast` suporta `onUndo`, mas `handleDeleteCompany` não passa callback.

6. **Validação de horário**: `TaskModal` não valida se `time_from < time_to`.

7. **Anexos grandes**: Backup skipa anexos > 1MB. Considerar upload para cloud ou compressão.

8. **Ordenação de tarefas**: `taskRepo.getByCompany()` ordena por `created_at`, mas não há filtro por status (pendentes primeiro).

### Dependências de Produção

Para notificações push e badge:
- `expo-notifications` já está instalado
- Requer **development build** (não funciona em Expo Go)
- Configurar `app.config.ts` com permissões

---

## Apêndice: Exemplos de Uso

### Adicionar novo campo em Ticket

1. **Database**: `src/db/index.ts`
   ```typescript
   // No CREATE TABLE tickets
   new_field TEXT DEFAULT NULL,
   
   // No tipo Ticket
   export interface Ticket {
     // ...
     new_field: string | null;
   }
   ```

2. **Repository**: `src/db/index.ts`
   ```typescript
   export const ticketRepo = {
     // ...
     updateNewField: (id: string, value: string | null) => {
       db.runSync('UPDATE tickets SET new_field = ? WHERE id = ?', [value, id]);
     },
   };
   ```

3. **Modal**: `src/modals/TicketModal.tsx`
   ```typescript
   const [newField, setNewField] = useState('');
   // No handleSave
   if (isEdit) {
     if (newField !== originalValues?.new_field) {
       ticketRepo.updateNewField(editTicketId, newField);
     }
   }
   ```

### Criar nova tela

1. **Arquivo**: `app/(tabs)/nova-tela.tsx`
   ```typescript
   import { SafeAreaView } from 'react-native-safe-area-context';
   import { useAppStore } from '../../src/stores/appStore';
   import { Colors } from '../../src/constants/theme';
   
   export default function NovaTela() {
     const { currentCompanyId } = useAppStore();
     
     return (
       <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
         {/* Conteúdo */}
       </SafeAreaView>
     );
   }
   ```

2. **Layout**: `app/(tabs)/_layout.tsx`
   ```typescript
   <Tabs.Screen name="nova-tela" options={{ title: 'Nova', tabBarIcon: ... }} />
   ```

---

**Última atualização**: 2026-04-20
**Versão do app**: 1.0.0
**Expo SDK**: 54
