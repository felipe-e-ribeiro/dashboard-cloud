import { Provider } from "../api/client";

export const PROVIDERS: { key: Provider; label: string }[] = [
  { key: "aws", label: "AWS" },
  { key: "oci", label: "Oracle Cloud" },
];

interface Props {
  active: Provider;
  onChange: (provider: Provider) => void;
}

export function ProviderTabs({ active, onChange }: Props) {
  return (
    <div className="tabs" role="tablist">
      {PROVIDERS.map(({ key, label }) => (
        <button
          key={key}
          role="tab"
          aria-selected={active === key}
          className={active === key ? "tab active" : "tab"}
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
