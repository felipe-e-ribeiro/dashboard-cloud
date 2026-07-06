import { useEffect, useState } from "react";

import { Provider, api } from "../api/client";

interface EnabledProvidersState {
  enabledProviders: Provider[];
  loading: boolean;
}

export function useEnabledProviders(): EnabledProvidersState {
  const [enabledProviders, setEnabledProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    api
      .getProviderStatuses()
      .then((statuses) => {
        if (cancelled) return;
        setEnabledProviders(statuses.filter((status) => status.enabled).map((status) => status.provider));
      })
      .catch(() => {
        if (!cancelled) setEnabledProviders([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { enabledProviders, loading };
}
