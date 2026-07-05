# Monetary Formatting + USD→BRL Conversion — Design

## Contexto e Objetivo

Depois do redesign do frontend, o usuário apontou dois problemas de leitura dos valores de custo: (1) os valores monetários (USD) ficam difíceis de ler sem separador de milhar e com formatação inconsistente entre componentes, e (2) como o usuário pensa em Real, não em Dólar, ele quer poder ver os mesmos custos convertidos para BRL. A conversão precisa ser historicamente correta — cada dia de custo deve ser convertido pela cotação daquele dia, não por uma cotação única aplicada a tudo — para não distorcer a tendência ao longo do tempo (ex: aplicar a cotação de hoje em um custo de 6 meses atrás geraria um valor que nunca existiu de fato).

## Escopo

- Formatação monetária única e consistente (2 casas decimais, separador de milhar) usada em todo o frontend, tanto para USD quanto BRL.
- Nova tabela `exchange_rates` (data, cotação USD→BRL), sincronizada diariamente pelo mesmo agendador do sync de custos, com backfill do mesmo período histórico dos `cost_records`.
- `GET /api/costs/summary`, `GET /api/costs/breakdown` e `GET /api/costs/service-trend` ganham um parâmetro opcional `currency=usd|brl` (padrão `usd`, mantém comportamento atual). Quando `brl`, o backend converte cada registro pela cotação do seu próprio dia antes de agregar.
- Botão de moeda (USD/BRL) no cabeçalho, ao lado do toggle de tema, com preferência persistida em `localStorage`.

**Fora de escopo:** outras moedas além de BRL, conversão configurável pelo usuário (taxa manual), exibir USD e BRL simultaneamente lado a lado, alterar a moeda em que os dados são sincronizados/armazenados (`cost_records.currency` continua `USD`).

## Arquitetura

### Fonte da cotação: frankfurter.app

API pública, sem chave de autenticação, mantida com dados do Banco Central Europeu, com suporte a série histórica (`GET /{start}..{end}?from=USD&to=BRL`) em uma única chamada — evita adicionar mais um segredo em `secrets/` só para isso, ao contrário de provedores que exigem `access_key`.

### Persistência e sync

- Nova tabela `exchange_rates(date PK, rate Numeric(10,4))` — um único par USD→BRL, sem coluna de moeda (YAGNI: o projeto só precisa desse par).
- `app/services/fx.py::sync_fx_rates(db, today)`: calcula o intervalo que falta (do mais antigo `cost_records.usage_date` existente, ou o mesmo backfill de 6 meses se a tabela estiver vazia, até `today`), busca em uma única chamada à API o intervalo ausente, e faz upsert em `exchange_rates`.
- Chamado pelo mesmo job do `scheduler.py` (03:00), logo após `sync_all()` — reaproveita o agendador existente em vez de criar um segundo `BackgroundScheduler`.
- Segue a mesma regra do resto do projeto (`CLAUDE.md`): os endpoints de leitura (`/api/costs/*`) **nunca** chamam a API de câmbio ao vivo, só leem `exchange_rates` já persistida. Se a cotação de hoje ainda não foi sincronizada (ex: primeira consulta do dia, antes das 03:00, ou falha na API externa), o dia fica sem cotação exata e cai no fallback abaixo.

### Fallback para dias sem cotação (fins de semana/feriados/falhas)

A API de câmbio não publica cotação todo dia (fins de semana, feriados bancários). Em vez de um `LEFT JOIN LATERAL` de SQL (específico de Postgres, e os testes do backend rodam em SQLite — ver `tests/conftest.py`), a conversão é feita em Python, no mesmo estilo que `service_trend()` já agrega em memória: busca-se todas as `cost_records` da consulta e todas as `exchange_rates` no intervalo (mais uma folga de alguns dias antes, para garantir uma cotação de carry-forward mesmo se a consulta começar numa sexta/feriado), monta-se um mapa ordenado `date -> rate`, e cada linha é convertida usando a cotação mais recente **na data ou antes dela** (busca binária com `bisect`). Isso mantém a lógica idêntica em SQLite (testes) e Postgres (produção) e reaproveita o padrão já usado no projeto para agregações desse tamanho de dado (um usuário, poucas linhas).

### Formatação (frontend)

- `formatMoney(amount, currency)` em `utils/format.ts`, usando `Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 })` — `en-US`/`USD` ou `pt-BR`/`BRL` conforme a moeda selecionada. Substitui todos os `toFixed(2)` manuais atuais (`ProviderSummaryCard`, `ProviderPanel`, `BreakdownTable`, `ServiceDetailPanel`).

## Decisões

### 1. Conversão no backend (agregação SQL), não no frontend
Rejeitado converter no cliente multiplicando os totais já agregados por uma cotação única: isso aplicaria a cotação de hoje a custos de meses passados, o que o usuário explicitamente não quer. Fazer a conversão na agregação SQL (por linha, antes do `SUM`) é a única forma de cada dia usar sua própria cotação sem duplicar toda a lógica de agregação no frontend.

### 2. `currency` como parâmetro de query aditivo, não um endpoint novo
Mantém os três endpoints existentes, com `currency=usd` como padrão (comportamento idêntico ao atual) — evita duplicar `cost_summary`/`cost_breakdown`/`service_trend` em versões BRL.

### 3. Backfill + sync diário, nunca chamada ao vivo no read path
Mesma justificativa do sync de custos: o dashboard não pode travar (nem ficar sujeito a falhas/latência de uma API externa) toda vez que alguém olha os custos. Uma falha ao buscar a cotação vira, na pior hipótese, um dia sem cotação exata (coberto pelo fallback de carry-forward), nunca um erro 500 no dashboard.

### 4. frankfurter.app em vez de um provedor com chave
Evita adicionar mais uma credencial ao projeto (que já gerencia chaves AWS e OCI) só para uma feature de conveniência. Se a fonte se mostrar não confiável no uso real, trocar de provedor é uma mudança isolada em `app/services/fx.py`.

## Riscos / Trade-offs

- **[Risco] frankfurter.app fora do ar ou instável** → o backfill/sync diário falha silenciosamente para aquele dia (mesmo padrão de isolamento de falha do `sync_provider`); o carry-forward cobre a maioria dos casos, mas se a API ficar fora por muitos dias seguidos a cotação usada envelhece. Aceito: é uma feature de conveniência, não crítica.
- **[Trade-off] Sem histórico de qual cotação exata foi usada em cada consulta** → como a conversão é feita on-the-fly na leitura (não gravada em `cost_records`), se a cotação de um dia for corrigida/atualizada depois, valores passados exibidos em BRL podem mudar sutilmente entre uma visita e outra. Aceitável para uma visão de custo aproximada em Real.
- **[Trade-off] Conversão em Python em vez de SQL** → para os volumes deste projeto (um usuário, algumas centenas de linhas por período) o custo é irrelevante, mas essa abordagem não escalaria para múltiplos usuários/tenants; aceitável dado o escopo do projeto (`CLAUDE.md`: "pessoal... um usuário").

## Requisitos de API

- `GET /api/costs/summary?provider=&period=&currency=usd|brl` (novo parâmetro opcional, default `usd`).
- `GET /api/costs/breakdown?provider=&period=&currency=usd|brl` (idem).
- `GET /api/costs/service-trend?provider=&service_name=&months=&currency=usd|brl` (idem).
- Todas as respostas passam a refletir `currency` no campo `currency` já existente no schema (hoje fixo em `"USD"`).

## UI

- Botão de moeda no `AppHeader`, ao lado do toggle de tema: dois estados "USD" / "BRL", preferência persistida em `localStorage` (mesmo padrão do `ThemeContext`, um `CurrencyContext` novo).
- Trocar a moeda refaz o fetch dos dados (o parâmetro `currency` muda, então os hooks de carregamento em `ProviderPanel`/`OverviewPanel`/`ServiceDetailPanel` reagem à mudança como já reagem a mudanças de período/provider).
- Todo valor monetário exibido (totais, breakdown, painel de detalhe) passa a usar `formatMoney`, formatado no idioma/moeda correspondente.
