import * as FS from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as Crypto from 'expo-crypto';
import { db, companyRepo, categoryRepo, ticketRepo, timelineRepo, attachmentRepo, taskRepo } from '../db';
import { nowStr } from './dateUtils';
import { ensureDir, readBase64, saveFile } from './fileUtils';

const DIR = new FS.Directory(FS.Paths.document, 'attachments');

export interface BackupData {
  app: string;
  version: number;
  exportedAt: string;
  companies: any[];
  categories: any[];
  tickets: any[];
  attachments: { id: number; ticket_id: string; name: string; size: number; mime_type: string | null; local_path: string; base64: string | null; skipped_reason?: string; created_at: string }[];
  timeline: any[];
  tasks: any[];
}

export async function exportBackup(): Promise<{ success: boolean; skippedCount?: number; skippedNames?: string[]; error?: string }> {
  try {
    const companies = companyRepo.getAll();
    const categories = categoryRepo.getAll();
    const tickets = db.getAllSync<any>('SELECT * FROM tickets');
    const attachments = db.getAllSync<any>('SELECT * FROM attachments');
    const timeline = db.getAllSync<any>('SELECT * FROM timeline');
    const tasks = db.getAllSync<any>('SELECT * FROM tasks');

    const attachments_export: any[] = [];
    const skipped: Array<{ name: string; size: number }> = [];

    for (const att of attachments) {
      try {
        if (att.size > 1048576) {
          attachments_export.push({ ...att, base64: null, skipped_reason: 'arquivo_muito_grande' });
          skipped.push({ name: att.name, size: att.size });
        } else {
          const base64 = await readBase64(att.local_path);
          attachments_export.push({ ...att, base64 });
        }
      } catch {
        attachments_export.push({ ...att, base64: null, skipped_reason: 'erro_leitura' });
        skipped.push({ name: att.name, size: att.size });
      }
    }

    const backup: BackupData = {
      app: 'helpdesk-rn', version: 2, exportedAt: nowStr(),
      companies, categories, tickets,
      attachments: attachments_export, timeline, tasks,
    };

    if (skipped.length > 0) {
      (backup as any).skippedAttachments = skipped;
    }

    const BACKUP_DIR = new FS.Directory(FS.Paths.document, 'backups');
    if (!BACKUP_DIR.exists) BACKUP_DIR.create({ intermediates: true });

    const fileName = `helpdesk_backup_${Crypto.randomUUID()}.json`;
    const filePath = new FS.File(BACKUP_DIR, fileName);
    await filePath.write(JSON.stringify(backup, null, 2));

    await Sharing.shareAsync(filePath.uri, { mimeType: 'application/json', UTI: 'public.json' });

    if (skipped.length > 0) {
      return { success: true, skippedCount: skipped.length, skippedNames: skipped.map(s => s.name) };
    }

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function importBackup(): Promise<{ success: boolean; summary?: string; error?: string; json?: string }> {
  try {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
    if (result.canceled) return { success: false, error: 'Cancelado' };

    const content = await new FS.File(result.assets[0].uri).text();
    const backup: BackupData = JSON.parse(content);

    if (backup.app !== 'helpdesk-rn') return { success: false, error: 'Formato invalido' };
    if (typeof backup.version !== 'number') return { success: false, error: 'Versao invalida' };
    if (!Array.isArray(backup.companies) || !Array.isArray(backup.tickets)) return { success: false, error: 'Backup corrompido' };
    if (!Array.isArray(backup.attachments)) backup.attachments = [];

    const summary = `Empresas: ${backup.companies.length}\nCategorias: ${backup.categories.length}\nChamados: ${backup.tickets.length}\nAnexos: ${backup.attachments.length}\nTimeline: ${backup.timeline.length}\nTarefas: ${backup.tasks.length}`;

    return { success: true, summary, json: content };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function confirmAndImportBackup(backupJson: string): Promise<{ success: boolean; error?: string }> {
  try {
    const backup: BackupData = JSON.parse(backupJson);

    // Inicia transação SQL para garantir atomicidade
    db.execSync('BEGIN TRANSACTION');

    try {
      db.runSync('DELETE FROM tasks');
      db.runSync('DELETE FROM timeline');
      db.runSync('DELETE FROM attachments');
      db.runSync('DELETE FROM tickets');
      db.runSync('DELETE FROM categories');
      db.runSync('DELETE FROM companies');

      for (const comp of backup.companies) {
        db.runSync('INSERT OR IGNORE INTO companies (id, name, created_at) VALUES (?, ?, ?)', [comp.id, comp.name, comp.created_at]);
      }
      for (const cat of backup.categories) {
        db.runSync('INSERT OR IGNORE INTO categories (id, name) VALUES (?, ?)', [cat.id, cat.name]);
      }
      for (const ticket of backup.tickets) {
        db.runSync(
          'INSERT INTO tickets (id, company_id, title, requester, category, priority, status, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [ticket.id, ticket.company_id, ticket.title, ticket.requester, ticket.category, ticket.priority, ticket.status, ticket.description, ticket.created_at, ticket.updated_at]
        );
      }

      await ensureDir();
      for (const att of backup.attachments) {
        if (att.base64) {
          const dest = await saveFile(new FS.File(DIR, att.name).uri, att.name);
          const destFile = new FS.File(dest);
          await destFile.write(att.base64, { encoding: 'base64' });
          db.runSync(
            'INSERT INTO attachments (id, ticket_id, name, size, mime_type, local_path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [att.id, att.ticket_id, att.name, att.size, att.mime_type, dest, att.created_at]
          );
        }
      }

      for (const tl of backup.timeline) {
        db.runSync('INSERT INTO timeline (id, ticket_id, type, text, created_at) VALUES (?, ?, ?, ?, ?)', [tl.id, tl.ticket_id, tl.type, tl.text, tl.created_at]);
      }
      for (const task of backup.tasks) {
        db.runSync(
          'INSERT INTO tasks (id, company_id, name, task_type, schedule_type, schedule_days, period_number, time_from, time_to, is_done, last_done_at, last_reset_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [task.id, task.company_id, task.name, task.task_type, task.schedule_type, task.schedule_days, task.period_number, task.time_from, task.time_to, task.is_done, task.last_done_at, task.last_reset_date, task.created_at]
        );
      }

      // Commit apenas se tudo succeeded
      db.execSync('COMMIT');
    } catch (innerError: any) {
      // Rollback em caso de erro durante as operações
      db.execSync('ROLLBACK');
      throw innerError;
    }

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
