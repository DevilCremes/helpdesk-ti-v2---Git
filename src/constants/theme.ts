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
