import { useState } from "react";

import { Provider } from "../api/client";
import { AppHeader } from "../components/AppHeader";
import { ProviderPanel } from "../components/ProviderPanel";
import { ProviderTabs } from "../components/ProviderTabs";

export function DashboardPage() {
  const [activeProvider, setActiveProvider] = useState<Provider>("aws");

  return (
    <div className="dashboard">
      <AppHeader />
      <ProviderTabs active={activeProvider} onChange={setActiveProvider} />
      <ProviderPanel provider={activeProvider} />
    </div>
  );
}
