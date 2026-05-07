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

/**
 * Retorna a data da segunda-feira da semana corrente em formato "YYYY-MM-DD".
 */
export function startOfWeekISO(): string {
  const d = new Date();
  const day = d.getDay(); // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
  const diffToMonday = day === 0 ? -6 : 1 - day; // Se domingo, volta 6 dias;否则 volta para segunda
  d.setDate(d.getDate() + diffToMonday);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/**
 * Retorna o primeiro dia do mês corrente em formato "YYYY-MM-DD".
 */
export function startOfMonthISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
}

export function fmtSize(bytes: number): string {
  if (bytes >= 1048576) return `${(bytes/1048576).toFixed(1)}MB`;
  return `${(bytes/1024).toFixed(1)}KB`;
}
