import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, CostBreakdown, CostSummary, Period, Provider, SyncStatus, api } from "../api/client";
import { BreakdownTable } from "./BreakdownTable";
import { PeriodSelector } from "./PeriodSelector";
import { SyncStatusBadge } from "./SyncStatusBadge";
import { TrendChart } from "./TrendChart";

const POLL_INTERVAL_MS = 3000;

interface Props {
  provider: Provider;
}

export function ProviderPanel({ provider }: Props) {
  const [period, setPeriod] = useState<Period>("current_month");
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [breakdown, setBreakdown] = useState<CostBreakdown | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [triggerError, setTriggerError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);

    return Promise.all([api.costSummary(provider, period), api.costBreakdown(provider, period), api.syncStatus(provider)])
      .then(([summaryRes, breakdownRes, statusRes]) => {
        setSummary(summaryRes);
        setBreakdown(breakdownRes);
        setSyncStatus(statusRes);
        setSyncing(statusRes.status === "running");
        return statusRes;
      })
      .catch(() => {
        setError("Não foi possível carregar os custos.");
        return null;
      })
      .finally(() => setLoading(false));
  }, [provider, period]);

  useEffect(() => {
    setTriggerError(null);
    loadData();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadData]);

  function pollUntilDone() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const status = await api.syncStatus(provider).catch(() => null);
      if (!status) return;
      if (status.status !== "running") {
        if (pollRef.current) clearInterval(pollRef.current);
        setSyncing(false);
        loadData();
      }
    }, POLL_INTERVAL_MS);
  }

  async function handleSyncNow() {
    setTriggerError(null);
    try {
      await api.triggerSync(provider);
      setSyncing(true);
      pollUntilDone();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setTriggerError("Já existe uma sincronização em andamento para esta cloud.");
      } else {
        setTriggerError("Não foi possível iniciar a sincronização.");
      }
    }
  }

  return (
    <section className="provider-panel">
      <div className="provider-panel-toolbar">
        <PeriodSelector value={period} onChange={setPeriod} />
        <div className="sync-controls">
          <button onClick={handleSyncNow} disabled={syncing}>
            {syncing ? "Sincronizando..." : "Sincronizar agora"}
          </button>
          {syncStatus && <SyncStatusBadge status={syncStatus} />}
        </div>
      </div>

      {triggerError && (
        <p role="alert" className="error-text">
          {triggerError}
        </p>
      )}

      {loading && <p>Carregando...</p>}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}

      {!loading && !error && summary && (
        <>
          <p className="total-cost">
            Total: {summary.currency} {summary.total.toFixed(2)}
          </p>
          <TrendChart trend={summary.trend} />
        </>
      )}

      {!loading && !error && breakdown && <BreakdownTable items={breakdown.items} currency={breakdown.currency} />}
    </section>
  );
}
