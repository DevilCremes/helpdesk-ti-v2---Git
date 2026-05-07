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
  last_done_at:  string | null;
}

function parseLastDoneDate(lastDoneAt: string | null): Date | null {
  if (!lastDoneAt) return null;
  const parts = lastDoneAt.split(' ')[0].split('/');
  if (parts.length !== 3) return null;
  return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
}

/**
 * Parse seguro de schedule_days JSON.
 * Retorna array vazio se null, malformado ou não-array.
 */
function parseDays(raw: string | null): number[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    console.warn('[scheduleUtils] schedule_days malformado:', raw);
    return [];
  }
}

export function isTaskAvailableNow(task: TaskSchedule): boolean {
  if (task.task_type === 'one') return true;

  const now   = new Date();
  const today = todayDate();

  const tf = task.time_from ?? '00:00';
  const tt = task.time_to   ?? '23:59';
  const cur = now.getHours() * 60 + now.getMinutes();
  const [fh, fm] = tf.split(':').map(Number);
  const [th, tm] = tt.split(':').map(Number);
  if (cur < fh * 60 + fm || cur > th * 60 + tm) return false;

  const lastDone = parseLastDoneDate(task.last_done_at);

  switch (task.schedule_type) {
    case 'daily':
      if (!lastDone) return true;
      return lastDone.getTime() < today.getTime();

    case 'weekly': {
      const days: number[] = parseDays(task.schedule_days);
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
      const days: number[] = parseDays(task.schedule_days);
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
      const days: number[] = parseDays(task.schedule_days);
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
