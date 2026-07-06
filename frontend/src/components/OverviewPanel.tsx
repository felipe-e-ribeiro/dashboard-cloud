import { useEffect, useState } from "react";

import { CostSummary, Provider, api } from "../api/client";
import { useCurrency } from "../context/CurrencyContext";
import { ProviderSummaryCard } from "./ProviderSummaryCard";

const OVERVIEW_PERIOD = "current_month";

interface Props {
  providers: { key: Provider; label: string }[];
  onSelectProvider: (provider: Provider) => void;
}

type SummaryState = Partial<Record<Provider, CostSummary>>;
type ErrorState = Partial<Record<Provider, boolean>>;

export function OverviewPanel({ providers, onSelectProvider }: Props) {
  const { currency: requestCurrency } = useCurrency();
  const [summaries, setSummaries] = useState<SummaryState>({});
  const [errors, setErrors] = useState<ErrorState>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all(
      providers.map(({ key }) =>
        api
          .costSummary(key, OVERVIEW_PERIOD, requestCurrency)
          .then((summary) => ({ key, summary, failed: false }) as const)
          .catch(() => ({ key, summary: null, failed: true }) as const),
      ),
    ).then((results) => {
      if (cancelled) return;
      const nextSummaries: SummaryState = {};
      const nextErrors: ErrorState = {};
      for (const result of results) {
        if (result.summary) nextSummaries[result.key] = result.summary;
        if (result.failed) nextErrors[result.key] = true;
      }
      setSummaries(nextSummaries);
      setErrors(nextErrors);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [providers, requestCurrency]);

  if (loading) return <p>Carregando...</p>;

  const loaded = providers.map(({ key }) => summaries[key]).filter((summary): summary is CostSummary => !!summary);
  const combinedTotal = loaded.reduce((sum, summary) => sum + summary.total, 0);
  const combinedPrevious = loaded.reduce((sum, summary) => sum + summary.previous_total, 0);
  const combinedChangePct = combinedPrevious ? ((combinedTotal - combinedPrevious) / combinedPrevious) * 100 : null;
  const currency = loaded[0]?.currency ?? "USD";

  return (
    <section className="overview-panel">
      {loaded.length > 0 && (
        <ProviderSummaryCard
          label="Total combinado (AWS + Oracle Cloud)"
          currency={currency}
          total={combinedTotal}
          changePct={combinedChangePct}
          comparisonLabel="mês anterior"
        />
      )}
      {loaded.length === 0 && (
        <p role="alert" className="error-text">
          Não foi possível carregar os custos combinados.
        </p>
      )}

      <div className="overview-cards">
        {providers.map(({ key, label }) => {
          const summary = summaries[key];
          if (errors[key]) {
            return (
              <div key={key} className="summary-card summary-card-compact">
                <div className="summary-card-label">{label}</div>
                <p role="alert" className="error-text">
                  Não foi possível carregar os custos de {label}.
                </p>
              </div>
            );
          }
          if (!summary) return null;
          return (
            <ProviderSummaryCard
              key={key}
              label={label}
              currency={summary.currency}
              total={summary.total}
              changePct={summary.change_pct}
              comparisonLabel="mês anterior"
              trend={summary.trend}
              compact
              onClick={() => onSelectProvider(key)}
            />
          );
        })}
      </div>
    </section>
  );
}
