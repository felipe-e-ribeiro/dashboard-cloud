import { BreakdownItem } from "../api/client";

interface Props {
  items: BreakdownItem[];
  currency: string;
}

export function BreakdownTable({ items, currency }: Props) {
  if (items.length === 0) {
    return <p className="empty-state">Nenhum custo por serviço no período.</p>;
  }

  return (
    <table className="breakdown-table">
      <thead>
        <tr>
          <th>Serviço</th>
          <th>Custo ({currency})</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.service_name}>
            <td>{item.service_name}</td>
            <td>{item.amount.toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
