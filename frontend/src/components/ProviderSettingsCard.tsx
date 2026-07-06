import { FormEvent, useState } from "react";

import { ApiError, AwsCredentials, OciCredentials, Provider, ProviderStatus, api } from "../api/client";

interface Field {
  name: string;
  label: string;
  type: "text" | "password" | "textarea";
}

interface Props {
  provider: Provider;
  title: string;
  fields: Field[];
  status: ProviderStatus;
  onStatusChange: (status: ProviderStatus) => void;
}

function formatValidatedAt(value: string | null): string {
  if (!value) return "nunca validado";
  return new Date(value).toLocaleString("pt-BR");
}

export function ProviderSettingsCard({ provider, title, fields, status, onStatusChange }: Props) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((field) => [field.name, ""])),
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [togglingEnabled, setTogglingEnabled] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaveError(null);
    setSaving(true);
    try {
      const nextStatus = await api.saveProviderCredentials(
        provider,
        values as unknown as AwsCredentials | OciCredentials,
      );
      onStatusChange(nextStatus);
      setValues(Object.fromEntries(fields.map((field) => [field.name, ""])));
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Não foi possível validar as credenciais.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleEnabled() {
    setTogglingEnabled(true);
    try {
      const nextStatus = await api.setProviderEnabled(provider, !status.enabled);
      onStatusChange(nextStatus);
    } catch {
      // Toggle failures (e.g. trying to enable an unconfigured provider) are rare given
      // the toggle is disabled in that case; ignore silently rather than adding a second
      // error surface next to the form's own error message.
    } finally {
      setTogglingEnabled(false);
    }
  }

  return (
    <section className="provider-settings-card">
      <div className="provider-settings-header">
        <h3>{title}</h3>
        <label className="provider-settings-toggle">
          <input
            type="checkbox"
            checked={status.enabled}
            disabled={!status.configured || togglingEnabled}
            onChange={handleToggleEnabled}
          />
          {status.enabled ? "Ativo" : "Inativo"}
        </label>
      </div>

      <p className="provider-settings-validation">
        {status.configured
          ? `Última validação: ${formatValidatedAt(status.last_validated_at)} (${status.last_validation_status})`
          : "Ainda não configurado"}
        {status.last_validation_status === "failed" && status.last_validation_error && (
          <span className="error-text"> — {status.last_validation_error}</span>
        )}
      </p>

      <form className="provider-settings-form" onSubmit={handleSubmit}>
        {fields.map((field) => (
          <div key={field.name} className="provider-settings-field">
            <label htmlFor={`${provider}-${field.name}`}>{field.label}</label>
            {field.type === "textarea" ? (
              <textarea
                id={`${provider}-${field.name}`}
                rows={6}
                value={values[field.name]}
                onChange={(e) => setValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
              />
            ) : (
              <input
                id={`${provider}-${field.name}`}
                type={field.type}
                value={values[field.name]}
                onChange={(e) => setValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
              />
            )}
          </div>
        ))}

        {saveError && (
          <p role="alert" className="error-text">
            {saveError}
          </p>
        )}

        <button type="submit" disabled={saving}>
          {saving ? "Testando..." : "Testar e salvar"}
        </button>
      </form>
    </section>
  );
}
