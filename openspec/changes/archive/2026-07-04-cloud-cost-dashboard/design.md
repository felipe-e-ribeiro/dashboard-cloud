## Context

Projeto novo (greenfield), uso pessoal de um único usuário, monitorando uma única conta AWS e uma única tenancy OCI. O design completo foi validado com o usuário via brainstorming e está registrado em `docs/superpowers/specs/2026-07-04-cloud-cost-dashboard-design.md`. Este documento traduz essas decisões em termos técnicos para orientar a implementação.

Stack escolhida pelo usuário: **Python (FastAPI) no backend + React (Vite) no frontend + PostgreSQL**, tudo orquestrado via docker-compose.

## Goals / Non-Goals

**Goals:**
- Autenticar um único usuário via console de login local (usuário/senha) antes de exibir qualquer dado de custo.
- Sincronizar diariamente, de forma automática e isolada por provider, os custos por serviço/dia da AWS (Cost Explorer) e da OCI (Usage API) para PostgreSQL.
- Fazer backfill dos últimos 6 meses fechados + mês corrente na primeira sincronização de cada provider.
- Expor API de leitura (totais, tendência, breakdown por serviço) filtrável por cloud e período (mês atual / últimos 6 meses).
- UI em abas "AWS" / "Oracle Cloud", cada uma com gráfico de tendência, tabela de breakdown e indicador de última sincronização (com aviso em caso de falha).
- Rodar em docker-compose com 3 serviços: `postgres`, `backend`, `frontend`.

**Non-Goals:**
- Multi-usuário / multi-tenant.
- Login OAuth (Google) — apenas reservar o campo `auth_provider` no schema para adição futura.
- Múltiplas contas AWS (Organizations) ou múltiplos compartments/tenancies OCI.
- Orçamentos e alertas de gasto.
- Upload manual de CSV/relatório.
- Botão de "sincronizar agora" manual — apenas o job diário agendado.

## Decisions

### 1. Scheduler embutido no backend (APScheduler) em vez de container/worker separado
O volume de trabalho (1 sync por dia, 2 chamadas de API) não justifica um worker dedicado (ex: Celery + Redis). Rodar o job dentro do próprio processo FastAPI com APScheduler reduz a complexidade operacional do docker-compose (menos um serviço, sem broker de mensagens).
**Alternativa considerada:** cron externo/container separado chamando um script — rejeitado por adicionar um serviço extra sem necessidade real na v1.

### 2. Credenciais via variáveis de ambiente + volume (não no banco)
AWS usa três variáveis simples (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`). OCI exige tenancy/user OCID, fingerprint e uma chave privada PEM — a chave é montada como arquivo via volume do docker-compose (não como variável de ambiente), reduzindo o risco de vazamento em logs/inspeção de containers.
**Alternativa considerada:** cadastro de credenciais via tela na aplicação, criptografadas no Postgres — rejeitado por adicionar complexidade (gestão de chave de criptografia, tela de configuração) sem necessidade, dado uso pessoal com um único conjunto de credenciais.

### 3. Modelo de dados normalizado por `(provider, service_name, usage_date)`
`cost_records` guarda uma linha por serviço/dia/provider com constraint `unique(provider, service_name, usage_date)`, permitindo upsert idempotente a cada sync (reprocessar um dia não duplica dados) e agregação simples por período/serviço via `SUM`/`GROUP BY`.
**Alternativa considerada:** guardar o payload bruto da API em JSONB e agregar em tempo de leitura — rejeitado por ser mais lento para leitura (que é o caminho mais frequente, já que sync roda 1x/dia mas leitura acontece a cada acesso ao dashboard).

### 4. `sync_runs` como tabela de auditoria separada
Cada execução do job (por provider) grava status/erro/quantidade de registros. Isso alimenta o indicador "última sincronização" na UI sem acoplar esse estado à tabela de dados (`cost_records`), e permite diagnosticar falhas sem depender de logs do container.

### 5. Falha de sync isolada por provider, nunca propaga para a API de leitura
A API `/api/costs/*` sempre lê o que já está persistido — nunca chama AWS/OCI em tempo de request. Isso garante que uma falha de sync (credencial expirada, rate limit) nunca derruba o dashboard; o pior caso é mostrar dados desatualizados com aviso visível.

### 6. Autenticação local com JWT em cookie httpOnly; usuário seedado via env vars
Sem tela pública de cadastro — o único usuário é criado no primeiro start via `ADMIN_USERNAME`/`ADMIN_PASSWORD`. `auth_provider` fica gravado como `'local'` desde já para não exigir migração de schema quando OAuth for adicionado no futuro.

## Risks / Trade-offs

- **[Risco] Rate limiting das APIs de Cost Explorer/OCI Usage durante o backfill inicial (6 meses de uma vez)** → Mitigação: paginar as chamadas por mês e tratar erros de rate limit com retry/backoff no job, sem falhar o sync inteiro por um mês que deu erro.
- **[Risco] Chave privada OCI montada via volume pode ser esquecida/mal configurada, quebrando só o sync da OCI** → Mitigação: `sync_runs` grava o erro claramente, e a falha fica isolada — dashboard AWS continua funcionando normalmente.
- **[Trade-off] Sem sync manual sob demanda** → Se o usuário quiser dados mais recentes que o último sync diário, precisa esperar a próxima execução agendada. Aceito pelo usuário como não-goal da v1.
- **[Trade-off] Um único usuário/credencial hardcoded via env** → Simplicidade em troca de não suportar múltiplos usuários; aceitável pois o uso é pessoal.

## Migration Plan

Não há sistema anterior — é a criação inicial do projeto. Passos de deploy:
1. Subir `docker-compose up` com `.env` preenchido (credenciais AWS/OCI, admin, JWT secret) e a chave PEM da OCI montada via volume.
2. Backend roda migrations (Alembic) automaticamente no start, criando `users`, `cost_records`, `sync_runs`, e semeia o usuário admin se não existir.
3. Primeira execução do job de sync (ou disparo manual do primeiro sync no boot) realiza o backfill de 6 meses para AWS e OCI.
4. Sem rollback complexo necessário — ambiente é local/pessoal; rollback = `docker-compose down` e restaurar volume do Postgres de backup, se existir.

## Open Questions

Nenhuma pendente — todas as decisões de escopo e arquitetura foram validadas com o usuário durante o brainstorming (ver `docs/superpowers/specs/2026-07-04-cloud-cost-dashboard-design.md`).
