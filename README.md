# Cloud Cost Dashboard

Dashboard pessoal de custos AWS + Oracle Cloud (OCI), com login local, sincronização diária automática (e manual) e visualização por serviço. Ver `openspec/specs/` para as specs canônicas e `openspec/changes/archive/` / `openspec/changes/` para o histórico de mudanças.

## Stack

- **Backend**: FastAPI + SQLAlchemy + Alembic + APScheduler (Python)
- **Frontend**: React + Vite + Recharts
- **Banco**: PostgreSQL
- **Orquestração**: docker-compose

## Configuração

1. Copie `.env.example` para `.env` e preencha os valores:
   - `POSTGRES_*` / `DATABASE_URL`: banco de dados
   - `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`: autenticação local (troque `ADMIN_PASSWORD` do valor de exemplo antes de expor a aplicação além do localhost)
   - `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION`: uma IAM key **somente leitura** (Cost Explorer)
   - `OCI_TENANCY_OCID` / `OCI_USER_OCID` / `OCI_FINGERPRINT` / `OCI_REGION`: credenciais da OCI

2. Coloque a chave privada PEM da OCI em `secrets/oci_key.pem` (ver `secrets/README.md`). Esse arquivo nunca é commitado.

3. Suba tudo:

   ```sh
   docker compose up -d --build
   ```

   - Frontend: http://localhost:8080
   - Backend (API direta): porta definida em `docker-compose.yml` (ajuste se já houver algo rodando na porta padrão)

O backend roda as migrations do Alembic e cria o usuário admin automaticamente no primeiro start.

## Sincronização de custos

- Um job diário (APScheduler, 03:00) busca os custos da AWS (Cost Explorer) e da OCI (Usage API) e grava em `cost_records`.
- Na primeira sincronização de cada provider, é feito um backfill dos últimos 6 meses fechados + mês atual.
- Falha em uma cloud nunca bloqueia a outra; o resultado de cada execução fica em `sync_runs` e aparece no dashboard como aviso não bloqueante.
- A API da OCI Usage limita consultas `DAILY` a no máximo ~93 dias por chamada — o backfill de 6 meses é paginado automaticamente em blocos de até 90 dias.
- Cada aba do dashboard tem um botão **"Sincronizar agora"** para forçar o sync daquele provider sob demanda (assíncrono; o botão fica desabilitado até terminar). Um segundo clique enquanto já há um sync em andamento para o mesmo provider é rejeitado (409).
- O botão **"Ver logs de sync"** no cabeçalho leva a `/sync-logs`, com o histórico das últimas 20 execuções por provider.
- **Recuperação manual**: se o backend for reiniciado no meio de um sync, a linha correspondente em `sync_runs` fica presa em `status='running'`, bloqueando novos triggers manuais daquele provider. Para liberar:
  ```sql
  UPDATE sync_runs SET status = 'failed', finished_at = now() WHERE status = 'running';
  ```

## Testes

```sh
# Backend
cd backend
python -m venv .venv && source .venv/Scripts/activate  # ou .venv/bin/activate no Linux/Mac
pip install -r requirements-dev.txt
pytest

# Frontend
cd frontend
npm install
npm test
```

## Estrutura

```
backend/    FastAPI, modelos, auth, sync AWS/OCI, API de custos
frontend/   React (login, dashboard em abas AWS/Oracle Cloud)
secrets/    Chave privada OCI (gitignored)
openspec/   Proposta, design e specs desta mudança
```
