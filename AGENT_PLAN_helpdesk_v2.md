# AGENT_PLAN — Helpdesk TI v2
> Plano de execução para agente autônomo de refatoração.
> Projeto: React Native + Expo SDK 54 + TypeScript + SQLite (expo-sqlite) + Zustand

---

## Regras de execução

1. Execute **fase por fase**, na ordem definida. Não avance para a próxima fase sem concluir todas as tarefas da fase atual.
2. Para cada tarefa: **leia todos os arquivos listados** antes de escrever qualquer código.
3. **Nunca modifique arquivos fora dos listados** em cada tarefa.
4. Antes de marcar uma tarefa como concluída, verifique **todos os critérios de aceite**.
5. Se uma tarefa tiver `dependencias`, confirme que essas tarefas já foram concluídas antes de iniciar.
6. Ao terminar cada fase, faça um commit com a mensagem `feat: fase-N concluída`.
7. Em caso de ambiguidade, prefira a solução mais conservadora e documente a decisão em comentário no código.

---

## Fase 1 — Bugs críticos
> Problemas que afetam a corretude dos dados. Devem ser corrigidos antes de qualquer outra mudança.

---

### T01 — Envolver importBackup em transaction SQL

**Arquivos:**
- `src/utils/backupUtils.ts`

**Problema:**
A função `confirmAndImportBackup` deleta todos os dados antes de reinserir. Se a reinserção falhar no meio do processo (JSON malformado, constraint violation, falta de espaço), o banco de dados fica completamente vazio sem possibilidade de recuperação.

**Instrução:**
Envolver todo o bloco de operações de `confirmAndImportBackup` em uma transaction SQLite explícita:
- Iniciar com `db.execSync('BEGIN TRANSACTION')` antes do primeiro DELETE.
- Encerrar com `db.execSync('COMMIT')` após o último INSERT bem-sucedido.
- Em qualquer exceção capturada no catch, executar `db.execSync('ROLLBACK')` antes de propagar o erro.
- Garantir que o ROLLBACK é chamado mesmo que o COMMIT falhe.

**Critérios de aceite:**
- [ ] Falha de inserção no meio do restore não corrompe dados existentes
- [ ] Banco permanece intacto se o JSON estiver malformado
- [ ] ROLLBACK é garantido em qualquer caminho de erro
- [ ] Teste manual: restaurar JSON com erro proposital e verificar que dados originais persistem

---

### T02 — Corrigir auto-reset de tarefas por frequência

**Arquivos:**
- `src/db/index.ts`
- `src/utils/scheduleUtils.ts`

**Problema:**
`taskRepo.resetRecurring()` verifica apenas `last_reset_date != today`. Isso faz uma tarefa `monthly` resetar no dia seguinte à conclusão, uma tarefa `weekly` resetar em dias fora da frequência configurada, etc.

**Instrução:**
Alterar `taskRepo.resetRecurring()` para não usar um único UPDATE SQL em massa. Em vez disso:
1. Buscar todas as tarefas do tipo `rec` com `is_done = 1` e `last_reset_date != todayISO()`.
2. Para cada tarefa retornada, chamar `isTaskAvailableNow(task)` de `scheduleUtils.ts`.
3. Executar o UPDATE de reset (`is_done = 0`) **somente** para as tarefas onde `isTaskAvailableNow` retornar `true`.

**Critérios de aceite:**
- [ ] Tarefa `monthly` feita hoje não reseta amanhã
- [ ] Tarefa `weekly` reseta apenas no próximo dia da semana configurado em `schedule_days`
- [ ] Tarefa `daily` reseta no dia seguinte normalmente
- [ ] Tarefa `one` (única) nunca é resetada por este método

---

### T03 — Implementar filtro de período no Stats

**Arquivos:**
- `src/db/index.ts`
- `app/(tabs)/stats.tsx`
- `src/utils/dateUtils.ts`

**Problema:**
Os cards "Esta semana" e "Este mês" na tela de Relatório exibem o mesmo valor que o total geral. `statsRepo.getSummary()` não aceita parâmetro de data.

**Instrução:**

Em `src/utils/dateUtils.ts`, adicionar duas funções:
```typescript
// Retorna "YYYY-MM-DD" do início da semana corrente (segunda-feira)
startOfWeekISO(): string

// Retorna "YYYY-MM-DD" do primeiro dia do mês corrente
startOfMonthISO(): string
```

Em `src/db/index.ts`, alterar a assinatura de `statsRepo.getSummary()`:
```typescript
getSummary(companyId?: number | null, dateFrom?: string): SummaryResult
```
Quando `dateFrom` for fornecido, adicionar `AND t.created_at >= ?` nas queries SQL relevantes.
Quando `companyId` for fornecido (e não nulo), adicionar `AND t.company_id = ?`.

Em `app/(tabs)/stats.tsx`, chamar `getSummary` três vezes:
- Sem parâmetros: total geral
- Com `dateFrom: startOfWeekISO()`: esta semana
- Com `dateFrom: startOfMonthISO()`: este mês
Passar `currentCompanyId` quando `viewAllCompanies === false`.

**Critérios de aceite:**
- [ ] Card "Esta semana" exibe apenas chamados criados desde a segunda-feira corrente
- [ ] Card "Este mês" exibe apenas chamados do mês corrente
- [ ] Ambos os cards respeitam a empresa selecionada
- [ ] Sem parâmetros, `getSummary()` continua retornando o total (compatibilidade)

---

### T04 — Validar time_from < time_to no TaskModal

**Arquivos:**
- `src/modals/TaskModal.tsx`

**Problema:**
`TaskModal` não valida se o horário de início é anterior ao de fim. `isTaskAvailableNow()` retorna resultados incorretos quando `time_to <= time_from`.

**Instrução:**
Adicionar validação no `handleSave` do `TaskModal`:
1. Antes de inserir, verificar se `time_from < time_to` (comparação de strings ISO no formato HH:mm é lexicograficamente válida).
2. Se inválido, definir uma mensagem de erro em estado local (ex: `timeError: string | null`).
3. Renderizar a mensagem de erro com estilo de alerta abaixo dos campos de horário (não usar `Alert.alert`).
4. O botão "Salvar" deve estar desabilitado enquanto `timeError !== null`.
5. Limpar o erro quando o usuário alterar qualquer campo de horário.

**Critérios de aceite:**
- [ ] Exibe mensagem de erro inline se `time_to <= time_from`
- [ ] Campos de horário com erro recebem destaque visual (ex: borda vermelha)
- [ ] Botão salvar fica desabilitado enquanto há erro de horário
- [ ] Erro é limpo automaticamente ao corrigir os campos

---

## Fase 2 — Arquitetura
> Eliminação de dívida técnica e duplicação de código. Executar após a Fase 1.

---

### T05 — Adotar usePagination nas telas de chamados

**Dependências:** T01

**Arquivos:**
- `app/(tabs)/index.tsx`
- `src/hooks/usePagination.ts`

**Problema:**
O hook `usePagination` já está implementado em `src/hooks/usePagination.ts` mas não é utilizado. A tela `index.tsx` reimplementa manualmente ~40 linhas de lógica de paginação idêntica ao hook.

**Instrução:**
Refatorar `app/(tabs)/index.tsx`:
1. Importar `usePagination` de `src/hooks/usePagination.ts`.
2. Criar uma função `fetcher` que recebe `page: number` e chama `ticketRepo.getPage({ page, companyId, status: activeFilter, search: debouncedSearch })`.
3. Passar esse fetcher ao hook: `const { items: tickets, refresh, loadMore, hasMore, loading } = usePagination(fetcher, [companyId, activeFilter, debouncedSearch])`.
4. Remover os estados manuais: `tickets`, `page`, `loading`, `refreshing`, `hasMore` e as funções `loadTickets`, `loadMore` locais.
5. Manter o estado `refreshing` apenas para o `RefreshControl` visual (pode ser derivado de `loading && page === 0`).

**Critérios de aceite:**
- [ ] Comportamento de paginação idêntico ao anterior (30 itens por página, infinite scroll)
- [ ] Filtros por status e company_id continuam funcionando
- [ ] Busca com debounce continua funcionando
- [ ] Estados manuais de paginação removidos de `index.tsx`

---

### T06 — Adicionar ON DELETE CASCADE em companies

**Arquivos:**
- `src/db/index.ts`
- `app/(tabs)/config.tsx`

**Problema:**
As tabelas `tickets` e `tasks` não têm `ON DELETE CASCADE` na FK `company_id`. O delete de empresa exige lógica manual em `config.tsx` para deletar filhos antes, acoplando a tela à camada de dados.

**Instrução:**

Em `src/db/index.ts`, alterar o schema das tabelas `tickets` e `tasks` para incluir `ON DELETE CASCADE`:
```sql
company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
```

Como o SQLite não suporta `ALTER COLUMN`, implementar migração via:
```sql
PRAGMA foreign_keys = OFF;
BEGIN TRANSACTION;

CREATE TABLE tickets_new (...);  -- com ON DELETE CASCADE
INSERT INTO tickets_new SELECT * FROM tickets;
DROP TABLE tickets;
ALTER TABLE tickets_new RENAME TO tickets;

-- Repetir para tasks

COMMIT;
PRAGMA foreign_keys = ON;
```

Adicionar esta migração em uma função `runMigrations()` chamada dentro de `initDatabase()`, protegida por verificação de versão (usar `PRAGMA user_version`). Versão atual = 0, após migração = 1.

Em `app/(tabs)/config.tsx`, remover a lógica de delete manual de tickets e tasks antes do delete da empresa em `handleDeleteCompany`.

**Critérios de aceite:**
- [ ] `DELETE FROM companies WHERE id=?` apaga automaticamente tickets, tasks, attachments e timeline relacionados
- [ ] `config.tsx` não contém mais lógica de delete manual em cascata
- [ ] Dados existentes são preservados após a migração
- [ ] `PRAGMA user_version` é atualizado para 1 após migração bem-sucedida

---

### T07 — Substituir Date.now() por Crypto.randomUUID()

**Arquivos:**
- `src/modals/TicketModal.tsx`
- `src/modals/TaskModal.tsx`

**Problema:**
IDs gerados como `tk_${Date.now()}` podem colidir em criações rápidas e causam conflitos em restore de backup (dois dispositivos criando registros no mesmo milissegundo).

**Instrução:**
1. Importar `Crypto` do pacote `expo-crypto` (já disponível no Expo SDK 54, sem instalação adicional).
2. Em `TicketModal.tsx`, substituir a geração de ID por:
   ```typescript
   import * as Crypto from 'expo-crypto';
   const id = `tk_${Crypto.randomUUID()}`;
   ```
3. Em `TaskModal.tsx`, substituir por:
   ```typescript
   const id = `ts_${Crypto.randomUUID()}`;
   ```
4. Buscar no projeto inteiro por `Date.now()` usado para geração de IDs e substituir todos os casos encontrados.

**Critérios de aceite:**
- [ ] IDs de tickets seguem o padrão `tk_<uuid-v4>`
- [ ] IDs de tasks seguem o padrão `ts_<uuid-v4>`
- [ ] Nenhuma referência a `Date.now()` para geração de IDs permanece no projeto
- [ ] `expo-crypto` não precisa ser instalado (já está no SDK 54)

---

### T08 — Adicionar try/catch no parse de schedule_days

**Arquivos:**
- `src/utils/scheduleUtils.ts`
- `src/db/index.ts`

**Problema:**
`schedule_days` é armazenado como string JSON (ex: `"[0,1,4]"`). Se o valor estiver malformado, `JSON.parse` lança exceção não tratada e a tela de Tarefas crasha silenciosamente.

**Instrução:**

Em `src/utils/scheduleUtils.ts`, criar uma função auxiliar:
```typescript
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
```
Substituir todos os `JSON.parse(task.schedule_days)` por `parseDays(task.schedule_days)`.

Em `src/db/index.ts`, aplicar proteção equivalente em qualquer ponto que faça parse de `schedule_days` ao ler do banco.

**Critérios de aceite:**
- [ ] Parse malformado não lança exceção não tratada
- [ ] Tarefa com `schedule_days` inválido é tratada como sem dias configurados (array vazio)
- [ ] Log de aviso é registrado no console para diagnóstico
- [ ] Tarefa com `schedule_days = null` retorna array vazio sem erro

---

### T09 — Reportar anexos pulados no backup

**Dependências:** T01

**Arquivos:**
- `src/utils/backupUtils.ts`

**Problema:**
`exportBackup()` silenciosamente ignora arquivos > 1MB. O usuário exporta, restaura em outro dispositivo e descobre que anexos importantes estão faltando.

**Instrução:**

Em `exportBackup()`:
1. Coletar os anexos pulados em um array: `skipped: Array<{ name: string; size: number }>`.
2. Incluir `skippedAttachments: skipped` no objeto JSON exportado.
3. Após compartilhar o arquivo, se `skipped.length > 0`, retornar a informação no resultado:
   ```typescript
   return {
     success: true,
     skippedCount: skipped.length,
     skippedNames: skipped.map(s => s.name)
   };
   ```
4. Em `app/(tabs)/config.tsx`, ao chamar `exportBackup()`, verificar o retorno e exibir toast diferenciado:
   - Sem pulados: "Backup exportado com sucesso"
   - Com pulados: `"Backup exportado. ${n} anexo(s) não incluído(s) por exceder 1MB"`

**Critérios de aceite:**
- [ ] Toast de export informa quantos arquivos foram pulados
- [ ] Campo `skippedAttachments` presente no JSON exportado quando houver arquivos pulados
- [ ] Export sem arquivos pulados não exibe aviso desnecessário
- [ ] Nome dos arquivos pulados é acessível para diagnóstico

---

## Fase 3 — Performance & robustez
> Otimizações de banco e UI. Executar após a Fase 2.

---

### T10 — Adicionar índice composto em tickets

**Dependências:** T06

**Arquivos:**
- `src/db/index.ts`

**Problema:**
Os filtros mais comuns na listagem de chamados são `company_id + status + created_at`. Índices separados são menos eficientes que um índice composto para este padrão de query.

**Instrução:**
Em `initDatabase()`, dentro do bloco de criação de índices:
```sql
CREATE INDEX IF NOT EXISTS idx_tickets_company_status
ON tickets(company_id, status, created_at DESC);
```
Verificar se já existe um índice separado em `company_id` ou `status` na tabela `tickets`. Se existirem e forem redundantes com o novo índice composto, removê-los com `DROP INDEX IF EXISTS`.

**Critérios de aceite:**
- [ ] Índice composto criado na inicialização do banco
- [ ] `EXPLAIN QUERY PLAN SELECT * FROM tickets WHERE company_id=? AND status=?` não mostra `SCAN TABLE` (deve mostrar `SEARCH TABLE USING INDEX`)
- [ ] Índices separados redundantes removidos

---

### T11 — Fixar dimensões de imagens em AttachmentRow

**Arquivos:**
- `src/components/AttachmentRow.tsx`

**Problema:**
O componente `Image` do thumbnail não tem `width` e `height` explícitos, forçando o React Native a calcular o layout após o carregamento da imagem, causando reflows em listas longas.

**Instrução:**
No componente `AttachmentRow`:
1. Definir o thumbnail com dimensões fixas: `width={48} height={48}`.
2. Adicionar `resizeMode="cover"` ao componente Image.
3. Envolver o componente em `React.memo` para evitar re-renders desnecessários quando props não mudam:
   ```typescript
   export default React.memo(AttachmentRow);
   ```
4. Adicionar `borderRadius` ao thumbnail para consistência visual (ex: `borderRadius: 6`).

**Critérios de aceite:**
- [ ] Thumbnail sempre renderiza com exatamente 48x48 pixels
- [ ] Sem reflow visível ao rolar lista de chamados com anexos
- [ ] Componente exportado com `React.memo`

---

### T12 — Cachear lista de empresas no Zustand

**Arquivos:**
- `src/stores/appStore.ts`
- `app/(tabs)/index.tsx`
- `app/(tabs)/tarefas.tsx`
- `src/modals/CompanyModal.tsx`

**Problema:**
A lista de empresas é recarregada do banco toda vez que o dropdown é aberto em qualquer tela, mesmo sendo raramente alterada.

**Instrução:**

Em `src/stores/appStore.ts`, adicionar ao estado e às actions:
```typescript
// Estado
companies: Company[];

// Actions
loadCompanies: () => void;  // chama companyRepo.getAll() e atualiza o store
```

Em `initDatabase()` (ou no root layout `app/_layout.tsx`), chamar `useAppStore.getState().loadCompanies()` uma vez na inicialização.

Em `src/modals/CompanyModal.tsx`, chamar `loadCompanies()` no callback `onClose` após criar empresa com sucesso.

Em `app/(tabs)/config.tsx`, chamar `loadCompanies()` após deletar empresa.

Em `app/(tabs)/index.tsx` e `app/(tabs)/tarefas.tsx`, substituir a query local de empresas por `const { companies } = useAppStore()`.

**Critérios de aceite:**
- [ ] Nenhuma query ao banco é executada ao abrir o dropdown de empresas
- [ ] Lista é atualizada imediatamente após criar ou deletar empresa
- [ ] Comportamento de seleção de empresa permanece idêntico

---

## Fase 4 — UX quick wins
> Melhorias visíveis ao usuário. Executar após as fases anteriores.

---

### T13 — Adicionar busca na tela de Tarefas

**Arquivos:**
- `app/(tabs)/tarefas.tsx`

**Problema:**
A tela de Tarefas não oferece busca textual. O usuário precisa rolar manualmente para encontrar tarefas em listas longas. O componente `SearchBar` já existe e pode ser reutilizado.

**Instrução:**
Em `app/(tabs)/tarefas.tsx`:
1. Adicionar estado local `showSearch: boolean` e `searchQuery: string`.
2. Adicionar ícone de lupa no header para toggle de `showSearch`.
3. Renderizar `<SearchBar>` condicionalmente quando `showSearch === true`.
4. Filtrar `tasks` antes de renderizar: `tasks.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()))`.
5. Ao fechar a busca (ícone X ou `showSearch = false`), limpar `searchQuery`.
6. Usar debounce de 300ms (consistente com a tela de Chamados).

**Critérios de aceite:**
- [ ] Ícone de lupa no header abre campo de busca
- [ ] Campo filtra tarefas por nome em tempo real (com debounce)
- [ ] Filtros existentes (pendentes, concluídas, rec, one) continuam funcionando em conjunto com a busca
- [ ] Limpar busca restaura lista completa
- [ ] Comportamento visual idêntico à busca na tela de Chamados

---

### T14 — Ordenar tarefas: pendentes primeiro

**Arquivos:**
- `src/db/index.ts`

**Problema:**
`taskRepo.getByCompany()` ordena por `created_at`, misturando tarefas concluídas com pendentes. O usuário precisa procurar visualmente as tarefas que ainda precisam ser feitas.

**Instrução:**
Em `src/db/index.ts`, alterar o `ORDER BY` da query em `taskRepo.getByCompany()` de:
```sql
ORDER BY created_at DESC
```
para:
```sql
ORDER BY is_done ASC, created_at DESC
```
Verificar se `taskRepo.getAll()` tem a mesma issue e aplicar a mesma correção.

**Critérios de aceite:**
- [ ] Tarefas pendentes (`is_done = 0`) sempre aparecem antes das concluídas
- [ ] Dentro de cada grupo, ordem é da mais recente para mais antiga
- [ ] Filtros existentes (rec, one, done, pending) continuam funcionando corretamente
- [ ] Nenhuma mudança visual além da ordenação

---

### T15 — Implementar undo na exclusão de empresa

**Dependências:** T01, T06

**Arquivos:**
- `app/(tabs)/config.tsx`
- `src/utils/backupUtils.ts`

**Problema:**
`showToast` suporta `onUndo` mas `handleDeleteCompany` não passa o callback. Exclusão acidental de empresa é irreversível.

**Instrução:**

Em `backupUtils.ts`, criar uma função auxiliar:
```typescript
snapshotCompany(companyId: number): Promise<string>
```
Que lê empresa + tickets + attachments + timeline + tasks daquela empresa e retorna como JSON string (mesmo formato do backup completo, mas filtrado por empresa).

Em `app/(tabs)/config.tsx`, no `handleDeleteCompany`:
1. Antes do delete, chamar `snapshotCompany(id)` e guardar o resultado.
2. Executar o delete normalmente.
3. Chamar `showToast` com `onUndo: async () => confirmAndImportBackup(snapshot)`.
4. A janela de undo é controlada pelo timeout existente do `UndoToast` (3.5s).

**Critérios de aceite:**
- [ ] Toast de exclusão exibe botão "DESFAZER"
- [ ] Clicar em desfazer restaura empresa e todos os dados associados
- [ ] Sem clique, exclusão é confirmada após o timeout do toast
- [ ] Undo não duplica dados se chamado mais de uma vez (verificar idempotência)

---

### T16 — Chips de sugestão no TransitionModal

**Arquivos:**
- `src/modals/TransitionModal.tsx`

**Problema:**
O técnico frequentemente digita os mesmos comentários em transições de status. Sem sugestões, cada transição requer digitação manual completa.

**Instrução:**

Definir sugestões por status de destino:
```typescript
const SUGGESTIONS: Record<string, string[]> = {
  andamento:  ['Iniciando atendimento', 'Em análise', 'Atualizando o sistema'],
  aguardando: ['Aguardando resposta do cliente', 'Aguardando aprovação', 'Aguardando peça/material'],
  fechado:    ['Problema resolvido', 'Solicitação atendida', 'Sem retorno do cliente'],
  aberto:     ['Reabrindo por solicitação do cliente', 'Problema recorrente'],
};
```

Renderizar os chips como `ScrollView` horizontal acima do `TextInput`:
- Cada chip é um `TouchableOpacity` com label da sugestão.
- Tap no chip chama `setComment(sugestao)` (preenche, não envia).
- Chips visíveis apenas quando existem sugestões para o `newStatus` atual.
- Usar estilo consistente com o restante do modal (bordas, cores do tema).

**Critérios de aceite:**
- [ ] Chips aparecem de acordo com o status de destino da transição
- [ ] Tap no chip preenche o TextInput sem enviar
- [ ] Campo continua aceitando texto livre sem usar chips
- [ ] Scroll horizontal funciona quando há muitos chips
- [ ] Nenhum chip é exibido se não há sugestões para o status

---

### T17 — Corrigir filtro de empresa no período do Stats

**Dependências:** T03

**Arquivos:**
- `src/db/index.ts`
- `app/(tabs)/stats.tsx`

**Problema:**
Os cards de período no Stats ("Esta semana", "Este mês") ignoram a empresa selecionada, enquanto os demais cards respeitam `viewAllCompanies`. Comportamento inconsistente.

**Instrução:**
Esta tarefa depende de T03 (que já adicionou o parâmetro `companyId` ao `getSummary`).

Em `app/(tabs)/stats.tsx`:
1. Ler `currentCompanyId` e `viewAllCompanies` do store.
2. Calcular `effectiveCompanyId = viewAllCompanies ? null : currentCompanyId`.
3. Passar `effectiveCompanyId` em **todas** as chamadas a `getSummary`, incluindo as de período.
4. Verificar que o card "Checklist hoje" de tarefas também respeita a empresa selecionada (verificar `statsRepo.getTaskSummary()`).

**Critérios de aceite:**
- [ ] Todos os cards da tela Stats filtram pela empresa selecionada
- [ ] "Ver todas" no seletor de empresa exibe estatísticas globais em todos os cards
- [ ] Comportamento consistente entre cards de total e cards de período

---

### T18 — Limitar tamanho de comentários (maxLength 500)

**Arquivos:**
- `app/ticket/[id].tsx`
- `src/modals/TransitionModal.tsx`

**Problema:**
TextInput de comentários não tem limite de caracteres. Comentários muito longos poluem a timeline e podem causar problemas de performance na renderização.

**Instrução:**

Em ambos os arquivos:
1. Adicionar `maxLength={500}` no `TextInput` de comentário/anotação.
2. Adicionar estado local `commentLength: number` sincronizado com o valor do input.
3. Renderizar contador abaixo do campo **apenas quando `commentLength >= 400`**:
   ```
   X/500
   ```
   Com cor de aviso (amarelo) entre 400–480, cor de erro (vermelho) entre 481–500.
4. O contador deve desaparecer quando o campo for limpo (< 400 chars).

**Critérios de aceite:**
- [ ] Impossível digitar mais de 500 caracteres no comentário
- [ ] Contador aparece ao atingir 400 caracteres
- [ ] Contador muda para cor de aviso/erro conforme limite se aproxima
- [ ] Contador desaparece ao limpar o campo abaixo de 400 chars
- [ ] Comportamento idêntico em `ticket/[id].tsx` e `TransitionModal.tsx`

---

## Resumo de dependências

```
T01 (transaction) ←── T09 (backup skipped)
T01 (transaction) ←── T15 (undo empresa)
T06 (cascade)     ←── T10 (índice composto)
T06 (cascade)     ←── T15 (undo empresa)
T03 (stats datas) ←── T17 (stats empresa)
T01 (transaction) ←── T05 (usePagination)  [recomendado, não bloqueante]
```

## Ordem de execução recomendada

```
Fase 1:  T01 → T02 → T03 → T04
Fase 2:  T05 → T06 → T07 → T08 → T09
Fase 3:  T10 → T11 → T12
Fase 4:  T13 → T14 → T15 → T16 → T17 → T18
```

---

*Gerado em: 2026-04-20 | App: Helpdesk TI v2 | Expo SDK 54*
