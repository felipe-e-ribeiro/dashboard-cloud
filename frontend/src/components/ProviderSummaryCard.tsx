import { TrendPoint } from "../api/client";
import { formatChangePct } from "../utils/format";
import { TrendChart } from "./TrendChart";

interface Props {
  label: string;
  currency: string;
  total: number;
  changePct: number | null;
  comparisonLabel: string;
  trend?: TrendPoint[];
  compact?: boolean;
  onClick?: () => void;
}

export function ProviderSummaryCard({
  label,
  currency,
  total,
  changePct,
  comparisonLabel,
  trend,
  compact = false,
  onClick,
}: Props) {
  const change = formatChangePct(changePct, comparisonLabel);

  return (
    <div
      className={compact ? "summary-card summary-card-compact" : "summary-card"}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="summary-card-label">{label}</div>
      <div className="summary-card-total">
        {currency} {total.toFixed(2)}
      </div>
      {change && <div className={`change-badge change-${change.direction}`}>{change.text}</div>}
      {trend && trend.length > 0 && (
        <div className="summary-card-trend">
          <TrendChart trend={trend} height={48} compact />
        </div>
      )}
    </div>
  );
}
