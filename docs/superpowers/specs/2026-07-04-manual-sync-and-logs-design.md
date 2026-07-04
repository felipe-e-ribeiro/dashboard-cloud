# Manual Sync Trigger + Sync Logs Page — Design

## Contexto e Objetivo

O design original do Cloud Cost Dashboard (`2026-07-04-cloud-cost-dashboard-design.md`) definiu explicitamente como fora de escopo da v1: *"Botão de 'sincronizar agora' manual (só o job diário agendado)"*. Após uso real, ficou claro que esperar o job diário (03:00) para ver dados atualizados, ou para diagnosticar uma falha de sync (como a que vimos hoje na OCI), não é suficiente. Esta mudança **reverte esse não-goal**, adicionando:

1. Um botão por aba para forçar a sincronização de um provider sob demanda.
2. Uma página com o histórico das últimas execuções de sync, por provider.

## Escopo

- Trigger manual de sync por provider (AWS ou OCI, um de cada vez).
- Execução assíncrona (a chamada HTTP não pode travar os até ~9 minutos que um sync da OCI pode levar).
- Bloqueio de sync concorrente para o mesmo provider (um sync em andamento impede outro do mesmo provider).
- Página `/sync-logs` com abas AWS / Oracle Cloud, cada uma mostrando as últimas 20 execuções.

**Fora de escopo:** cancelar um sync em andamento, sync manual "combinado" (AWS+OCI de uma vez só), paginação além das 20 execuções mais recentes, notificações (e-mail/push) de conclusão do sync.

## Arquitetura

Nenhum componente novo de infraestrutura — tudo dentro do backend FastAPI já existente:

- **Trigger assíncrono**: o endpoint spawna uma thread Python (`threading.Thread`) que chama a mesma função `sync_provider()` já usada pelo job diário do APScheduler, com sua própria `SessionLocal()`. Reaproveita 100% da lógica de sync, upsert e tratamento de erro já implementada e testada.
- **Detecção de concorrência**: antes de iniciar, o endpoint verifica se existe um `sync_runs` para aquele provider com `status = 'running'` e `finished_at IS NULL`. Se existir, retorna `409 Conflict` sem criar um novo run. Isso reaproveita o campo `status` que `sync_provider()` já grava no início da execução — não é necessário nenhum estado novo.
- **Logs**: consulta simples em `sync_runs` filtrando por provider, ordenando por `started_at DESC`, limitando a 20 linhas.

## Decisões

### 1. Thread em background em vez de fila de tarefas (Celery/RQ)
Mesmo raciocínio do design original: volume baixíssimo (poucos cliques manuais por dia, no máximo), então uma thread simples dentro do próprio processo é suficiente e evita adicionar infraestrutura (broker, worker) só para isso.
**Alternativa considerada:** `BackgroundTasks` do FastAPI — rejeitada porque `BackgroundTasks` roda *depois* da resposta ser enviada, mas ainda dentro do mesmo request/worker do Uvicorn; para um sync de até ~9 minutos isso arrisca conflitar com o timeout do worker. Uma thread própria, desacoplada do ciclo de vida do request, é mais segura para uma tarefa longa.

### 2. Concorrência detectada via `sync_runs`, não via lock em memória
Um lock em memória (ex: `dict` global) se perderia se o processo reiniciasse no meio de um sync, deixando o provider "travado" para sempre. Consultar o próprio `sync_runs` (que é persistido) é mais robusto: se o processo cair no meio de um sync, o próximo `GET` simplesmente veria o `running` órfão — isso é um risco aceito (ver Riscos abaixo), mas menos frequente e mais fácil de corrigir manualmente (via SQL) do que um deadlock silencioso em memória.

### 3. Polling no frontend em vez de WebSocket/SSE
Um sync manual é um evento raro e o usuário está olhando ativamente a tela — polling simples a cada ~3s em `GET /api/sync/status` é suficiente e não exige adicionar WebSocket/SSE à aplicação.

## Riscos / Trade-offs

- **[Risco] Processo do backend reinicia no meio de um sync** → o `sync_runs` fica com `status='running'` para sempre (órfão), bloqueando novos triggers manuais daquele provider até alguém corrigir manualmente. **Mitigação:** aceito como risco de v1 (reinícios são raros em uso pessoal); documentar no README como corrigir (`UPDATE sync_runs SET status='failed' WHERE status='running'`).
- **[Trade-off] Sem cancelamento de sync em andamento** → se o usuário disparar um sync por engano, precisa esperar terminar. Aceitável dado o baixo volume de uso.

## Requisitos de API

- `POST /api/sync/trigger?provider=aws|oci` → `202 {"status": "started"}` ou `409` se já houver um sync `running` para aquele provider.
- `GET /api/sync/logs?provider=aws|oci` → lista das últimas 20 execuções (`started_at`, `finished_at`, `status`, `records_synced`, `error_message`), mais recente primeiro.

## UI

- Botão "Sincronizar agora" em cada aba do dashboard, ao lado do indicador de última sincronização; desabilitado com texto "Sincronizando..." enquanto o status do provider é `running`.
- Botão "Ver logs de sync" no cabeçalho do dashboard, ao lado de "Sair", levando a `/sync-logs`.
- Página `/sync-logs`: mesma estrutura de abas AWS/Oracle Cloud do dashboard, cada uma com uma tabela das últimas 20 execuções (data/hora de início, duração até `finished_at`, status, registros sincronizados, mensagem de erro quando houver).
