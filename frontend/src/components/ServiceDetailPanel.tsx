import { useEffect, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

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
  const changePct =
    previousPoint && previousPoint.amount ? ((lastPoint.amount - previousPoint.amount) / previousPoint.amount) * 100 : null;
  const change = formatChangePct(changePct, "mês anterior");
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
                <Bar dataKey="amount" fill="#7c3aed" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
      {!loading && !error && points.length === 0 && (
        <p className="empty-state">Sem histórico mensal para este serviço.</p>
      )}
    </div>
  );
}
