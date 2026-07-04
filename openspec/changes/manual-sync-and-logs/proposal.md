## Why

O job diário de sync (03:00) é a única forma de atualizar os custos hoje. Isso torna difícil testar ou diagnosticar problemas de sincronização sem esperar até o dia seguinte — como aconteceu ao investigar uma falha real da OCI Usage API. Esta mudança reverte o não-goal original "sem botão de sincronizar agora" e adiciona um trigger manual por provider, além de uma página para consultar o histórico de execuções.

## What Changes

- Novo endpoint `POST /api/sync/trigger?provider=aws|oci` que dispara `sync_provider()` em uma thread em background e responde imediatamente, bloqueando (409) se já houver um sync `running` para aquele provider.
- Novo endpoint `GET /api/sync/logs?provider=aws|oci` retornando as últimas 20 execuções de `sync_runs` daquele provider.
- Botão "Sincronizar agora" em cada aba do dashboard (AWS / Oracle Cloud), com polling de status até o sync terminar.
- Nova página `/sync-logs` (abas AWS / Oracle Cloud) com uma tabela do histórico de sync de cada provider, acessível por um botão no cabeçalho do dashboard.

## Capabilities

### New Capabilities
(nenhuma nova — esta mudança estende capabilities existentes)

### Modified Capabilities
- `cost-sync`: adiciona a possibilidade de disparar o sync manualmente por provider, com proteção contra execução concorrente do mesmo provider.
- `cost-dashboard`: adiciona endpoint de histórico de sync, botão de sync manual por aba, e a página `/sync-logs`.

## Impact

- Backend: novo router/endpoints de sync (`trigger`, `logs`), reaproveitando `sync_provider()` já existente; execução em thread própria (sem novo serviço de infraestrutura).
- Frontend: novo componente de botão de sync com polling nas abas do dashboard; nova rota/página `/sync-logs` com tabelas de histórico.
- Sem mudança de infraestrutura (mesmo backend/frontend/Postgres do docker-compose atual).
