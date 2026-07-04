## Context

O Cloud Cost Dashboard hoje só sincroniza custos via job diário do APScheduler (03:00), com falhas registradas em `sync_runs` mas sem forma de forçar um novo sync ou consultar o histórico pela UI. Uso real revelou que esperar até o dia seguinte para reprocessar (ex.: após corrigir uma credencial ou investigar uma falha da OCI) atrapalha o dia a dia. Este design foi validado com o usuário via brainstorming e está em `docs/superpowers/specs/2026-07-04-manual-sync-and-logs-design.md`.

## Goals / Non-Goals

**Goals:**
- Permitir disparar manualmente o sync de um provider (AWS ou OCI) a partir do dashboard, sem travar a requisição HTTP pelo tempo (até ~9 min) que a OCI pode levar.
- Impedir dois syncs concorrentes do mesmo provider.
- Expor uma página com o histórico das últimas 20 execuções de sync por provider.

**Non-Goals:**
- Cancelar um sync em andamento.
- Sync manual combinado (AWS+OCI de uma vez).
- Paginação além das 20 execuções mais recentes.
- Notificações de conclusão (e-mail/push).

## Decisions

### 1. Thread em background em vez de fila de tarefas (Celery/RQ)
Volume de uso é baixíssimo (cliques manuais ocasionais). Uma `threading.Thread` chamando a mesma `sync_provider()` já usada pelo job diário evita adicionar broker/worker só para isso.
**Alternativa considerada:** `BackgroundTasks` do FastAPI — roda após a resposta, mas ainda dentro do ciclo de vida do worker Uvicorn; para uma tarefa de até ~9 min isso arrisca conflitar com timeouts do servidor. Uma thread própria e desacoplada é mais segura.

### 2. Concorrência detectada via `sync_runs`, não via lock em memória
`sync_provider()` já grava um `sync_runs` com `status='running'` no início da execução. O endpoint de trigger reaproveita isso: se existir um `running` sem `finished_at` para o provider, retorna 409 em vez de iniciar outro.
**Alternativa considerada:** lock em memória (`dict` global) — rejeitado porque se o processo reiniciar no meio de um sync, o lock em memória se perde de forma inconsistente com o estado real, enquanto o `sync_runs` persistido reflete o estado real do banco.

### 3. Polling no frontend em vez de WebSocket/SSE
Sync manual é um evento raro com o usuário olhando ativamente a tela. Polling a cada ~3s em `GET /api/sync/status` é suficiente e não exige infraestrutura de WebSocket/SSE.

## Risks / Trade-offs

- **[Risco] Processo do backend reinicia no meio de um sync** → `sync_runs` fica com `status='running'` órfão, bloqueando novos triggers manuais daquele provider. **Mitigação:** aceito como risco de v1; documentar no README como corrigir manualmente (`UPDATE sync_runs SET status='failed' WHERE status='running'`).
- **[Trade-off] Sem cancelamento de sync em andamento** → usuário precisa esperar terminar se disparar por engano. Aceitável dado o baixo volume de uso pessoal.

## Migration Plan

Sem migração de dados — reaproveita o schema existente de `sync_runs` (nenhuma coluna nova). Deploy é só a atualização normal do backend/frontend via `docker compose up -d --build`. Rollback: reverter para a imagem anterior; nenhum dado é alterado de forma incompatível.

## Open Questions

Nenhuma pendente — decisões de escopo e concorrência já validadas com o usuário durante o brainstorming.
