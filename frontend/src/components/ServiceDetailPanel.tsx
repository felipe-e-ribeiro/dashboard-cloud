import { useEffect, useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";

import { Provider, ServiceTrendPoint, api } from "../api/client";
import { useCurrency } from "../context/CurrencyContext";
import { formatChangePct, formatMoney } from "../utils/format";

interface Props {
  provider: Provider;
  serviceName: string | null;
  serviceAmount: number | undefined;
  providerTotal: number;
  currency: string;
}

function isCurrentMonth(monthKey: string): boolean {
  const today = new Date();
  const currentKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  return monthKey === currentKey;
}

function dailyAverage(point: ServiceTrendPoint): number {
  const [yearStr, monthStr] = point.month.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);

  const days = isCurrentMonth(point.month)
    ? new Date().getDate()
    : new Date(year, month, 0).getDate(); // day 0 of next month = last day of this month

  return days > 0 ? point.amount / days : 0;
}

export function ServiceDetailPanel({ provider, serviceName, serviceAmount, providerTotal, currency }: Props) {
  const { currency: requestCurrency } = useCurrency();
  const [points, setPoints] = useState<ServiceTrendPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!serviceName) {
      setPoints([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .serviceTrend(provider, serviceName, 6, requestCurrency)
      .then((result) => {
        if (!cancelled) setPoints(result.points);
      })
      .catch(() => {
        if (!cancelled) setError("Não foi possível carregar o histórico do serviço.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [provider, serviceName, requestCurrency]);

  if (!serviceName) {
    return (
      <div className="service-detail service-detail-empty">
        <p className="empty-state">Selecione um serviço para ver o detalhe.</p>
      </div>
    );
  }

  const lastPoint = points[points.length - 1];
  const previousPoint = points[points.length - 2];
  const isLastPointCurrentMonth = lastPoint ? isCurrentMonth(lastPoint.month) : false;

  // The current month's bar only covers the days elapsed so far, so comparing its raw
  // total against a prior *complete* month's total makes cost look like it's dropping
  // even when the daily rate is climbing. Comparing daily averages instead keeps the
  // comparison fair regardless of how many days the current month has had.
  const lastDailyAverage = lastPoint ? dailyAverage(lastPoint) : null;
  const previousDailyAverage = previousPoint ? dailyAverage(previousPoint) : null;
  const changePct =
    lastDailyAverage !== null && previousDailyAverage
      ? ((lastDailyAverage - previousDailyAverage) / previousDailyAverage) * 100
      : null;
  const change = formatChangePct(changePct, isLastPointCurrentMonth ? "média diária do mês anterior" : "mês anterior");
  const sharePct = providerTotal ? ((serviceAmount ?? 0) / providerTotal) * 100 : 0;

  return (
    <div className="service-detail">
      <div className="service-detail-label">Detalhe do serviço</div>
      <div className="service-detail-name">{serviceName}</div>
      <div className="service-detail-total">{formatMoney(serviceAmount ?? 0, currency)}</div>
      <div className="service-detail-share">{sharePct.toFixed(0)}% do custo total do período</div>

      {loading && <p>Carregando...</p>}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}

      {!loading && !error && points.length > 0 && (
        <>
          {change && <div className={`change-badge change-${change.direction}`}>{change.text}</div>}
          <div className="service-detail-chart" data-testid="service-detail-chart">
            <ResponsiveContainer width="100%" height={90}>
              <BarChart data={points}>
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="amount" radius={[3, 3, 0, 0]}>
                  {points.map((point) => (
                    <Cell key={point.month} fill={isCurrentMonth(point.month) ? "#c4b5fd" : "#7c3aed"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {isLastPointCurrentMonth && (
            <p className="service-detail-note">
              O mês atual ainda está em andamento — a comparação acima usa a média diária, não o total do mês.
            </p>
          )}
        </>
      )}
      {!loading && !error && points.length === 0 && (
        <p className="empty-state">Sem histórico mensal para este serviço.</p>
      )}
    </div>
  );
}
