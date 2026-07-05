import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { TrendPoint } from "../api/client";

interface Props {
  trend: TrendPoint[];
  height?: number;
  compact?: boolean;
}

export function TrendChart({ trend, height = 240, compact = false }: Props) {
  if (trend.length === 0) {
    return compact ? null : <p className="empty-state">Sem dados de custo para o período selecionado.</p>;
  }

  return (
    <div className="trend-chart" data-testid="trend-chart">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={trend}>
          {!compact && <CartesianGrid strokeDasharray="3 3" />}
          {!compact && <XAxis dataKey="usage_date" />}
          {!compact && <YAxis />}
          {!compact && <Tooltip />}
          <Line type="monotone" dataKey="amount" stroke="#7c3aed" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
