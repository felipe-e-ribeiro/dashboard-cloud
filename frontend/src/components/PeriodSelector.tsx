import { Period } from "../api/client";

interface Props {
  value: Period;
  onChange: (period: Period) => void;
}

export function PeriodSelector({ value, onChange }: Props) {
  return (
    <select aria-label="Período" value={value} onChange={(e) => onChange(e.target.value as Period)}>
      <option value="current_month">Mês atual</option>
      <option value="last_6_months">Últimos 6 meses</option>
    </select>
  );
}
