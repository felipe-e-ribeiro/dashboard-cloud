## Why

Custos de nuvem hoje ficam espalhados entre o console da AWS e o console da Oracle Cloud (OCI), exigindo login manual em cada um para acompanhar o gasto. Precisamos de um único dashboard autenticado que puxe os custos das duas clouds automaticamente e mostre tendência e breakdown por serviço em um só lugar.

## What Changes

- Nova aplicação (backend FastAPI + frontend React + PostgreSQL) rodando via docker-compose.
- Console de login local (usuário/senha), com sessão via JWT; schema de usuário já preparado para um provider OAuth futuro (não implementado agora).
- Job diário de sincronização que busca custos por serviço/dia na AWS Cost Explorer (via `boto3`) e na OCI Usage API (via SDK OCI), com backfill dos últimos 6 meses fechados na primeira execução.
- API de leitura de custos (totais, tendência e breakdown por serviço) filtrável por cloud e por período (mês atual / últimos 6 meses).
- Dashboard com abas "AWS" e "Oracle Cloud", cada uma com gráfico de tendência, tabela de breakdown por serviço e indicador de última sincronização (com aviso caso a última sincronização tenha falhado).

## Capabilities

### New Capabilities
- `auth`: login local com usuário/senha, sessão via JWT em cookie httpOnly, usuário admin único seedado via variáveis de ambiente.
- `cost-sync`: job diário isolado por provider (AWS/OCI) que busca custos das APIs de billing e faz upsert em PostgreSQL, com backfill inicial de 6 meses e registro de sucesso/falha por execução.
- `cost-dashboard`: API de leitura (totais/tendência/breakdown por serviço, por cloud e período) e UI React em abas para visualizar os custos sincronizados.

### Modified Capabilities
(nenhuma — projeto novo, sem specs existentes)

## Impact

- Novo repositório de código: `backend/` (FastAPI, SQLAlchemy, Alembic, APScheduler, boto3, OCI SDK), `frontend/` (React + Vite + Recharts), `docker-compose.yml`.
- Nova infraestrutura: container PostgreSQL com volume persistente.
- Novas dependências externas: credenciais AWS (access key/secret) e credenciais OCI (tenancy/user OCID, fingerprint, chave privada PEM montada via volume), fornecidas via variáveis de ambiente do backend.
- Sem impacto em sistemas existentes — é a criação inicial do projeto.
