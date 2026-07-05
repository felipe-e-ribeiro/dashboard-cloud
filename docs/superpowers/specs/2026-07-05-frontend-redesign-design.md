# Redesign do Frontend — Design

## Contexto e Objetivo

O frontend atual (React/Vite) funciona, mas tem visual genérico (CSS puro, azul `#2563eb`, tabelas cruas) e hierarquia de informação fraca: não fica claro de imediato qual é o custo total, como ele evoluiu, e quais serviços o compõem. Esta mudança redesenha as telas existentes (Login, Dashboard, Sync Logs) e adiciona uma visão combinada AWS+OCI, sem alterar a stack (React/Vite, sem framework de UI novo) nem os fluxos de autenticação/sync já existentes.

Direção validada com o usuário via mockups: estilo "SaaS clean e minimalista" (fundo claro, tipografia forte, muito espaço em branco — referência Stripe/Linear), cor de destaque violeta (`#7c3aed`), com suporte a tema claro/escuro.

## Escopo

- Sistema visual novo (paleta, tipografia, espaçamento) aplicado a **todas** as telas: Login, Dashboard (Visão Geral + AWS + OCI) e Sync Logs.
- Tema claro/escuro com toggle manual, seguindo `prefers-color-scheme` por padrão.
- Nova aba **Visão Geral**, combinando AWS + OCI antes das abas individuais.
- Reorganização da página por provider (AWS/OCI): total do período em destaque no topo, seguido de tendência e breakdown por serviço.
- Drill-down por serviço: clicar em um serviço no breakdown abre um painel de detalhe com comparação mensal (últimos 6 meses).
- Deltas período-a-período (% vs. mês anterior) para o total combinado, total por provider, e total por serviço.

**Fora de escopo:** trocar a stack (sem Tailwind/component library — CSS próprio, mesma abordagem atual), mudar o fluxo de autenticação, budgets/alertas, OAuth, paginação/filtros avançados no breakdown, drill-down dentro da aba Visão Geral (lá é só visão executiva, sem clique em serviço).

## Arquitetura

### Frontend

- Mantém a strutura de páginas atual (`DashboardPage`, `LoginPage`, `SyncLogsPage`) e a convenção de `api/client.ts` como único ponto de `fetch`.
- `ProviderTabs` ganha uma aba adicional "Visão Geral" antes de AWS/OCI; `DashboardPage` passa a renderizar um componente novo (`OverviewPanel`) quando essa aba está ativa, em vez de `ProviderPanel`.
- `OverviewPanel` busca `costSummary` para os dois providers (duas chamadas, sem endpoint novo) e soma os totais no cliente para o KPI combinado; renderiza dois cards (um por provider) reaproveitando um componente `ProviderSummaryCard` extraído de `ProviderPanel`.
- `BreakdownTable` ganha estado de "serviço selecionado" (`selectedService: string | null`) e passa a ser exibida ao lado de um novo componente `ServiceDetailPanel`, que busca o histórico mensal do serviço via a nova chamada de API (ver abaixo) quando `selectedService` muda.
- Tema: um `ThemeContext` novo (paralelo ao `AuthContext` existente) lê `window.matchMedia("(prefers-color-scheme: dark)")` no primeiro load, permite override via toggle no `AppHeader`, e persiste a escolha em `localStorage` (`theme` = `"light" | "dark"`). O tema é aplicado via atributo `data-theme` na raiz e variáveis CSS (`--color-*`) em `styles.css`, sem biblioteca de CSS-in-JS.

### Backend

Duas capacidades novas em `app/routers/costs.py` / `app/services`, que o `cost-dashboard`/`cost-sync` specs precisam ganhar (a formalizar via OpenSpec):

1. **Delta período-a-período**: `CostSummary` passa a incluir o total do período anterior equivalente (mesmo intervalo, um período atrás) e a variação percentual — calculado com uma segunda agregação sobre `cost_records` usando o intervalo anterior a `period_range()`, sem gravar nada novo no banco.
2. **Comparação mensal por serviço**: endpoint novo `GET /api/costs/service-trend?provider=&service_name=&months=6` retornando o total mensal (agrupado por mês civil, via `date_trunc`/equivalente) daquele serviço nos últimos N meses fechados + mês atual — independente do período selecionado na tela (que pode ser `current_month` ou `last_6_months`).

Nenhuma migração de schema é necessária — `cost_records` já tem `provider`, `service_name`, `usage_date`, `amount` suficientes para as duas agregações.

## Decisões

### 1. Visão Geral soma no cliente, sem endpoint combinado novo
Rejeitado um endpoint `GET /api/costs/summary/combined`: o volume de dados é pequeno (duas chamadas por carregamento de página, já em paralelo via `Promise.all` como o código já faz em `ProviderPanel`), então somar `total` de AWS e OCI no cliente evita duplicar lógica de agregação no backend só para uma soma trivial.

### 2. Comparação mensal do serviço é um endpoint separado do breakdown
`GET /api/costs/breakdown` continua somando o período selecionado inteiro (comportamento atual, usado pela tabela). O painel de detalhe precisa de uma granularidade diferente (mensal, últimos 6 meses, independente do período selecionado na tela) — misturar os dois na mesma resposta obrigaria sempre calcular a série mensal mesmo quando o usuário nunca abre o painel de detalhe. Um endpoint sob demanda (chamado só ao clicar em um serviço) é mais simples e barato.

### 3. CSS próprio com variáveis, sem biblioteca de componentes
Mantém a decisão original do projeto (CSS puro em `styles.css`) em vez de introduzir Tailwind/MUI/shadcn. O projeto é pequeno (um usuário, poucas telas) e a dependência nova não se paga; variáveis CSS (`--color-bg`, `--color-accent`, etc.) já resolvem tema claro/escuro sem framework.

### 4. Tema: preferência do SO por padrão, override manual persistido
Evita forçar um tema que destoa do resto do SO do usuário na primeira visita, mas respeita a escolha explícita assim que ele interage com o toggle — mesmo padrão usado por GitHub/Linear.

## Riscos / Trade-offs

- **[Trade-off] Duas chamadas HTTP na Visão Geral em vez de uma** → levemente menos eficiente que um endpoint combinado, mas evita lógica de agregação duplicada no backend para um caso de uso simples (soma de dois números).
- **[Trade-off] Painel de detalhe do serviço busca dados sob demanda** → há uma pequena latência ao clicar no serviço (loading state necessário no `ServiceDetailPanel`), em vez de já vir tudo carregado. Aceitável porque é uma ação explícita do usuário, não parte do carregamento inicial da página.
- **[Risco] `data-theme` + `prefers-color-scheme` divergentes entre abas do navegador** → se o usuário mudar o tema em uma aba, outras abas abertas só refletem a mudança após reload (sem `storage` event listener nesta v1). Impacto baixo (uso pessoal, uma aba por vez na prática).

## Requisitos de API

- `GET /api/costs/summary?provider=&period=` — resposta ganha `previous_total: float` e `change_pct: float | null` (`null` quando não há dados no período anterior para calcular variação).
- `GET /api/costs/service-trend?provider=aws|oci&service_name=&months=6` (novo) → lista de `{month: "YYYY-MM", amount: float}`, mês mais antigo primeiro, cobrindo os últimos `months` meses fechados + mês atual.

## UI

### Sistema visual
- Paleta: fundo claro (`#ffffff`/`#fafafa`) e escuro (`#0b0f19`/`#131a2a` — tons neutros, não o preto puro), texto `#18181b`/`#f9fafb`, destaque violeta `#7c3aed` em ambos os temas, verde (`#16a34a`) para variação negativa de custo (bom) e vermelho (`#b91c1c`, já usado) para erros/aumento de custo.
- Tipografia: mantém `system-ui` (sem web font nova), com maior contraste de peso entre título/valor (700) e labels (600, uppercase, menor, cinza).
- Toggle de tema no `AppHeader`, ao lado do link "Sync Logs".

### Visão Geral (nova aba)
- KPI combinado (AWS + OCI) no topo, com % vs. mês anterior.
- Dois `ProviderSummaryCard` lado a lado (AWS, OCI), cada um com total do provider + mini-tendência. Sem interação de drill-down aqui — é só visão executiva; clicar em um card leva à aba daquele provider (não abre painel de detalhe).

### Páginas AWS / OCI
- Total do período no topo (com % vs. mês anterior), sempre visível antes do breakdown.
- Gráfico de tendência do período (mantém `TrendChart`/Recharts existente) logo abaixo do total.
- Breakdown por serviço em tabela enxuta à esquerda (nome + custo, sem % nem sparkline inline).
- Painel de detalhe à direita, populado ao clicar em um serviço: nome, valor, % do total do provider, e gráfico de barras dos últimos 6 meses daquele serviço com % vs. mês anterior. Vazio (placeholder "Selecione um serviço") até o primeiro clique.
- Controles de sync (botão "Sincronizar agora", badge de status) mantêm posição e comportamento atuais.

### Sync Logs
- Mesmo sistema visual (cores, tipografia, dark/light) aplicado à página existente, sem mudar sua estrutura de informação (abas AWS/OCI, tabela das últimas 20 execuções).

### Login
- Mesmo sistema visual aplicado; mantém o layout de duas colunas (branding + formulário), trocando o gradiente azul pela paleta nova (violeta/neutro) e suportando dark/light como as demais telas.

## Testes

- Frontend: testes de componente (Vitest + Testing Library) para `OverviewPanel` (soma correta dos totais, estado de loading/erro por provider independente), `ServiceDetailPanel` (fetch sob demanda ao selecionar serviço, estado vazio antes do clique) e `ThemeContext` (aplica `data-theme` a partir de `prefers-color-scheme`, persiste override em `localStorage`).
- Backend: testes para o cálculo de `previous_total`/`change_pct` em `cost_summary` (incluindo caso sem dados no período anterior) e para o novo endpoint `service-trend` (agregação mensal correta, período de 6 meses fechados + mês atual, serviço inexistente retorna lista vazia).
