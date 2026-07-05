import { Provider } from "../api/client";

export const PROVIDERS: { key: Provider; label: string }[] = [
  { key: "aws", label: "AWS" },
  { key: "oci", label: "Oracle Cloud" },
];

interface Tab<T extends string> {
  key: T;
  label: string;
}

interface Props<T extends string> {
  tabs?: Tab<T>[];
  active: T;
  onChange: (key: T) => void;
}

export function ProviderTabs<T extends string>({ tabs, active, onChange }: Props<T>) {
  const items = tabs ?? (PROVIDERS as unknown as Tab<T>[]);

  return (
    <div className="tabs" role="tablist">
      {items.map(({ key, label }) => (
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
