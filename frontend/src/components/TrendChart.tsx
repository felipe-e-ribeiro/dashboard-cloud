import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { TrendPoint } from "../api/client";

interface Props {
  trend: TrendPoint[];
  height?: number;
  compact?: boolean;
}

// Daily amounts can dip sharply even in a month with rising costs — e.g. a fixed monthly
// fee (like a Route 53 hosted zone) is often billed entirely on day one. Plotting the
// running total instead keeps the line reflecting "cost so far this period" (which can
// only go up), matching what a monthly cost view is meant to show.
export function toCumulative(trend: TrendPoint[]): TrendPoint[] {
  let running = 0;
  return trend.map((point) => {
    running += point.amount;
    return { ...point, amount: running };
  });
}

export function TrendChart({ trend, height = 240, compact = false }: Props) {
  if (trend.length === 0) {
    return compact ? null : <p className="empty-state">Sem dados de custo para o período selecionado.</p>;
  }

  const cumulativeTrend = toCumulative(trend);

  return (
    <div className="trend-chart" data-testid="trend-chart">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={cumulativeTrend}>
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
