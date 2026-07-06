import { useEffect, useState } from "react";

import { Provider, ProviderStatus, api } from "../api/client";
import { AppHeader } from "../components/AppHeader";
import { ProviderSettingsCard } from "../components/ProviderSettingsCard";

const AWS_FIELDS = [
  { name: "access_key_id", label: "Access Key ID", type: "text" as const },
  { name: "secret_access_key", label: "Secret Access Key", type: "password" as const },
  { name: "region", label: "Região", type: "text" as const },
];

const OCI_FIELDS = [
  { name: "tenancy_ocid", label: "Tenancy OCID", type: "text" as const },
  { name: "user_ocid", label: "User OCID", type: "text" as const },
  { name: "fingerprint", label: "Fingerprint", type: "text" as const },
  { name: "region", label: "Região", type: "text" as const },
  { name: "private_key_pem", label: "Chave privada (PEM)", type: "textarea" as const },
];

export function SettingsPage() {
  const [statuses, setStatuses] = useState<Record<Provider, ProviderStatus | null>>({ aws: null, oci: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getProviderStatuses()
      .then((data) => {
        if (cancelled) return;
        const byProvider = Object.fromEntries(data.map((status) => [status.provider, status])) as Record<
          Provider,
          ProviderStatus
        >;
        setStatuses(byProvider);
      })
      .catch(() => {
        if (!cancelled) setError("Não foi possível carregar as configurações.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="dashboard">
      <AppHeader />
      <h2>Configurações</h2>

      {loading && <p>Carregando...</p>}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}

      {!loading && !error && (
        <div className="provider-settings-list">
          {statuses.aws && (
            <ProviderSettingsCard
              provider="aws"
              title="AWS"
              fields={AWS_FIELDS}
              status={statuses.aws}
              onStatusChange={(next) => setStatuses((prev) => ({ ...prev, aws: next }))}
            />
          )}
          {statuses.oci && (
            <ProviderSettingsCard
              provider="oci"
              title="Oracle Cloud"
              fields={OCI_FIELDS}
              status={statuses.oci}
              onStatusChange={(next) => setStatuses((prev) => ({ ...prev, oci: next }))}
            />
          )}
        </div>
      )}
    </div>
  );
}
