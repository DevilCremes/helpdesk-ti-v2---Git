import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import { nowStr, todayISO } from '../utils/dateUtils';

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

    CREATE TABLE IF NOT EXISTS tickets (
      id           TEXT    PRIMARY KEY,
      company_id   INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      title        TEXT    NOT NULL,
      requester    TEXT    NOT NULL,
      category     TEXT    NOT NULL,
      priority     TEXT    NOT NULL,
      status       TEXT    NOT NULL DEFAULT 'aberto',
      description  TEXT,
      created_at   TEXT    NOT NULL,
      updated_at   TEXT    NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tickets_company  ON tickets(company_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_status   ON tickets(status);
    CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
    CREATE INDEX IF NOT EXISTS idx_tickets_created  ON tickets(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_tickets_company_status ON tickets(company_id, status);

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
      company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
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
export interface Company     { id: number; name: string; created_at: string; }
export interface Category    { id: number; name: string; }

export interface Ticket {
  id: string; company_id: number; title: string; requester: string;
  category: string; priority: string; status: string;
  description: string | null;
  created_at: string; updated_at: string;
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
    getAll: (): Company[] => db.getAllSync<Company>('SELECT * FROM companies ORDER BY name'),

  getById: (id: number): Company | null =>
    db.getFirstSync<Company>('SELECT * FROM companies WHERE id = ?', [id]) ?? null,

  create: (name: string): number => {
    db.runSync('INSERT INTO companies (name, created_at) VALUES (?, ?)', [name, nowStr()]);
    return (db.getFirstSync<{ id: number }>('SELECT last_insert_rowid() as id')!).id;
  },

  delete: (id: number): void => {
    db.runSync('DELETE FROM companies WHERE id = ?', [id]);
  },

  deleteWithCascade: (id: number): void => {
    // Cascade delete now handled by FK constraint, but kept for compatibility
    db.runSync('DELETE FROM companies WHERE id = ?', [id]);
  },

  // Soft delete with backup data for undo
  softDelete: (id: number): { company: Company; tickets: any[]; tasks: any[] } => {
    const company = db.getFirstSync<Company>('SELECT * FROM companies WHERE id = ?', [id])!;
    const tickets = db.getAllSync('SELECT * FROM tickets WHERE company_id = ?', [id]);
    const tasks = db.getAllSync('SELECT * FROM tasks WHERE company_id = ?', [id]);

    db.runSync('DELETE FROM companies WHERE id = ?', [id]);

    return { company, tickets, tasks };
  },

  // Restore company with all data
  restore: (data: { company: Company; tickets: any[]; tasks: any[] }): void => {
    const { company, tickets, tasks } = data;

    // Restore company
    db.runSync('INSERT INTO companies (id, name, created_at) VALUES (?, ?, ?)', [
      company.id,
      company.name,
      company.created_at,
    ]);

    // Restore tickets
    for (const ticket of tickets) {
      db.runSync(
        `INSERT INTO tickets (id, company_id, title, requester, category, priority, status, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ticket.id,
          ticket.company_id,
          ticket.title,
          ticket.requester,
          ticket.category,
          ticket.priority,
          ticket.status,
          ticket.description,
          ticket.created_at,
          ticket.updated_at,
        ]
      );
    }

    // Restore tasks
    for (const task of tasks) {
      db.runSync(
        `INSERT INTO tasks (id, company_id, name, task_type, schedule_type, schedule_days, period_number, time_from, time_to, is_done, last_done_at, last_reset_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          task.id,
          task.company_id,
          task.name,
          task.task_type,
          task.schedule_type,
          task.schedule_days,
          task.period_number,
          task.time_from,
          task.time_to,
          task.is_done,
          task.last_done_at,
          task.last_reset_date,
          task.created_at,
        ]
      );
    }
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

  create: (name: string): void => {
    db.runSync('INSERT INTO categories (name) VALUES (?)', [name]);
  },

  delete: (id: number): void => {
    db.runSync('DELETE FROM categories WHERE id = ?', [id]);
  },
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
       FROM tickets t
       JOIN companies c ON t.company_id = c.id
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
       FROM tickets t
       JOIN companies c ON t.company_id = c.id
       ${where}
       ORDER BY t.created_at DESC
       LIMIT ? OFFSET ?`,
      params
    );
  },

  getById: (id: string): Ticket | null =>
    db.getFirstSync<Ticket>(
      `SELECT t.*, c.name as company_name
       FROM tickets t
       JOIN companies c ON t.company_id = c.id
       WHERE t.id = ?`,
      [id]
    ) ?? null,

  create: (data: {
    companyId: number; title: string; requester: string;
    category: string; priority: string; description?: string;
  }): string => {
    const id = `tk_${Crypto.randomUUID()}`;
    const now = nowStr();
    db.runSync(
      `INSERT INTO tickets (id, company_id, title, requester, category, priority, status, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'aberto', ?, ?, ?)`,
      [id, data.companyId, data.title, data.requester,
       data.category, data.priority, data.description ?? null, now, now]
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
    if (data.category    !== undefined) { fields.push('category = ?');    vals.push(data.category); }
    if (data.priority    !== undefined) { fields.push('priority = ?');    vals.push(data.priority); }
    if (data.status      !== undefined) { fields.push('status = ?');      vals.push(data.status); }
    if (data.description !== undefined) { fields.push('description = ?'); vals.push(data.description); }

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
       ORDER BY t.is_done ASC, t.created_at DESC`,
      [companyId]
    ),

  getAll: (): Task[] =>
    db.getAllSync<Task>(
      `SELECT t.*, c.name as company_name
       FROM tasks t JOIN companies c ON t.company_id = c.id
       ORDER BY t.is_done ASC, t.created_at DESC`
    ),

  create: (data: {
    companyId: number; name: string; taskType: string; scheduleType?: string;
    scheduleDays?: number[]; periodNumber?: number; timeFrom?: string; timeTo?: string;
  }): string => {
    const id = `ts_${Crypto.randomUUID()}`;
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
    db.runSync(
      'UPDATE tasks SET is_done = 1, last_done_at = ?, last_reset_date = ? WHERE id = ?',
      [nowStr(), todayISO(), id]
    );
  },

  markUndone: (id: string): void => {
    db.runSync(
      'UPDATE tasks SET is_done = 0, last_done_at = NULL WHERE id = ?',
      [id]
    );
  },

  resetRecurring: (): void => {
    // Busca todas as tarefas recorrentes concluídas que ainda não foram resetadas hoje
    const tasks = db.getAllSync<Task>(
      `SELECT * FROM tasks
       WHERE task_type = 'rec'
         AND is_done = 1
         AND (last_reset_date IS NULL OR last_reset_date != ?)`,
      [todayISO()]
    );

    // Para cada tarefa, verifica se está disponível agora conforme sua frequência
    for (const task of tasks) {
      const schedule: TaskSchedule = {
        task_type: task.task_type,
        schedule_type: task.schedule_type,
        schedule_days: task.schedule_days,
        period_number: task.period_number,
        time_from: task.time_from,
        time_to: task.time_to,
        last_done_at: task.last_done_at,
      };

      // Importação dinâmica para evitar ciclo
      const { isTaskAvailableNow } = require('../utils/scheduleUtils');

      // Reset apenas se a tarefa estiver disponível agora
      if (isTaskAvailableNow(schedule)) {
        db.runSync(
          'UPDATE tasks SET is_done = 0, last_reset_date = ? WHERE id = ?',
          [todayISO(), task.id]
        );
      }
    }
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
  getSummary: (companyId: number | null, dateFrom?: string) => {
    const params: (string | number)[] = [];
    const conditions: string[] = [];

    if (companyId !== null) {
      conditions.push('company_id = ?');
      params.push(companyId);
    }
    if (dateFrom) {
      conditions.push("created_at >= ?");
      params.push(dateFrom);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const andClause = conditions.length > 0 ? 'AND' : 'WHERE';

    const total = db.getFirstSync<{ n: number }>(
      `SELECT COUNT(*) as n FROM tickets ${whereClause}`, params
    )?.n ?? 0;

    const aberto = db.getFirstSync<{ n: number }>(
      `SELECT COUNT(*) as n FROM tickets ${whereClause} ${andClause} status = 'aberto'`,
      [...params]
    )?.n ?? 0;

    const andamento = db.getFirstSync<{ n: number }>(
      `SELECT COUNT(*) as n FROM tickets ${whereClause} ${andClause} status = 'andamento'`,
      [...params]
    )?.n ?? 0;

    const aguardando = db.getFirstSync<{ n: number }>(
      `SELECT COUNT(*) as n FROM tickets ${whereClause} ${andClause} status = 'aguardando'`,
      [...params]
    )?.n ?? 0;

    const fechado = db.getFirstSync<{ n: number }>(
      `SELECT COUNT(*) as n FROM tickets ${whereClause} ${andClause} status = 'fechado'`,
      [...params]
    )?.n ?? 0;

    const byCat = db.getAllSync<{ category: string; n: number }>(
      `SELECT category, COUNT(*) as n FROM tickets ${whereClause} GROUP BY category ORDER BY n DESC`,
      params
    );

    const byPri = db.getAllSync<{ priority: string; n: number }>(
      `SELECT priority, COUNT(*) as n FROM tickets ${whereClause} GROUP BY priority ORDER BY n DESC`,
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

// ─── AUTO-INIT (executa ao importar o módulo) ────────────────────────────────
initDatabase();

export { db };
