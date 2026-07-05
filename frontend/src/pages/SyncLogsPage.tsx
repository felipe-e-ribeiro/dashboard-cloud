import { useEffect, useState } from "react";

import { Provider, SyncRunLogEntry, api } from "../api/client";
import { AppHeader } from "../components/AppHeader";
import { ProviderTabs } from "../components/ProviderTabs";

function formatTimestamp(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR");
}

export function SyncLogsPage() {
  const [activeProvider, setActiveProvider] = useState<Provider>("aws");
  const [logs, setLogs] = useState<SyncRunLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .syncLogs(activeProvider)
      .then((data) => {
        if (!cancelled) setLogs(data);
      })
      .catch(() => {
        if (!cancelled) setError("Não foi possível carregar os logs de sync.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeProvider]);

  return (
    <div className="dashboard">
      <AppHeader />
      <ProviderTabs active={activeProvider} onChange={setActiveProvider} />

      <section className="sync-logs-panel">
        {loading && <p>Carregando...</p>}
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        {!loading && !error && logs.length === 0 && (
          <p className="empty-state">Nenhuma sincronização registrada ainda.</p>
        )}
        {!loading && !error && logs.length > 0 && (
          <table className="sync-logs-table">
            <thead>
              <tr>
                <th>Início</th>
                <th>Fim</th>
                <th>Status</th>
                <th>Registros</th>
                <th>Erro</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{formatTimestamp(log.started_at)}</td>
                  <td>{formatTimestamp(log.finished_at)}</td>
                  <td>{log.status}</td>
                  <td>{log.records_synced}</td>
                  <td>{log.error_message || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
