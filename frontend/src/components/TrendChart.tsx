import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { TrendPoint } from "../api/client";

interface Props {
  trend: TrendPoint[];
}

export function TrendChart({ trend }: Props) {
  if (trend.length === 0) {
    return <p className="empty-state">Sem dados de custo para o período selecionado.</p>;
  }

  return (
    <div className="trend-chart" data-testid="trend-chart">
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={trend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="usage_date" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="amount" stroke="#2563eb" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
