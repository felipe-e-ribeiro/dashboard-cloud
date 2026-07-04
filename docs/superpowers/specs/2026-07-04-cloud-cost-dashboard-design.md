# Cloud Cost Dashboard — Design

## Contexto e Objetivo

Aplicação web para monitorar, em um único lugar, os custos de duas clouds — **AWS** e **Oracle Cloud (OCI)** — de uma única conta AWS e uma única tenancy OCI, para uso pessoal (um único usuário). O sistema puxa os dados automaticamente das APIs de billing de cada provedor, armazena em PostgreSQL, e apresenta em um dashboard autenticado.

## Escopo da v1

- Um único usuário (login local), sem multi-tenant.
- Uma conta AWS + uma tenancy OCI (sem AWS Organizations / múltiplos compartments).
- Sincronização automática diária via API — sem upload manual de relatórios.
- Visão: total + tendência + breakdown por serviço, para mês atual e últimos 6 meses fechados.
- Sem orçamentos/alertas, sem OAuth (mas schema já preparado para adicionar depois), sem botão de "sincronizar agora".

## Arquitetura

```
┌─────────────┐      HTTPS       ┌──────────────────┐        ┌────────────┐
│   Frontend  │ ───────────────► │     Backend       │ ────► │ PostgreSQL │
│  React+Vite │ ◄─────────────── │   FastAPI + JWT   │ ◄───── │            │
└─────────────┘                  │  APScheduler(job) │        └────────────┘
                                  └─────────┬─────────┘
                                            │ daily sync
                          ┌─────────────────┼─────────────────┐
                          ▼                                   ▼
                AWS Cost Explorer API                 OCI Usage API
                    (boto3)                            (oci python sdk)
```

- **Frontend**: React (Vite), abas "AWS" / "Oracle Cloud". Cada aba mostra: gráfico de tendência (Recharts), tabela de breakdown por serviço, seletor de período (mês atual / últimos 6 meses), indicador de "última sincronização".
- **Backend**: FastAPI. Responsável por autenticação, API de leitura de custos, e o job de sincronização diário (APScheduler embutido no processo — sem container/worker separado).
- **Banco**: PostgreSQL. Guarda usuários e custos já sincronizados. Nenhuma credencial de nuvem é armazenada no banco.

### Credenciais de nuvem

- **AWS**: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` como variáveis de ambiente do container backend.
- **OCI**: `OCI_TENANCY_OCID`, `OCI_USER_OCID`, `OCI_FINGERPRINT`, `OCI_REGION` como variáveis de ambiente; a chave privada PEM é montada como arquivo via volume do docker-compose (não fica em variável de ambiente) e referenciada por `OCI_KEY_FILE_PATH`.
- Nenhuma tela de cadastro de credenciais na v1 — tudo configurado via `.env`/volumes no docker-compose.

## Modelo de Dados

```sql
users
  id              serial PK
  username        text unique
  password_hash   text
  auth_provider   text default 'local'   -- preparado para 'google' no futuro
  created_at      timestamptz

cost_records
  id              serial PK
  provider        text        -- 'aws' | 'oci'
  service_name    text
  usage_date      date
  amount          numeric
  currency        text        -- 'USD'
  synced_at       timestamptz
  unique(provider, service_name, usage_date)

sync_runs
  id              serial PK
  provider        text        -- 'aws' | 'oci'
  started_at      timestamptz
  finished_at     timestamptz
  status          text        -- 'success' | 'failed'
  error_message   text null
  records_synced  int
```

`cost_records` é a fonte de verdade para os gráficos e tabelas; `sync_runs` alimenta o indicador de "última sincronização" e o aviso de falha na UI.

## API

- `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` — sessão via JWT em cookie httpOnly.
- `GET /api/costs/summary?provider=aws|oci&period=current_month|last_6_months` — total do período + série de tendência (por dia/mês).
- `GET /api/costs/breakdown?provider=aws|oci&period=...` — gasto agrupado por serviço no período.
- `GET /api/sync/status?provider=aws|oci` — último `sync_runs` (timestamp, status, erro) para exibir na UI.

O usuário admin é criado automaticamente no primeiro start do backend a partir de `ADMIN_USERNAME`/`ADMIN_PASSWORD` (env vars) — não há tela pública de cadastro.

## Sincronização Diária

- Job único do APScheduler roda 1x/dia (horário configurável, ex. 03:00) e executa, em sequência e de forma isolada:
  1. Sync AWS: busca custo por serviço/dia via Cost Explorer (`boto3`) para o período não coberto ainda.
  2. Sync OCI: busca custo por serviço/dia via OCI Usage API (`oci` SDK) para o mesmo período.
- Cada sync grava um registro em `sync_runs` (sucesso ou falha com mensagem de erro) e faz upsert em `cost_records`.
- Falha em uma cloud **não** impede a outra de rodar, e não derruba a aplicação — o dashboard continua servindo os últimos dados disponíveis.
- **Backfill inicial**: na primeira execução (banco vazio para aquele provider), o job busca os últimos 6 meses fechados + mês corrente, em vez de só o dia atual.

## UI — Fluxo e Layout

- **Login**: tela split (metade branding/ilustração, metade formulário usuário/senha). Local apenas na v1; espaço reservado (mas não implementado) para um botão "Entrar com Google" futuro.
- **Dashboard**: layout em abas — uma aba "AWS", uma aba "Oracle Cloud". Cada aba independente contém:
  - Seletor de período (mês atual / últimos 6 meses)
  - Indicador "última sincronização: <data/hora>" (+ aviso visual se o último sync falhou)
  - Gráfico de tendência de custo no período
  - Tabela de breakdown por serviço

## Tratamento de Erros

- Falhas de sync (credencial inválida, rate limit, timeout) são capturadas por provider, gravadas em `sync_runs.error_message`, sem propagar exceção que derrube o processo ou o outro sync.
- A API de leitura (`/api/costs/*`) nunca falha por causa de um sync ruim — sempre retorna os dados mais recentes persistidos, mesmo que desatualizados.
- Frontend exibe aviso não bloqueante quando `sync_runs` mais recente daquele provider está `failed`.

## Testes

- **Backend**: pytest — respostas da AWS Cost Explorer e da OCI Usage API são mockadas (nenhuma chamada real de rede em teste); cobre agregação por período/serviço, upsert idempotente em `cost_records`, e fluxo de login/logout/sessão.
- **Frontend**: Vitest + React Testing Library — componentes de gráfico/tabela renderizados com dados mockados da API; fluxo de login.

## Docker Compose (ambiente inicial)

- `postgres` — imagem oficial `postgres`, volume nomeado para persistência, envs `POSTGRES_USER/PASSWORD/DB`.
- `backend` — FastAPI/Uvicorn, `depends_on: postgres`, envs: `DATABASE_URL`, `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `OCI_TENANCY_OCID`, `OCI_USER_OCID`, `OCI_FINGERPRINT`, `OCI_REGION`, `OCI_KEY_FILE_PATH`; volume mapeando a chave PEM da OCI para dentro do container.
- `frontend` — build React servido (Nginx ou `vite preview`), proxy de `/api` para o backend.

## Fora de Escopo (v1)

- Multi-usuário / multi-tenant.
- Login via OAuth/Google (schema em `users.auth_provider` já preparado, mas não implementado).
- Orçamentos e alertas de gasto.
- Upload manual de CSV/relatório.
- Múltiplas contas AWS (Organizations) ou múltiplos compartments/tenancies OCI.
- Botão de "sincronizar agora" manual (só o job diário agendado).
