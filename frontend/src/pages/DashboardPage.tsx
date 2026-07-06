import { useState } from "react";
import { Link } from "react-router-dom";

import { Provider } from "../api/client";
import { AppHeader } from "../components/AppHeader";
import { OverviewPanel } from "../components/OverviewPanel";
import { PROVIDERS, ProviderTabs } from "../components/ProviderTabs";
import { ProviderPanel } from "../components/ProviderPanel";
import { useEnabledProviders } from "../hooks/useEnabledProviders";

type DashboardTab = "overview" | Provider;

export function DashboardPage() {
  const { enabledProviders, loading } = useEnabledProviders();
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");

  if (loading) {
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
  const tabs: { key: DashboardTab; label: string }[] = [{ key: "overview", label: "Visão Geral" }, ...providerTabs];

  return (
    <div className="dashboard">
      <AppHeader />
      <ProviderTabs tabs={tabs} active={activeTab} onChange={setActiveTab} />
      {activeTab === "overview" ? (
        <OverviewPanel providers={providerTabs} onSelectProvider={setActiveTab} />
      ) : (
        <ProviderPanel provider={activeTab} />
      )}
    </div>
  );
}
