import { BreakdownItem } from "../api/client";

interface Props {
  items: BreakdownItem[];
  selectedService: string | null;
  onSelect: (serviceName: string) => void;
}

export function BreakdownTable({ items, selectedService, onSelect }: Props) {
  if (items.length === 0) {
    return <p className="empty-state">Nenhum custo por serviço no período.</p>;
  }

  return (
    <div className="breakdown-list" role="table">
      <div className="breakdown-row breakdown-row-header" role="row">
        <span>Serviço</span>
        <span>Custo</span>
      </div>
      {items.map((item) => (
        <button
          key={item.service_name}
          type="button"
          role="row"
          className={
            item.service_name === selectedService ? "breakdown-row breakdown-row-selected" : "breakdown-row"
          }
          onClick={() => onSelect(item.service_name)}
        >
          <span>{item.service_name}</span>
          <span>{item.amount.toFixed(2)}</span>
        </button>
      ))}
    </div>
  );
}
