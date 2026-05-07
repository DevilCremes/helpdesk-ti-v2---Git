# AGENTS.md v2.0 — Helpdesk TI Mobile App
## Instrução para IA Agêntica (Claude Code / Cursor / Aider)

> **Leia este arquivo inteiro antes de escrever qualquer código.**
> Sua missão: construir o app **Helpdesk TI** do zero, em React Native + Expo, totalmente offline.
> Siga cada seção em ordem. Não peça confirmação — execute tudo autonomamente.
> Este é o documento de referência completo. Em caso de conflito entre seções, a mais recente prevalece.

---

## 1. VISÃO GERAL

Aplicativo de gerenciamento de chamados de TI e checklist de tarefas recorrentes.
- 100% offline — nenhuma chamada de rede para funcionalidade
- Dados persistidos em SQLite local via `expo-sqlite`
- Arquivos/imagens salvos em `expo-file-system`
- Múltiplas empresas (clientes) com isolamento de dados
- Design dark fiel ao webapp original (tema azul `#0f3460` + vermelho `#e94560`)

---

## 2. STACK TECNOLÓGICA

```
Framework:            React Native + Expo SDK 52
Navegação:            expo-router v4 (file-based)
Banco de dados:       expo-sqlite (raw SQL síncrono — NÃO usar drizzle-orm)
Arquivos:             expo-file-system
Imagens/Camera:       expo-image-picker
Documentos:           expo-document-picker
Compartilhar:         expo-sharing
Clipboard:            expo-clipboard
Notificações locais:  expo-notifications
Haptic:               expo-haptics
Permissões:           expo-permissions (via expo-modules-core)
Estado global:        zustand
Armazenamento KV:     expo-secure-store  (persistir empresa atual, PIN, settings)
Listas:               @shopify/flash-list
Ícones:               @expo/vector-icons (MaterialCommunityIcons)
Gestos/Swipe:         react-native-gesture-handler + react-native-reanimated
Animações:            react-native-reanimated v3
```

---

## 3. INICIALIZAÇÃO DO PROJETO

Execute exatamente em ordem:

```bash
npx create-expo-app@latest helpdesk-ti --template blank-typescript
cd helpdesk-ti

npx expo install \
  expo-router \
  expo-sqlite \
  expo-file-system \
  expo-image-picker \
  expo-document-picker \
  expo-sharing \
  expo-clipboard \
  expo-notifications \
  expo-haptics \
  expo-secure-store \
  @expo/vector-icons \
  @shopify/flash-list \
  zustand \
  react-native-safe-area-context \
  react-native-screens \
  react-native-gesture-handler \
  react-native-reanimated
```

**`app.json` completo:**
```json
{
  "expo": {
    "name": "Helpdesk TI",
    "slug": "helpdesk-ti",
    "scheme": "helpdesk",
    "version": "1.0.0",
    "orientation": "portrait",
    "backgroundColor": "#0d1117",
    "userInterfaceStyle": "dark",
    "plugins": [
      "expo-router",
      "expo-sqlite",
      [
        "expo-image-picker",
        {
          "photosPermission": "Necessário para anexar fotos aos chamados.",
          "cameraPermission": "Necessário para tirar fotos dos chamados."
        }
      ],
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#0f3460",
          "sounds": []
        }
      ],
      "expo-secure-store"
    ],
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/icon.png",
        "backgroundColor": "#0f3460"
      },
      "permissions": [
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.CAMERA",
        "android.permission.RECEIVE_BOOT_COMPLETED",
        "android.permission.VIBRATE",
        "android.permission.POST_NOTIFICATIONS"
      ],
      "package": "com.helpdeskti.app"
    },
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.helpdeskti.app"
    },
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

---

## 4. ESTRUTURA DE PASTAS

Crie exatamente esta estrutura:

```
helpdesk-ti/
├── app/
│   ├── _layout.tsx                     # Root layout: init DB + notif + gestures
│   ├── (tabs)/
│   │   ├── _layout.tsx                 # Tab bar inferior (4 abas)
│   │   ├── index.tsx                   # Aba: Chamados
│   │   ├── checklist.tsx               # Aba: Checklist
│   │   ├── stats.tsx                   # Aba: Relatório
│   │   └── config.tsx                  # Aba: Configurações
│   ├── ticket/
│   │   └── [id].tsx                    # Tela de detalhe do chamado
│   └── +not-found.tsx
├── src/
│   ├── db/
│   │   └── index.ts                    # init, queries, todos os repositórios
│   ├── stores/
│   │   └── appStore.ts                 # Estado global (empresa, toast, search, modal)
│   ├── components/
│   │   ├── TicketCard.tsx              # Card com swipe actions + miniatura de imagem
│   │   ├── TaskCard.tsx                # Card com swipe delete + próxima disponibilidade
│   │   ├── StatusBadge.tsx
│   │   ├── PriorityBadge.tsx
│   │   ├── TimelineItem.tsx
│   │   ├── AttachmentRow.tsx
│   │   ├── FilterBar.tsx               # Filtros horizontais + busca
│   │   ├── SearchBar.tsx               # Campo de busca retrátil
│   │   ├── FAB.tsx
│   │   ├── Toast.tsx                   # Toast com botão "Desfazer"
│   │   ├── ConfirmDialog.tsx
│   │   ├── BottomSheet.tsx             # Reanimated bottom sheet reutilizável
│   │   ├── EmptyState.tsx
│   │   ├── SwipeableRow.tsx            # Wrapper de swipe (Reanimated)
│   │   └── UndoToast.tsx               # Toast especial com timeout + desfazer
│   ├── modals/
│   │   ├── TicketModal.tsx             # Criar/editar chamado
│   │   ├── TaskModal.tsx               # Criar tarefa
│   │   ├── CompanyModal.tsx
│   │   └── TransitionModal.tsx         # Mudança de status com comentário obrigatório
│   ├── hooks/
│   │   ├── useDatabase.ts              # Inicialização do DB + seed
│   │   ├── useMediaPermissions.ts      # Solicitar câmera/galeria com fallback
│   │   ├── useNotifications.ts         # Permissão + agendamento + cancelamento
│   │   └── usePagination.ts            # Paginação genérica para FlashList
│   ├── utils/
│   │   ├── colors.ts
│   │   ├── dateUtils.ts
│   │   ├── fileUtils.ts
│   │   ├── backupUtils.ts
│   │   └── scheduleUtils.ts            # Lógica CORRETA de recorrência
│   └── constants/
│       └── theme.ts
└── assets/
    ├── icon.png
    └── notification-icon.png
```

---

## 5. BANCO DE DADOS — SCHEMA E INIT

**Arquivo único: `src/db/index.ts`**

Use APENAS `expo-sqlite` com SQL raw. Não usar drizzle-orm.

```typescript
import * as SQLite from 'expo-sqlite';
import { nowStr } from '../utils/dateUtils';

const db = SQLite.openDatabaseSync('helpdesk_v2.db');

// ─── INIT ────────────────────────────────────────────────────────────────────
export function initDatabase(): void {
  db.execSync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS companies (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL UNIQUE,
      created_at TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT    NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS technicians (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL UNIQUE,
      created_at TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id           TEXT    PRIMARY KEY,
      company_id   INTEGER NOT NULL REFERENCES companies(id),
      title        TEXT    NOT NULL,
      requester    TEXT    NOT NULL,
      assignee     TEXT,
      category     TEXT    NOT NULL,
      priority     TEXT    NOT NULL,
      status       TEXT    NOT NULL DEFAULT 'aberto',
      description  TEXT,
      due_date     TEXT,
      created_at   TEXT    NOT NULL,
      updated_at   TEXT    NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tickets_company  ON tickets(company_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_status   ON tickets(status);
    CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
    CREATE INDEX IF NOT EXISTS idx_tickets_created  ON tickets(created_at DESC);

    CREATE TABLE IF NOT EXISTS attachments (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id  TEXT    NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      name       TEXT    NOT NULL,
      size       INTEGER NOT NULL,
      mime_type  TEXT,
      local_path TEXT    NOT NULL,
      created_at TEXT    NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_attachments_ticket ON attachments(ticket_id);

    CREATE TABLE IF NOT EXISTS timeline (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id  TEXT    NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      type       TEXT    NOT NULL,
      text       TEXT    NOT NULL,
      created_at TEXT    NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_timeline_ticket ON timeline(ticket_id);

    CREATE TABLE IF NOT EXISTS tasks (
      id              TEXT    PRIMARY KEY,
      company_id      INTEGER NOT NULL REFERENCES companies(id),
      name            TEXT    NOT NULL,
      task_type       TEXT    NOT NULL DEFAULT 'rec',
      schedule_type   TEXT,
      schedule_days   TEXT,
      period_number   INTEGER DEFAULT 1,
      time_from       TEXT    DEFAULT '08:00',
      time_to         TEXT    DEFAULT '18:00',
      is_done         INTEGER NOT NULL DEFAULT 0,
      last_done_at    TEXT,
      last_reset_date TEXT,
      created_at      TEXT    NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_company ON tasks(company_id);

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Seed empresa padrão
  const co = db.getFirstSync<{ id: number }>('SELECT id FROM companies LIMIT 1');
  if (!co) {
    db.runSync('INSERT INTO companies (name, created_at) VALUES (?, ?)', ['Geral', nowStr()]);
  }

  // Seed categorias padrão
  const cat = db.getFirstSync<{ id: number }>('SELECT id FROM categories LIMIT 1');
  if (!cat) {
    const defaults = ['Hardware', 'Software', 'Rede', 'Impressora', 'Email', 'Acesso/Permissao', 'Outro'];
    for (const name of defaults) {
      db.runSync('INSERT INTO categories (name) VALUES (?)', [name]);
    }
  }
}

// ─── TYPES ───────────────────────────────────────────────────────────────────
export interface Company   { id: number; name: string; created_at: string; }
export interface Category  { id: number; name: string; }
export interface Technician{ id: number; name: string; created_at: string; }

export interface Ticket {
  id: string; company_id: number; title: string; requester: string;
  assignee: string | null; category: string; priority: string; status: string;
  description: string | null; due_date: string | null;
  created_at: string; updated_at: string;
  // joined
  company_name?: string;
}

export interface Attachment {
  id: number; ticket_id: string; name: string; size: number;
  mime_type: string | null; local_path: string; created_at: string;
}

export interface TimelineEntry {
  id: number; ticket_id: string; type: string; text: string; created_at: string;
}

export interface Task {
  id: string; company_id: number; name: string; task_type: string;
  schedule_type: string | null; schedule_days: string | null;
  period_number: number | null; time_from: string | null; time_to: string | null;
  is_done: number; last_done_at: string | null; last_reset_date: string | null;
  created_at: string;
  company_name?: string;
}

// ─── COMPANIES ───────────────────────────────────────────────────────────────
export const companyRepo = {
  getAll: (): Company[] =>
    db.getAllSync<Company>('SELECT * FROM companies ORDER BY name'),

  getById: (id: number): Company | null =>
    db.getFirstSync<Company>('SELECT * FROM companies WHERE id = ?', [id]) ?? null,

  create: (name: string): number => {
    db.runSync('INSERT INTO companies (name, created_at) VALUES (?, ?)', [name, nowStr()]);
    return (db.getFirstSync<{ id: number }>('SELECT last_insert_rowid() as id')!).id;
  },

  delete: (id: number): void => {
    db.runSync('DELETE FROM companies WHERE id = ?', [id]);
  },

  clearData: (id: number): void => {
    db.runSync('DELETE FROM tickets WHERE company_id = ?', [id]);
    db.runSync('DELETE FROM tasks   WHERE company_id = ?', [id]);
  },

  getTicketCount: (id: number): number =>
    (db.getFirstSync<{ n: number }>('SELECT COUNT(*) as n FROM tickets WHERE company_id = ?', [id])?.n ?? 0),

  getTaskCount: (id: number): number =>
    (db.getFirstSync<{ n: number }>('SELECT COUNT(*) as n FROM tasks WHERE company_id = ?', [id])?.n ?? 0),
};

// ─── CATEGORIES ──────────────────────────────────────────────────────────────
export const categoryRepo = {
  getAll: (): Category[] =>
    db.getAllSync<Category>('SELECT * FROM categories ORDER BY name'),

  create: (name: string): void =>
    db.runSync('INSERT INTO categories (name) VALUES (?)', [name]),

  delete: (id: number): void =>
    db.runSync('DELETE FROM categories WHERE id = ?', [id]),
};

// ─── TECHNICIANS ─────────────────────────────────────────────────────────────
export const technicianRepo = {
  getAll: (): Technician[] =>
    db.getAllSync<Technician>('SELECT * FROM technicians ORDER BY name'),

  create: (name: string): void =>
    db.runSync('INSERT INTO technicians (name, created_at) VALUES (?, ?)', [name, nowStr()]),

  delete: (id: number): void =>
    db.runSync('DELETE FROM technicians WHERE id = ?', [id]),
};

// ─── TICKETS ─────────────────────────────────────────────────────────────────
const PAGE_SIZE = 30;

export const ticketRepo = {
  getPage: (companyId: number, page: number, filter: string, search: string): Ticket[] => {
    const offset = page * PAGE_SIZE;
    let where = 'WHERE t.company_id = ?';
    const params: (string | number)[] = [companyId];

    if (filter !== 'all') {
      where += ' AND t.status = ?';
      params.push(filter);
    }
    if (search.trim()) {
      where += ' AND (t.title LIKE ? OR t.requester LIKE ? OR t.description LIKE ?)';
      const s = `%${search.trim()}%`;
      params.push(s, s, s);
    }
    params.push(PAGE_SIZE, offset);
    return db.getAllSync<Ticket>(
      `SELECT t.*, c.name as company_name
       FROM tickets t JOIN companies c ON t.company_id = c.id
       ${where}
       ORDER BY t.created_at DESC
       LIMIT ? OFFSET ?`,
      params
    );
  },

  getAllCompanies: (page: number, filter: string, search: string): Ticket[] => {
    const offset = page * PAGE_SIZE;
    let where = 'WHERE 1=1';
    const params: (string | number)[] = [];

    if (filter !== 'all') {
      where += ' AND t.status = ?';
      params.push(filter);
    }
    if (search.trim()) {
      where += ' AND (t.title LIKE ? OR t.requester LIKE ? OR t.description LIKE ?)';
      const s = `%${search.trim()}%`;
      params.push(s, s, s);
    }
    params.push(PAGE_SIZE, offset);
    return db.getAllSync<Ticket>(
      `SELECT t.*, c.name as company_name
       FROM tickets t JOIN companies c ON t.company_id = c.id
       ${where}
       ORDER BY t.created_at DESC
       LIMIT ? OFFSET ?`,
      params
    );
  },

  getById: (id: string): Ticket | null =>
    db.getFirstSync<Ticket>(
      `SELECT t.*, c.name as company_name
       FROM tickets t JOIN companies c ON t.company_id = c.id
       WHERE t.id = ?`,
      [id]
    ) ?? null,

  create: (data: {
    companyId: number; title: string; requester: string; assignee?: string;
    category: string; priority: string; description?: string; dueDate?: string;
  }): string => {
    const id = `tk_${Date.now()}`;
    const now = nowStr();
    db.runSync(
      `INSERT INTO tickets (id, company_id, title, requester, assignee, category, priority, status, description, due_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'aberto', ?, ?, ?, ?)`,
      [id, data.companyId, data.title, data.requester, data.assignee ?? null,
       data.category, data.priority, data.description ?? null, data.dueDate ?? null, now, now]
    );
    db.runSync(
      `INSERT INTO timeline (ticket_id, type, text, created_at) VALUES (?, 'open', ?, ?)`,
      [id, `Chamado criado.\n${data.description || 'Sem descricao.'}`, now]
    );
    return id;
  },

  update: (id: string, data: Partial<Omit<Ticket, 'id' | 'company_id' | 'created_at'>>): void => {
    const now = nowStr();
    const fields: string[] = [];
    const vals: (string | number | null)[] = [];

    if (data.title       !== undefined) { fields.push('title = ?');       vals.push(data.title); }
    if (data.requester   !== undefined) { fields.push('requester = ?');   vals.push(data.requester); }
    if (data.assignee    !== undefined) { fields.push('assignee = ?');    vals.push(data.assignee); }
    if (data.category    !== undefined) { fields.push('category = ?');    vals.push(data.category); }
    if (data.priority    !== undefined) { fields.push('priority = ?');    vals.push(data.priority); }
    if (data.status      !== undefined) { fields.push('status = ?');      vals.push(data.status); }
    if (data.description !== undefined) { fields.push('description = ?'); vals.push(data.description); }
    if (data.due_date    !== undefined) { fields.push('due_date = ?');    vals.push(data.due_date); }

    fields.push('updated_at = ?');
    vals.push(now);
    vals.push(id);

    db.runSync(`UPDATE tickets SET ${fields.join(', ')} WHERE id = ?`, vals);
  },

  delete: (id: string): void => {
    db.runSync('DELETE FROM tickets WHERE id = ?', [id]);
  },

  countOpen: (companyId: number | null): number => {
    if (companyId === null) {
      return db.getFirstSync<{ n: number }>(
        `SELECT COUNT(*) as n FROM tickets WHERE status != 'fechado'`
      )?.n ?? 0;
    }
    return db.getFirstSync<{ n: number }>(
      `SELECT COUNT(*) as n FROM tickets WHERE company_id = ? AND status != 'fechado'`,
      [companyId]
    )?.n ?? 0;
  },
};

// ─── TIMELINE ────────────────────────────────────────────────────────────────
export const timelineRepo = {
  getByTicket: (ticketId: string): TimelineEntry[] =>
    db.getAllSync<TimelineEntry>(
      'SELECT * FROM timeline WHERE ticket_id = ? ORDER BY created_at DESC',
      [ticketId]
    ),

  add: (ticketId: string, type: string, text: string): void => {
    db.runSync(
      'INSERT INTO timeline (ticket_id, type, text, created_at) VALUES (?, ?, ?, ?)',
      [ticketId, type, text, nowStr()]
    );
    db.runSync('UPDATE tickets SET updated_at = ? WHERE id = ?', [nowStr(), ticketId]);
  },
};

// ─── ATTACHMENTS ─────────────────────────────────────────────────────────────
export const attachmentRepo = {
  getByTicket: (ticketId: string): Attachment[] =>
    db.getAllSync<Attachment>(
      'SELECT * FROM attachments WHERE ticket_id = ? ORDER BY created_at',
      [ticketId]
    ),

  add: (data: { ticketId: string; name: string; size: number; mimeType?: string; localPath: string }): void => {
    db.runSync(
      'INSERT INTO attachments (ticket_id, name, size, mime_type, local_path, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [data.ticketId, data.name, data.size, data.mimeType ?? null, data.localPath, nowStr()]
    );
  },

  delete: (id: number): void => {
    db.runSync('DELETE FROM attachments WHERE id = ?', [id]);
  },
};

// ─── TASKS ───────────────────────────────────────────────────────────────────
export const taskRepo = {
  getByCompany: (companyId: number): Task[] =>
    db.getAllSync<Task>(
      `SELECT t.*, c.name as company_name
       FROM tasks t JOIN companies c ON t.company_id = c.id
       WHERE t.company_id = ?
       ORDER BY t.created_at`,
      [companyId]
    ),

  getAll: (): Task[] =>
    db.getAllSync<Task>(
      `SELECT t.*, c.name as company_name
       FROM tasks t JOIN companies c ON t.company_id = c.id
       ORDER BY t.created_at`
    ),

  create: (data: {
    companyId: number; name: string; taskType: string; scheduleType?: string;
    scheduleDays?: number[]; periodNumber?: number; timeFrom?: string; timeTo?: string;
  }): string => {
    const id = `ts_${Date.now()}`;
    db.runSync(
      `INSERT INTO tasks (id, company_id, name, task_type, schedule_type, schedule_days, period_number, time_from, time_to, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, data.companyId, data.name, data.taskType,
        data.scheduleType ?? null,
        data.scheduleDays ? JSON.stringify(data.scheduleDays) : null,
        data.periodNumber ?? null,
        data.timeFrom ?? '08:00',
        data.timeTo   ?? '18:00',
        nowStr(),
      ]
    );
    return id;
  },

  markDone: (id: string): void => {
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    db.runSync(
      'UPDATE tasks SET is_done = 1, last_done_at = ?, last_reset_date = ? WHERE id = ?',
      [nowStr(), dateStr, id]
    );
  },

  markUndone: (id: string): void => {
    db.runSync(
      'UPDATE tasks SET is_done = 0, last_done_at = NULL WHERE id = ?',
      [id]
    );
  },

  // Chamado ao entrar na aba Checklist: reseta tarefas recorrentes quando a data mudou
  resetRecurring: (): void => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    db.runSync(
      `UPDATE tasks
       SET is_done = 0
       WHERE task_type = 'rec'
         AND is_done = 1
         AND (last_reset_date IS NULL OR last_reset_date != ?)`,
      [todayStr]
    );
  },

  delete: (id: string): void => {
    db.runSync('DELETE FROM tasks WHERE id = ?', [id]);
  },
};

// ─── SETTINGS ────────────────────────────────────────────────────────────────
export const settingsRepo = {
  get: (key: string): string | null =>
    db.getFirstSync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key])?.value ?? null,

  set: (key: string, value: string): void => {
    db.runSync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  },
};

// ─── STATS ───────────────────────────────────────────────────────────────────
export const statsRepo = {
  getSummary: (companyId: number | null) => {
    const where = companyId !== null ? 'WHERE company_id = ?' : '';
    const params = companyId !== null ? [companyId] : [];

    const total    = db.getFirstSync<{ n: number }>(`SELECT COUNT(*) as n FROM tickets ${where}`, params)?.n ?? 0;
    const aberto   = db.getFirstSync<{ n: number }>(`SELECT COUNT(*) as n FROM tickets ${where ? where + ' AND' : 'WHERE'} status = 'aberto'`,   [...params, ...(where ? [] : [])])?.n ?? 0;
    const andamento= db.getFirstSync<{ n: number }>(`SELECT COUNT(*) as n FROM tickets ${where ? where + ' AND' : 'WHERE'} status = 'andamento'`,[...params])?.n ?? 0;
    const aguardando=db.getFirstSync<{ n: number }>(`SELECT COUNT(*) as n FROM tickets ${where ? where + ' AND' : 'WHERE'} status = 'aguardando'`,[...params])?.n ?? 0;
    const fechado  = db.getFirstSync<{ n: number }>(`SELECT COUNT(*) as n FROM tickets ${where ? where + ' AND' : 'WHERE'} status = 'fechado'`,  [...params])?.n ?? 0;

    // NOTA: construa as queries de stats com WHERE dinâmico correto para cada status
    // A abordagem mais segura é usar queries separadas com os params corretos por status

    const byCat = db.getAllSync<{ category: string; n: number }>(
      `SELECT category, COUNT(*) as n FROM tickets ${where} GROUP BY category ORDER BY n DESC`,
      params
    );
    const byPri = db.getAllSync<{ priority: string; n: number }>(
      `SELECT priority, COUNT(*) as n FROM tickets ${where} GROUP BY priority ORDER BY n DESC`,
      params
    );

    return { total, aberto, andamento, aguardando, fechado, byCat, byPri };
  },

  getTaskSummary: (companyId: number | null) => {
    const where = companyId !== null ? 'WHERE company_id = ?' : '';
    const params = companyId !== null ? [companyId] : [];
    const total = db.getFirstSync<{ n: number }>(`SELECT COUNT(*) as n FROM tasks ${where}`, params)?.n ?? 0;
    const done  = db.getFirstSync<{ n: number }>(`SELECT COUNT(*) as n FROM tasks ${where ? where + ' AND' : 'WHERE'} is_done = 1`, [...params])?.n ?? 0;
    return { total, done };
  },
};
```

---

## 6. CONSTANTES DE DESIGN

**`src/constants/theme.ts`** — usar exatamente estes valores:

```typescript
export const Colors = {
  bg:           '#0d1117',
  surface:      '#161b22',
  surfaceAlt:   '#21262d',
  header:       '#0f3460',
  border:       '#21262d',

  textPrimary:  '#e6edf3',
  textSecondary:'#c9d1d9',
  textMuted:    '#8b949e',
  textDim:      '#484f58',

  blue:         '#58a6ff',
  green:        '#3fb950',
  red:          '#e94560',
  yellow:       '#d29922',
  orange:       '#f0883e',
  purple:       '#a371f7',
  white:        '#ffffff',
};

export const priColor = (p: string): string => ({
  urgente: Colors.red,
  alta:    Colors.orange,
  media:   Colors.yellow,
  baixa:   Colors.textMuted,
}[p] ?? Colors.textMuted);

export const statusColor = (s: string): string => ({
  aberto:    Colors.green,
  andamento: Colors.yellow,
  aguardando:Colors.purple,
  fechado:   Colors.textMuted,
}[s] ?? Colors.textMuted);

export const statusLabel = (s: string): string => ({
  aberto:    'Aberto',
  andamento: 'Em andamento',
  aguardando:'Aguardando',
  fechado:   'Fechado',
}[s] ?? s);

export const Spacing  = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 };
export const FontSize = { xs: 11, sm: 12, md: 13, base: 14, lg: 16, xl: 18 };
export const Radius   = { sm: 6, md: 8, lg: 10, xl: 12, full: 999 };
```

---

## 7. ESTADO GLOBAL

**`src/stores/appStore.ts`**

```typescript
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

interface Toast {
  message: string;
  isError: boolean;
  undoKey?: string;       // se presente, exibe botão "Desfazer"
  onUndo?: () => void;
}

interface AppStore {
  // Empresa atual
  currentCompanyId: number;
  currentCompanyName: string;
  viewAllCompanies: boolean;   // modo "Ver todas as empresas"
  setCurrentCompany: (id: number, name: string) => void;
  setViewAllCompanies: (v: boolean) => void;

  // Toast
  toast: Toast | null;
  showToast: (msg: string, opts?: { isError?: boolean; onUndo?: () => void }) => void;
  hideToast: () => void;

  // Busca
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  // Modal aberto globalmente
  openModal: string | null;
  setOpenModal: (name: string | null) => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  currentCompanyId:   1,
  currentCompanyName: 'Geral',
  viewAllCompanies:   false,

  setCurrentCompany: async (id, name) => {
    set({ currentCompanyId: id, currentCompanyName: name });
    await SecureStore.setItemAsync('current_company_id',   String(id));
    await SecureStore.setItemAsync('current_company_name', name);
  },

  setViewAllCompanies: (v) => set({ viewAllCompanies: v }),

  toast: null,
  showToast: (message, opts = {}) => {
    set({ toast: { message, isError: opts.isError ?? false, onUndo: opts.onUndo } });
    const timeout = opts.onUndo ? 3500 : 2500;
    setTimeout(() => {
      if (get().toast?.message === message) set({ toast: null });
    }, timeout);
  },
  hideToast: () => set({ toast: null }),

  searchQuery: '',
  setSearchQuery: (q) => set({ searchQuery: q }),

  openModal: null,
  setOpenModal: (name) => set({ openModal: name }),
}));

// Carregar empresa salva na inicialização
export async function loadSavedCompany(): Promise<{ id: number; name: string } | null> {
  try {
    const id   = await SecureStore.getItemAsync('current_company_id');
    const name = await SecureStore.getItemAsync('current_company_name');
    if (id && name) return { id: parseInt(id), name };
  } catch {}
  return null;
}
```

---

## 8. UTILITÁRIOS

### `src/utils/dateUtils.ts`
```typescript
export function nowStr(): string {
  const d = new Date();
  return [
    String(d.getDate()).padStart(2,'0'),
    String(d.getMonth()+1).padStart(2,'0'),
    d.getFullYear(),
  ].join('/') + ' ' +
  String(d.getHours()).padStart(2,'0') + ':' +
  String(d.getMinutes()).padStart(2,'0');
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export function fmtSize(bytes: number): string {
  if (bytes >= 1048576) return `${(bytes/1048576).toFixed(1)}MB`;
  return `${(bytes/1024).toFixed(1)}KB`;
}
```

### `src/utils/fileUtils.ts`
```typescript
import * as FileSystem from 'expo-file-system';

const DIR = FileSystem.documentDirectory + 'attachments/';

export async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
}

export async function saveFile(uri: string, name: string): Promise<string> {
  await ensureDir();
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const dest = DIR + `${Date.now()}_${safe}`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
}

export async function deleteFile(path: string): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) await FileSystem.deleteAsync(path, { idempotent: true });
  } catch {}
}

export async function readBase64(path: string): Promise<string> {
  return FileSystem.readAsStringAsync(path, { encoding: FileSystem.EncodingType.Base64 });
}

export function isImage(name: string, mimeType?: string | null): boolean {
  if (mimeType?.startsWith('image/')) return true;
  return /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(name);
}
```

### `src/utils/scheduleUtils.ts`

> ⚠️ LÓGICA CRÍTICA — implementar exatamente como descrito.

A função `isTaskAvailableNow` determina se a tarefa deve aparecer como disponível. Usa `lastDoneAt` para verificar se já foi concluída no período corrente.

```typescript
// Compara datas no formato ISO "YYYY-MM-DD"
function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function todayDate(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isBusinessDay(d: Date): boolean {
  return d.getDay() !== 0 && d.getDay() !== 6;
}

function nearestPrevBusinessDay(d: Date): Date {
  const r = new Date(d);
  while (!isBusinessDay(r)) r.setDate(r.getDate() - 1);
  return r;
}

function bomThisMonth(): Date {
  const d = new Date();
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  return nearestPrevBusinessDay(first);
}

function eomThisMonth(): Date {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return nearestPrevBusinessDay(last);
}

export interface TaskSchedule {
  task_type:     string;
  schedule_type: string | null;
  schedule_days: string | null;
  period_number: number | null;
  time_from:     string | null;
  time_to:       string | null;
  last_done_at:  string | null; // formato "DD/MM/YYYY HH:MM" — parseado do nowStr()
}

function parseLastDoneDate(lastDoneAt: string | null): Date | null {
  if (!lastDoneAt) return null;
  // formato "DD/MM/YYYY HH:MM"
  const parts = lastDoneAt.split(' ')[0].split('/');
  if (parts.length !== 3) return null;
  return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
}

export function isTaskAvailableNow(task: TaskSchedule): boolean {
  if (task.task_type === 'one') return true; // única: sempre visível até ser concluída

  const now   = new Date();
  const today = todayDate();

  // Verificar janela de horário
  const tf = task.time_from ?? '00:00';
  const tt = task.time_to   ?? '23:59';
  const cur = now.getHours() * 60 + now.getMinutes();
  const [fh, fm] = tf.split(':').map(Number);
  const [th, tm] = tt.split(':').map(Number);
  if (cur < fh * 60 + fm || cur > th * 60 + tm) return false;

  const lastDone = parseLastDoneDate(task.last_done_at);

  switch (task.schedule_type) {
    case 'daily':
      // Disponível se ainda não foi feita hoje
      if (!lastDone) return true;
      return lastDone.getTime() < today.getTime();

    case 'weekly': {
      const days: number[] = task.schedule_days ? JSON.parse(task.schedule_days) : [];
      if (!days.includes(now.getDay())) return false;
      if (!lastDone) return true;
      return lastDone.getTime() < today.getTime();
    }

    case 'monthly':
      if (!lastDone) return true;
      return lastDone.getMonth() !== today.getMonth() ||
             lastDone.getFullYear() !== today.getFullYear();

    case 'xmonths': {
      const n = task.period_number ?? 2;
      if (!lastDone) return true;
      const diffMonths =
        (today.getFullYear() - lastDone.getFullYear()) * 12 +
        (today.getMonth()    - lastDone.getMonth());
      return diffMonths >= n;
    }

    case 'yearly':
      if (!lastDone) return true;
      return lastDone.getFullYear() !== today.getFullYear();

    case 'xyears': {
      const n = task.period_number ?? 2;
      if (!lastDone) return true;
      return today.getFullYear() - lastDone.getFullYear() >= n;
    }

    case 'bom': {
      const bom = bomThisMonth();
      return today.getTime() === bom.getTime() &&
             (!lastDone || lastDone.getTime() < today.getTime());
    }

    case 'eom': {
      const eom = eomThisMonth();
      return today.getTime() === eom.getTime() &&
             (!lastDone || lastDone.getTime() < today.getTime());
    }

    default:
      return true;
  }
}

export function nextAvailLabel(task: TaskSchedule): string {
  if (task.task_type === 'one') return '';
  const tf = task.time_from ?? '08:00';
  const dayNames = ['Dom','Seg','Ter','Qua','Qui','Sex','Sab'];
  const now = new Date();

  switch (task.schedule_type) {
    case 'daily':    return `Amanha as ${tf}`;
    case 'weekly': {
      const days: number[] = task.schedule_days ? JSON.parse(task.schedule_days) : [];
      const sorted = [...days].sort();
      const today  = now.getDay();
      const next   = sorted.find(d => d > today) ?? sorted[0];
      return `Proximo ${dayNames[next]} as ${tf}`;
    }
    case 'monthly': {
      const nm = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return `${String(nm.getDate()).padStart(2,'0')}/${String(nm.getMonth()+1).padStart(2,'0')}/${nm.getFullYear()} as ${tf}`;
    }
    case 'xmonths': {
      const n  = task.period_number ?? 2;
      const nm = new Date(now.getFullYear(), now.getMonth() + n, 1);
      return `${String(nm.getMonth()+1).padStart(2,'0')}/${nm.getFullYear()} as ${tf}`;
    }
    case 'yearly':   return `${now.getFullYear() + 1} as ${tf}`;
    case 'xyears': {
      const n = task.period_number ?? 2;
      return `${now.getFullYear() + n} as ${tf}`;
    }
    case 'bom': {
      const bom = bomThisMonth();
      const nm  = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const next= nearestPrevBusinessDay(nm);
      return `${String(next.getDate()).padStart(2,'0')}/${String(next.getMonth()+1).padStart(2,'0')} as ${tf}`;
    }
    case 'eom': {
      const nm   = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      const next = nearestPrevBusinessDay(nm);
      return `${String(next.getDate()).padStart(2,'0')}/${String(next.getMonth()+1).padStart(2,'0')} as ${tf}`;
    }
    default: return '';
  }
}

export function scheduleLabel(task: TaskSchedule): string {
  if (task.task_type === 'one') return 'Tarefa unica';
  const tf  = task.time_from ?? '08:00';
  const tt  = task.time_to   ?? '18:00';
  const dn  = ['Dom','Seg','Ter','Qua','Qui','Sex','Sab'];

  switch (task.schedule_type) {
    case 'daily':    return `Diario ${tf}-${tt}`;
    case 'weekly': {
      const days: number[] = task.schedule_days ? JSON.parse(task.schedule_days) : [];
      return `${days.map(d => dn[d]).join(', ')} ${tf}-${tt}`;
    }
    case 'monthly':  return `Mensal ${tf}-${tt}`;
    case 'xmonths':  return `A cada ${task.period_number ?? 2} meses`;
    case 'yearly':   return `Anual ${tf}-${tt}`;
    case 'xyears':   return `A cada ${task.period_number ?? 2} anos`;
    case 'bom':      return `Inicio do mes (dia util) ${tf}-${tt}`;
    case 'eom':      return `Fim do mes (dia util) ${tf}-${tt}`;
    default:         return '';
  }
}
```

---

## 9. HOOKS

### `src/hooks/useMediaPermissions.ts`
```typescript
import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking } from 'react-native';

export function useMediaPermissions() {
  const requestCamera = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permissao necessaria',
        'Acesse Configuracoes do dispositivo e habilite a camera para este app.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Abrir Configuracoes', onPress: () => Linking.openSettings() },
        ]
      );
      return false;
    }
    return true;
  };

  const requestGallery = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permissao necessaria',
        'Acesse Configuracoes do dispositivo e habilite o acesso a fotos para este app.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Abrir Configuracoes', onPress: () => Linking.openSettings() },
        ]
      );
      return false;
    }
    return true;
  };

  return { requestCamera, requestGallery };
}
```

### `src/hooks/useNotifications.ts`
```typescript
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Task } from '../db';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// Agendar notificação diária para uma tarefa
export async function scheduleTaskNotification(task: Task): Promise<void> {
  if (task.task_type !== 'rec' || !task.time_from) return;

  // Cancelar notificação anterior se existir
  await cancelTaskNotification(task.id);

  const [h, m] = (task.time_from ?? '08:00').split(':').map(Number);

  await Notifications.scheduleNotificationAsync({
    identifier: `task_${task.id}`,
    content: {
      title: 'Helpdesk TI — Checklist',
      body:  `Tarefa disponivel: ${task.name}`,
      data:  { taskId: task.id },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: h,
      minute: m,
    },
  });
}

export async function cancelTaskNotification(taskId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(`task_${taskId}`);
  } catch {}
}

// Atualizar badge com contagem de chamados abertos
export async function updateBadge(count: number): Promise<void> {
  if (Platform.OS === 'ios') {
    await Notifications.setBadgeCountAsync(count);
  }
}
```

### `src/hooks/usePagination.ts`
```typescript
import { useState, useCallback } from 'react';

export function usePagination<T>(
  fetcher: (page: number) => T[],
  deps: any[] = []
) {
  const [items, setItems]     = useState<T[]>([]);
  const [page, setPage]       = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  const load = useCallback((reset = false) => {
    const p = reset ? 0 : page;
    const newItems = fetcher(p);
    if (reset) {
      setItems(newItems);
      setPage(1);
    } else {
      setItems(prev => [...prev, ...newItems]);
      setPage(p + 1);
    }
    setHasMore(newItems.length === 30);
    setLoading(false);
  }, [page, ...deps]);

  const refresh = useCallback(() => load(true), [...deps]);
  const loadMore = useCallback(() => {
    if (!hasMore || loading) return;
    setLoading(true);
    load(false);
  }, [hasMore, loading, load]);

  return { items, refresh, loadMore, hasMore, loading };
}
```

---

## 10. COMPONENTES

### `src/components/SwipeableRow.tsx`
Wrapper de swipe usando Reanimated + GestureHandler. Aceita ações de swipe esquerdo (vermelho, excluir) e/ou direito (azul, editar).

```typescript
import React, { useRef } from 'react';
import { Animated, TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Colors, Radius } from '../constants/theme';

interface Props {
  children: React.ReactNode;
  onDelete?: () => void;
  onEdit?: () => void;
}

export default function SwipeableRow({ children, onDelete, onEdit }: Props) {
  const ref = useRef<Swipeable>(null);

  const renderRight = onDelete
    ? () => (
        <TouchableOpacity
          style={styles.actionRight}
          onPress={() => { ref.current?.close(); onDelete(); }}
        >
          <Text style={styles.actionText}>Excluir</Text>
        </TouchableOpacity>
      )
    : undefined;

  const renderLeft = onEdit
    ? () => (
        <TouchableOpacity
          style={styles.actionLeft}
          onPress={() => { ref.current?.close(); onEdit(); }}
        >
          <Text style={styles.actionText}>Editar</Text>
        </TouchableOpacity>
      )
    : undefined;

  return (
    <Swipeable
      ref={ref}
      renderRightActions={renderRight}
      renderLeftActions={renderLeft}
      overshootRight={false}
      overshootLeft={false}
    >
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  actionRight: {
    backgroundColor: '#da3633',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: Radius.md,
    marginBottom: 10,
    marginLeft: 4,
  },
  actionLeft: {
    backgroundColor: Colors.header,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: Radius.md,
    marginBottom: 10,
    marginRight: 4,
  },
  actionText: {
    color: Colors.white,
    fontWeight: '600',
    fontSize: 13,
  },
});
```

### `src/components/UndoToast.tsx`
Toast com botão "Desfazer" que aparece por 3.5 segundos após marcar tarefa como concluída.

```typescript
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/theme';
import { useAppStore } from '../stores/appStore';

export default function Toast() {
  const { toast, hideToast } = useAppStore();
  const insets = useSafeAreaInsets();

  if (!toast) return null;

  return (
    <View style={[styles.container, { top: insets.top + 12 }]}>
      <Text style={styles.msg} numberOfLines={2}>{toast.message}</Text>
      {toast.onUndo && (
        <TouchableOpacity onPress={() => { toast.onUndo?.(); hideToast(); }}>
          <Text style={styles.undo}>DESFAZER</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16, right: 16,
    zIndex: 9999,
    backgroundColor: '#23863d',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  msg:  { flex: 1, color: Colors.white, fontSize: 14 },
  undo: { color: Colors.white, fontWeight: '700', fontSize: 13, marginLeft: 12 },
});
```

### `src/components/SearchBar.tsx`
```typescript
import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Radius } from '../constants/theme';

interface Props {
  value: string;
  onChangeText: (t: string) => void;
  onClear: () => void;
  placeholder?: string;
}

export default function SearchBar({ value, onChangeText, onClear, placeholder = 'Buscar chamados...' }: Props) {
  return (
    <View style={styles.container}>
      <MaterialCommunityIcons name="magnify" size={18} color={Colors.textMuted} style={styles.icon} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={onClear}>
          <MaterialCommunityIcons name="close-circle" size={18} color={Colors.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  icon:  { marginRight: 6 },
  input: { flex: 1, color: Colors.textPrimary, fontSize: 14 },
});
```

---

## 11. FUNCIONALIDADES DETALHADAS

### 11.1 ROOT LAYOUT (`app/_layout.tsx`)

```typescript
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { initDatabase } from '../src/db';
import { loadSavedCompany, useAppStore } from '../src/stores/appStore';
import { requestNotificationPermission } from '../src/hooks/useNotifications';
import Toast from '../src/components/UndoToast';

export default function RootLayout() {
  const setCurrentCompany = useAppStore(s => s.setCurrentCompany);

  useEffect(() => {
    // 1. Inicializar banco
    initDatabase();

    // 2. Restaurar empresa selecionada
    loadSavedCompany().then(saved => {
      if (saved) setCurrentCompany(saved.id, saved.name);
    });

    // 3. Solicitar permissão de notificação (não bloqueia)
    requestNotificationPermission();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor="#0f3460" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0d1117' } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="ticket/[id]"
            options={{ presentation: 'card', animation: 'slide_from_right' }}
          />
        </Stack>
        <Toast />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

### 11.2 ABA CHAMADOS (`app/(tabs)/index.tsx`)

**Header:**
- Dropdown de empresas (todas as empresas do banco)
- Toggle "Ver todas" (ícone de grid) → ativa `viewAllCompanies = true`, exibe chamados de todas
- Botão "+" → `CompanyModal`
- Badge vermelho com contagem de chamados abertos (recalcular ao focar a aba)

**Busca:**
- Botão de lupa no header expande `SearchBar` inline (animação de altura via Reanimated)
- Ao digitar, esperar 300ms (debounce) antes de refetch

**Lista (`FlashList`):**
- `estimatedItemSize={100}`
- `onEndReached={loadMore}` quando `hasMore`
- `onRefresh={refresh}` + `refreshing={loading}`
- Cada item envolto em `SwipeableRow` com `onDelete` e `onEdit`

**TicketCard — elementos obrigatórios:**
- Miniatura de imagem (40x40, rounded) se o chamado tiver ao menos um anexo de imagem — carregar caminho do primeiro attachment via `attachmentRepo.getByTicket()` apenas para o campo `mime_type` e `local_path`
- Borda lateral esquerda colorida pela prioridade (4px, `borderLeftColor: priColor(ticket.priority)`)
- Badge de prazo vencido: se `due_date` existe e já passou, mostrar badge vermelho "VENCIDO"
- Long press → bottom sheet com: Editar, Copiar resumo, Excluir

**FAB:** Visível apenas nas abas Chamados e Checklist. Oculto em Relatório e Config.

### 11.3 TELA DE DETALHE (`app/ticket/[id].tsx`)

**Header:** Botão voltar, título (truncado), botão copiar, botão editar (lápis), botão excluir (lixeira)

**Seção de status (botões de transição):**
```
aberto     → [Iniciar ▶]  [Aguardar ⏸]  [Fechar ✕]
andamento  → [Aguardar ⏸] [Fechar ✕]
aguardando → [Retomar ▶]  [Fechar ✕]
fechado    → [Reabrir ↺]
```
Cada botão abre `TransitionModal` com comentário obrigatório, exceto "Reabrir" que usa `ConfirmDialog`.

**Campo Responsável:** Exibir "Atribuído a: [nome]" com ícone de pessoa. Na tela de detalhe, campo editável inline (toque para editar, picker com lista de técnicos ou campo livre).

**Campo Prazo:** Se `due_date` preenchido, exibir com cor vermelha se vencido.

**Seção Anexos:**
- Imagens: miniatura 60x60 → toque abre visualizador fullscreen
- Outros arquivos: ícone genérico + nome + tamanho → toque abre com `expo-sharing`
- Botão "Adicionar anexo" na seção (câmera / galeria / arquivo)

**Timeline:** Ordenada do mais recente para o mais antigo. Ícone e cor do ponto varia por tipo:
- `open`: ponto cinza, sem ícone especial
- `status`: ponto azul, ícone 🔔
- `chat`: ponto roxo, ícone 💬
- `attach`: ponto verde, ícone 📎
- `reopen`: ponto amarelo, ícone 🔄
- `close`: ponto cinza, ícone ⚫

**Input de acompanhamento:** Fixo no bottom. `onSubmitEditing` envia. Botão câmera ao lado para anexar foto diretamente na timeline (salva como anexo + evento 'attach').

**Histórico de edições:** Toda vez que título, descrição, categoria ou prioridade forem alterados via edição, inserir evento na timeline: `type: 'edit'`, `text: 'Titulo alterado de "X" para "Y"'`.

### 11.4 MODAL DE CHAMADO (`src/modals/TicketModal.tsx`)

Campos em ordem:
1. Input: Título (obrigatório)
2. Input: Solicitante (obrigatório)
3. Picker: Atribuído a (lista de técnicos + opção "Nao atribuido")
4. Picker: Categoria
5. Picker: Prioridade
6. Date picker: Prazo (opcional — botão "+ Prazo" que expande)
7. Textarea: Descrição
8. Seção Anexos: botões Câmera / Galeria / Arquivo + preview

**Picker nativo:** Usar componente `Picker` customizado com `TouchableOpacity` que abre um `BottomSheet` com lista de opções. Não usar `@react-native-picker/picker` nativo (inconsistente entre plataformas).

**Validação:** Título e Solicitante obrigatórios. Mostrar borda vermelha + toast de erro se vazios.

**Salvamento de anexos:** Para cada arquivo pendente, chamar `fileUtils.saveFile()` para salvar no filesystem, depois `attachmentRepo.add()`. Se for modo edição, manter anexos existentes e adicionar novos.

**Registro de edição na timeline:** No modo edição, detectar campos alterados e inserir evento `type: 'edit'` para cada mudança.

### 11.5 ABA CHECKLIST (`app/(tabs)/checklist.tsx`)

**Ao montar a aba:**
1. Chamar `taskRepo.resetRecurring()` — reseta tarefas recorrentes de dias anteriores
2. Carregar tarefas da empresa atual
3. Filtrar com `isTaskAvailableNow()` para separar disponíveis das não disponíveis

**Seções da lista:**
- Seção "Disponíveis agora" — tarefas que `isTaskAvailableNow` retorna true
- Seção "Concluídas" — tarefas com `is_done = 1`
- Seção "Fora do horário / período" — tarefas recorrentes que não estão no horário/período

**TaskCard — elementos:**
- Checkbox: toque direto SEM confirm dialog — marcar como feita imediatamente
- Após marcar: `expo-haptics.impactAsync(ImpactFeedbackStyle.Light)` + exibir `UndoToast` com "Desfazer" por 3.5s
- Se desfazer: `taskRepo.markUndone(id)` + cancelar notificação do desfazer
- Nome da tarefa (riscado se concluída)
- Badge com `scheduleLabel()`
- Se concluída: "Feita às HH:MM"
- Se indisponível: texto cinza "Disponível: [nextAvailLabel()]"
- Swipe left → Excluir (com confirm)

**Agendar notificação ao criar tarefa:** Após `taskRepo.create()`, chamar `scheduleTaskNotification(task)`.
**Cancelar notificação ao excluir tarefa:** Antes de `taskRepo.delete()`, chamar `cancelTaskNotification(id)`.

### 11.6 MODAL DE TAREFA (`src/modals/TaskModal.tsx`)

Campos:
1. Input: Nome (obrigatório)
2. Toggle: Única / Recorrente
3. Se Recorrente:
   - Seletor de frequência (scroll horizontal): Diário | Semanal | Mensal | A cada X meses | Anual | A cada X anos | Início do mês | Fim do mês
   - Se Semanal: grade de dias (Dom–Sab), seleção múltipla
   - Se "X meses" ou "X anos": input numérico ≥ 2
   - Time pickers para "das HH:MM" e "às HH:MM"
   - Preview dinâmico: "Todo dia entre 08:00 e 18:00"

### 11.7 ABA RELATÓRIO (`app/(tabs)/stats.tsx`)

Cards em ordem:

**1. Resumo de chamados:**
Grid 2x2 com Total / Abertos / Andamento / Aguardando + linha com Fechados e Taxa de fechamento (%)

**2. Por Categoria:**
Barra de progresso colorida (azul) com nome + contagem para cada categoria. Ordenado por contagem decrescente.

**3. Por Prioridade:**
Lista com cor da prioridade, nome e contagem. Ordem: urgente / alta / média / baixa.

**4. Checklist hoje:**
"X de Y tarefas concluídas" com barra de progresso verde e percentual.

**5. Períodos:**
"Esta semana: X chamados criados" / "Este mês: Y" — calculado com filtro de `created_at` em SQL no `statsRepo`.

**Botão "Exportar Relatório":**
Gerar HTML formatado com os mesmos dados e salvar como arquivo via `expo-file-system`, depois compartilhar via `expo-sharing`. O HTML deve ter o tema dark do app.

### 11.8 ABA CONFIGURAÇÕES (`app/(tabs)/config.tsx`)

**Seção Empresas:**
Para cada empresa: nome, "(atual)" se for a selecionada, contagem "X cham. / Y tarefas", botões Selecionar / Limpar / Excluir.
- "Selecionar": chama `setCurrentCompany()` + `SecureStore`
- "Limpar": `ConfirmDialog` → `companyRepo.clearData(id)` + cancelar todas as notificações de tarefas da empresa
- "Excluir": `ConfirmDialog` (texto em vermelho) → `companyRepo.delete(id)` + deletar arquivos de anexos via `fileUtils.deleteFile()` para cada attachment

**Seção Técnicos:**
Lista de técnicos cadastrados com botão × para remover. Input + botão "+" para adicionar. Técnicos aparecem no picker "Atribuído a" ao criar/editar chamados.

**Seção Categorias:**
Lista de categorias com botão × para remover. Input + botão "+" para adicionar.

**Seção Backup:**
- "Exportar": gerar JSON completo → `expo-sharing`
- "Importar": `expo-document-picker` para `.json` → validar `app === 'helpdesk-rn'` → `ConfirmDialog` com resumo → importar

**Formato backup v2:**
```json
{
  "app": "helpdesk-rn",
  "version": 2,
  "exportedAt": "DD/MM/YYYY HH:MM",
  "companies": [{ "id": 1, "name": "...", "created_at": "..." }],
  "categories": [{ "id": 1, "name": "..." }],
  "technicians": [{ "id": 1, "name": "..." }],
  "tickets": [{
    "id": "tk_...", "company_id": 1, "title": "...",
    "requester": "...", "assignee": null, "category": "...",
    "priority": "...", "status": "...", "description": "...",
    "due_date": null, "created_at": "...", "updated_at": "..."
  }],
  "attachments": [{
    "id": 1, "ticket_id": "tk_...", "name": "foto.jpg",
    "size": 102400, "mime_type": "image/jpeg",
    "local_path": "RESTORED_ON_IMPORT",
    "base64": "...",
    "created_at": "..."
  }],
  "timeline": [{ "id": 1, "ticket_id": "...", "type": "...", "text": "...", "created_at": "..." }],
  "tasks": [{ "id": "ts_...", "company_id": 1, ... }]
}
```

**Lógica de exportação de anexos:**
- Arquivos ≤ 1MB: incluir base64 no JSON
- Arquivos > 1MB: incluir campo `"base64": null` e `"skipped_reason": "arquivo_muito_grande"`
- Exibir toast: "Backup exportado. Arquivos > 1MB nao incluidos."

**Lógica de importação:**
1. Parsear JSON
2. Inserir companies, categories, technicians (ignorar conflitos de nome com `INSERT OR IGNORE`)
3. Mapear IDs antigos para novos IDs
4. Inserir tickets com o `company_id` mapeado
5. Para cada attachment com `base64` não nulo: recriar arquivo via `fileUtils.saveFile()` com base64 decodificado
6. Inserir attachments com o novo `local_path`
7. Inserir timeline
8. Inserir tasks com `company_id` mapeado
9. Re-agendar notificações para todas as tarefas recorrentes importadas

---

## 12. NAVEGAÇÃO

### `app/(tabs)/_layout.tsx`
```typescript
import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor:  Colors.border,
          height: 60,
          paddingBottom: 6,
        },
        tabBarActiveTintColor:   Colors.blue,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: { fontSize: 10, marginBottom: 2 },
      }}
    >
      <Tabs.Screen name="index"     options={{ title: 'Chamados',  tabBarIcon: ({ color }) => <MaterialCommunityIcons name="ticket-outline"        size={24} color={color} /> }} />
      <Tabs.Screen name="checklist" options={{ title: 'Checklist', tabBarIcon: ({ color }) => <MaterialCommunityIcons name="checkbox-marked-outline" size={24} color={color} /> }} />
      <Tabs.Screen name="stats"     options={{ title: 'Relatorio', tabBarIcon: ({ color }) => <MaterialCommunityIcons name="chart-bar"               size={24} color={color} /> }} />
      <Tabs.Screen name="config"    options={{ title: 'Config',    tabBarIcon: ({ color }) => <MaterialCommunityIcons name="cog-outline"             size={24} color={color} /> }} />
    </Tabs>
  );
}
```

---

## 13. REGRAS E RESTRIÇÕES

1. **Zero rede.** Nenhum `fetch`, `axios` ou qualquer chamada HTTP para funcionalidade. O app deve funcionar com avião ativado.
2. **Sem `localStorage` ou `AsyncStorage`.** SQLite para dados estruturados, `expo-secure-store` para settings simples, `expo-file-system` para arquivos.
3. **Sem bibliotecas de UI de terceiros** (NativeBase, Tamagui, React Native Paper). Apenas componentes próprios + `@expo/vector-icons`.
4. **TypeScript estrito.** Sem `any` desnecessário. Tipar todas as queries do SQLite com generics: `db.getAllSync<Ticket>(...)`.
5. **Confirmar antes de excluir** qualquer dado: chamado, tarefa, empresa, categoria, técnico, anexo.
6. **Haptic feedback** obrigatório em: marcar tarefa (`Light`), criar chamado (`Medium`), confirmar exclusão (`Heavy`).
7. **Empresa "Geral" não existe mais como entrada.** O modo de visualização global é um toggle "Ver todas" no header da aba Chamados. No modo "Ver todas", é impossível criar chamados.
8. **Paginação obrigatória.** Nunca carregar todos os chamados de uma vez. Usar `LIMIT 30 OFFSET N` em todas as queries de listagem.
9. **Lógica de recorrência** deve usar `last_done_at` + comparação de período, não apenas comparação com "hoje". Ver `scheduleUtils.ts` — implementar exatamente o que está especificado.
10. **Persistir empresa atual** em `expo-secure-store` toda vez que o usuário trocar de empresa. Restaurar na inicialização em `_layout.tsx`.
11. **Notificações** agendadas na criação de tarefas recorrentes, canceladas na exclusão. Não agendar para tarefas únicas.
12. **Histórico de edições** automático na timeline: detectar campos alterados no `TicketModal` em modo edição e inserir eventos `type: 'edit'`.
13. **Marcar tarefa sem confirmação.** Toque direto no checkbox = concluída imediatamente + `UndoToast` com desfazer por 3.5s.
14. **Índices SQLite** já declarados no schema. Não remover.
15. **Backup de anexos grandes:** arquivos > 1MB não incluem base64 no JSON. Avisar o usuário.

---

## 14. CHECKLIST DE IMPLEMENTAÇÃO

Execute cada item em ordem. Não pule etapas.

**FASE 1 — Base**
- [ ] 1.  Inicializar projeto Expo + instalar todos os pacotes
- [ ] 2.  Configurar `app.json` completo
- [ ] 3.  Criar `src/constants/theme.ts`
- [ ] 4.  Criar `src/utils/dateUtils.ts`
- [ ] 5.  Criar `src/utils/fileUtils.ts`
- [ ] 6.  Criar `src/utils/scheduleUtils.ts` (lógica completa com `lastDoneAt`)
- [ ] 7.  Criar `src/db/index.ts` com schema completo, índices e seeds
- [ ] 8.  Criar `src/stores/appStore.ts` com SecureStore
- [ ] 9.  Criar `src/hooks/useMediaPermissions.ts`
- [ ] 10. Criar `src/hooks/useNotifications.ts`
- [ ] 11. Criar `src/hooks/usePagination.ts`

**FASE 2 — Componentes Base**
- [ ] 12. Criar `src/components/UndoToast.tsx`
- [ ] 13. Criar `src/components/ConfirmDialog.tsx`
- [ ] 14. Criar `src/components/BottomSheet.tsx` (Reanimated)
- [ ] 15. Criar `src/components/SwipeableRow.tsx`
- [ ] 16. Criar `src/components/SearchBar.tsx`
- [ ] 17. Criar `src/components/StatusBadge.tsx` e `PriorityBadge.tsx`
- [ ] 18. Criar `src/components/EmptyState.tsx`
- [ ] 19. Criar `src/components/FAB.tsx`

**FASE 3 — Layout e Navegação**
- [ ] 20. Criar `app/_layout.tsx` (init DB + SecureStore + notif)
- [ ] 21. Criar `app/(tabs)/_layout.tsx` (tab bar)

**FASE 4 — Modais**
- [ ] 22. Criar `src/modals/CompanyModal.tsx`
- [ ] 23. Criar `src/modals/TransitionModal.tsx`
- [ ] 24. Criar `src/modals/TaskModal.tsx` (com preview dinâmico)
- [ ] 25. Criar `src/modals/TicketModal.tsx` (criar/editar + campo técnico + prazo)

**FASE 5 — Telas Principais**
- [ ] 26. Criar `src/components/TicketCard.tsx` (miniatura + borda + badge vencido + long press)
- [ ] 27. Criar `app/(tabs)/index.tsx` (chamados: paginação + busca + toggle global)
- [ ] 28. Criar `src/components/TimelineItem.tsx` e `AttachmentRow.tsx`
- [ ] 29. Criar `app/ticket/[id].tsx` (detalhe completo + histórico de edições + técnico + prazo)
- [ ] 30. Criar `src/components/TaskCard.tsx` (sem confirm + undo + nextAvail + swipe)
- [ ] 31. Criar `app/(tabs)/checklist.tsx` (seções + reset + notificações)
- [ ] 32. Criar `app/(tabs)/stats.tsx` (resumo + categorias + períodos + exportar HTML)
- [ ] 33. Criar `src/utils/backupUtils.ts` (export v2 com base64 condicional + import com remapeamento de IDs)
- [ ] 34. Criar `app/(tabs)/config.tsx` (empresas + técnicos + categorias + backup)

**FASE 6 — Validação Final**
- [ ] 35. Testar fluxo: criar empresa → criar técnico → criar chamado com foto → atribuir → mudar status → fechar
- [ ] 36. Testar checklist: criar tarefa diária → marcar → desfazer → verificar reset no dia seguinte
- [ ] 37. Testar busca: digitar parte do título/solicitante e verificar filtro
- [ ] 38. Testar paginação: criar 35+ chamados e verificar carregamento incremental
- [ ] 39. Testar backup: exportar → limpar empresa → importar → verificar dados e arquivos restaurados
- [ ] 40. Testar notificações: criar tarefa recorrente → verificar notificação agendada → excluir tarefa → verificar cancelamento

---

## 15. COMANDOS PARA RODAR

```bash
cd helpdesk-ti
npx expo start --android    # Android via USB ou emulador
npx expo start --ios        # iOS (somente macOS)
npx expo start              # Expo Go para testes rápidos
```

**Gerar APK de preview (sem conta EAS necessária):**
```bash
npx eas build --platform android --profile preview --local
```

---

## FIM DO AGENTS.md v2.0

Ao concluir todos os 40 itens do checklist, o app estará completo e pronto para uso em produção.
