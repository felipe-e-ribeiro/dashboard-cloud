import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { Provider, SyncRunLogEntry, api } from "../api/client";
import { AppHeader } from "../components/AppHeader";
import { PROVIDERS, ProviderTabs } from "../components/ProviderTabs";
import { useEnabledProviders } from "../hooks/useEnabledProviders";

function formatTimestamp(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR");
}

export function SyncLogsPage() {
  const { enabledProviders, loading: loadingProviders } = useEnabledProviders();
  const [activeProvider, setActiveProvider] = useState<Provider | null>(null);
  const [logs, setLogs] = useState<SyncRunLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loadingProviders) return;
    if (activeProvider === null && enabledProviders.length > 0) {
      setActiveProvider(enabledProviders[0]);
    }
  }, [loadingProviders, enabledProviders, activeProvider]);

  useEffect(() => {
    if (!activeProvider) {
      setLoading(false);
      return;
    }

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

  if (loadingProviders) {
    return (
      <div className="dashboard">
        <AppHeader />
        <p>Carregando...</p>
      </div>
    );
  }

  if (enabledProviders.length === 0) {
    return (
      <div className="dashboard">
        <AppHeader />
        <p className="empty-state">
          Nenhuma cloud configurada. <Link to="/settings">Configurar agora</Link>.
        </p>
      </div>
    );
  }

  const providerTabs = PROVIDERS.filter((provider) => enabledProviders.includes(provider.key));

  return (
    <div className="dashboard">
      <AppHeader />
      {activeProvider && (
        <ProviderTabs tabs={providerTabs} active={activeProvider} onChange={setActiveProvider} />
      )}

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
