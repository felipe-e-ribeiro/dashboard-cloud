# Web-Based Provider Configuration + Enable/Disable — Design

## Contexto e Objetivo

Hoje as credenciais de AWS (access key/secret) e Oracle Cloud (OCIDs, fingerprint, região, chave privada PEM) vêm inteiramente de `.env` e de um arquivo montado no container (`secrets/oci_key.pem`), geridas fora da aplicação. O usuário quer configurá-las por uma tela web no próprio dashboard, e poder ativar/desativar cada cloud individualmente. Como essas credenciais dão acesso total às contas de nuvem do usuário, esta mudança envolve decisões de segurança reais (armazenamento cifrado, nunca reexibir segredos, validação antes de aceitar) que foram discutidas e decididas com o usuário antes deste design.

## Escopo

- Nova tela `/settings` com um card por provider (AWS, OCI): toggle ativo/inativo, formulário de credenciais, teste de conexão ao salvar, indicador da última validação.
- Persistência das credenciais no Postgres, cifradas em repouso com uma chave mestra nova (`SECRETS_ENCRYPTION_KEY`, env var, nunca no banco).
- `.env`/`secrets/oci_key.pem` deixam de ser a fonte de credenciais de cloud — substituição total, sem fallback.
- Sync diário e manual passam a checar `enabled` por provider antes de rodar; provider desativado some da navegação (abas do Dashboard, cards da Visão Geral, abas do Sync Logs).
- Validação síncrona ao salvar: chama o fetcher real (`fetch_daily_costs_by_service`) com um intervalo de 1 dia; só persiste se a chamada funcionar.

**Fora de escopo:** múltiplas contas por cloud, rotação automática de credenciais, reexibição de qualquer campo já salvo (secreto ou não), backfill automático do período em que um provider ficou desativado ao reativá-lo.

## Arquitetura

### Modelo de dados

Nova tabela `cloud_provider_configs`:
- `provider` (PK, `"aws"` ou `"oci"`)
- `enabled: bool` (default `false`)
- `encrypted_config: bytes` — um JSON serializado com os campos específicos daquele provider (AWS: `access_key_id`, `secret_access_key`, `region`; OCI: `tenancy_ocid`, `user_ocid`, `fingerprint`, `region`, `private_key_pem`), cifrado inteiro como um blob único via Fernet (`cryptography` lib) — evita cifrar/decifrar campo a campo.
- `last_validated_at: datetime | None`
- `last_validation_status: "success" | "failed" | None`
- `last_validation_error: str | None`

Sem linha para um provider = não configurado (`configured=false`, `enabled` sempre `false` nesse caso).

### Criptografia

`SECRETS_ENCRYPTION_KEY` é uma env var obrigatória nova (chave Fernet — 32 bytes urlsafe-base64, gerada uma vez com `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`). O backend falha ao subir (mesmo padrão de `JWT_SECRET`/`DATABASE_URL` hoje, via `pydantic-settings`) se ela não estiver definida. Um módulo novo `app/services/secrets_crypto.py` expõe `encrypt(dict) -> bytes` / `decrypt(bytes) -> dict`, usado só por `app/services/provider_config.py` (camada de acesso à tabela nova) — nenhum outro módulo lida com cifra diretamente.

### Sync: credenciais deixam de vir de `settings`

`aws_cost.py::fetch_daily_costs_by_service` e `oci_cost.py::fetch_daily_costs_by_service` ganham um parâmetro `credentials: dict` (os mesmos campos hoje lidos de `settings.aws_*`/`settings.oci_*`), em vez de importar `settings` diretamente. `sync_provider()` (em `sync.py`) passa a:
1. Checar `provider_config.is_enabled(db, provider)` — se `false`, retorna sem criar `sync_runs` (provider desativado é tratado como "não existe" para o sync, não como uma falha).
2. Buscar e decifrar a config via `provider_config.get_decrypted(db, provider)`.
3. Passar essas credenciais para o fetcher, como já faz hoje (só que vindo do banco, não de `settings`).

O agendador diário (`scheduler.py`) e o trigger manual (`POST /api/sync/trigger`) continuam iguais — a checagem de `enabled` fica dentro de `sync_provider()`, então nenhum dos dois pontos de entrada precisa saber sobre providers desativados.

### Validação ao salvar

`PUT /api/settings/providers/{provider}` chama o mesmo fetcher de produção (`fetch_daily_costs_by_service(today, today, credentials=...)`) antes de persistir qualquer coisa. Se a chamada levantar exceção, a config **não é salva**, e a resposta retorna o erro (mesmo tratamento de mensagem já usado em `sync.py`: prefere `.message` quando existe, como no caso da OCI). Se funcionar, cifra e faz upsert em `cloud_provider_configs` com `last_validation_status="success"`.

## Decisões

### 1. Um blob JSON cifrado por provider, não colunas cifradas por campo
Menos código de cifra/decifra espalhado, e os campos de cada provider são todos usados juntos (nunca faz sentido ler só o `fingerprint` sem o resto) — não há benefício em cifrar campo a campo aqui.

### 2. Chave de criptografia em env var, nunca no banco
Se a chave estivesse no mesmo banco que os dados cifrados, um vazamento do banco (ex: backup) exporia tudo. Uma env var separada (como `JWT_SECRET` já é hoje) mantém a chave fora do que normalmente vaza junto com o banco.

### 3. Validação reaproveitando o fetcher real, não uma chamada "leve" separada
Uma chamada como `sts.get_caller_identity()` na AWS confirmaria que as chaves são válidas, mas não que têm a permissão específica de Cost Explorer usada pelo sync real — um erro de permissão só apareceria depois, no sync diário. Chamar o fetcher de verdade (com um intervalo de 1 dia) testa exatamente o caminho que importa, ao custo de uma chamada ligeiramente mais lenta ao salvar.

### 4. Nunca reexibir nenhum campo já salvo (secreto ou não)
Mais simples de implementar e de raciocinar sobre segurança do que decidir campo a campo o que é "seguro" mostrar — o formulário de edição é sempre um formulário em branco; para trocar qualquer coisa, o usuário preenche tudo de novo. `GET /api/settings/providers` só informa `configured`/`enabled`/status da última validação, nunca os valores.

### 5. `.env` deixa de ser lido para credenciais de cloud — sem fallback
Manter as duas fontes coexistindo (banco + env) criaria ambiguidade sobre qual vence e forçaria testar os dois caminhos para sempre. Substituição total é mais simples de manter; o custo (o usuário precisa re-digitar as credenciais atuais uma vez, na primeira configuração) é aceito.

### 6. Desativar = some da navegação, sem apagar dados
`ProviderTabs` (Dashboard, Sync Logs) e os cards da Visão Geral passam a filtrar por `enabled`. Os `cost_records` já sincronizados de um provider desativado continuam no banco intocados — reativar não precisa de nenhuma migração de dados, só volta a aparecer com o que já tinha (mais o que sincronizar dali em diante).

## Riscos / Trade-offs

- **[Risco] `SECRETS_ENCRYPTION_KEY` perdida** → todas as credenciais cifradas ficam irrecuperáveis (mesma natureza de risco que perder `JWT_SECRET` hoje, só que agora com um blast radius maior). Mitigação: documentar claramente no README que essa chave, uma vez gerada, deve ser tratada como segredo permanente (backup, gerenciador de senhas) — perdê-la exige reconfigurar AWS/OCI do zero pela tela.
- **[Trade-off] Reativar um provider não faz backfill do período desativado** → uma lacuna nos dados aparece no gráfico de tendência para os dias em que ficou desligado. Aceito como comportamento de v1 (mesma limitação já aceita para o backfill inicial hoje).
- **[Trade-off] Validação síncrona ao salvar adiciona latência ao `PUT`** → a chamada real à API da cloud (principalmente OCI, que pode demorar) roda dentro do request; para um único usuário salvando configuração raramente, esse custo é aceitável (não precisa de um job em background só para isso).
- **[Risco] Migração exige reconfigurar do zero** → como não há fallback pro `.env`, o dashboard fica sem nenhum provider ativo até o usuário passar pela tela `/settings` uma vez após o deploy desta mudança. Aceito, dado que é uma mudança pontual de migração.

## Requisitos de API

- `GET /api/settings/providers` → `[{provider, enabled, configured, last_validated_at, last_validation_status, last_validation_error}]`.
- `PUT /api/settings/providers/{provider}` → body com todos os campos daquele provider; `202`/`200` com o resultado da validação em caso de sucesso, `400` com a mensagem de erro da API da cloud em caso de falha (nada é persistido nesse caso).
- `PUT /api/settings/providers/{provider}/enabled` → body `{enabled: bool}`; retorna `409` se tentar ativar um provider com `configured=false`.

## UI

- Link "Configurações" no `AppHeader`, ao lado de "Ver logs de sync".
- Página `/settings`: um card por provider, com toggle ativo/inativo, formulário sempre em branco (placeholders indicando o formato esperado, não os valores atuais), botão "Testar e salvar" (mostra estado de carregamento durante a chamada de validação), e um indicador textual da última validação (data + sucesso ou mensagem de erro).
- `ProviderTabs` (Dashboard e Sync Logs) e os cards da `OverviewPanel` passam a listar só providers com `enabled=true`; se nenhum estiver ativo, mostra uma mensagem "Nenhuma cloud configurada" com link para `/settings`.

## Testes

- Backend: `app/services/secrets_crypto.py` (roundtrip encrypt/decrypt), `app/services/provider_config.py` (upsert, `is_enabled`, ativar sem `configured` retorna erro), endpoints de settings (validação bem-sucedida salva, validação falha não salva e retorna a mensagem de erro, `GET` nunca retorna valores de credenciais), `sync_provider()` pula providers desativados sem criar `sync_runs`.
- Frontend: página de Settings (toggle, submissão do formulário, exibição de erro de validação), `ProviderTabs`/`OverviewPanel` filtrando por providers ativos, mensagem de estado vazio quando nenhum provider está ativo.
