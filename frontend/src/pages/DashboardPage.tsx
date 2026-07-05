import { useState } from "react";

import { Provider } from "../api/client";
import { AppHeader } from "../components/AppHeader";
import { OverviewPanel } from "../components/OverviewPanel";
import { PROVIDERS, ProviderTabs } from "../components/ProviderTabs";
import { ProviderPanel } from "../components/ProviderPanel";

type DashboardTab = "overview" | Provider;

const TABS: { key: DashboardTab; label: string }[] = [
  { key: "overview", label: "Visão Geral" },
  ...PROVIDERS,
];

export function DashboardPage() {
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");

  return (
    <div className="dashboard">
      <AppHeader />
      <ProviderTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />
      {activeTab === "overview" ? (
        <OverviewPanel onSelectProvider={setActiveTab} />
      ) : (
        <ProviderPanel provider={activeTab} />
      )}
    </div>
  );
}
