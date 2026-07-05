export type Provider = "aws" | "oci";
export type Period = "current_month" | "last_6_months";

export interface TrendPoint {
  usage_date: string;
  amount: number;
}

export interface CostSummary {
  provider: Provider;
  period: Period;
  currency: string;
  total: number;
  previous_total: number;
  change_pct: number | null;
  trend: TrendPoint[];
}

export interface BreakdownItem {
  service_name: string;
  amount: number;
}

export interface CostBreakdown {
  provider: Provider;
  period: Period;
  currency: string;
  items: BreakdownItem[];
}

export interface ServiceTrendPoint {
  month: string;
  amount: number;
}

export interface ServiceTrend {
  provider: Provider;
  service_name: string;
  currency: string;
  points: ServiceTrendPoint[];
}

export interface SyncStatus {
  provider: Provider;
  status: "running" | "success" | "failed" | null;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
}

export interface CurrentUser {
  id: number;
  username: string;
  auth_provider: string;
}

export interface SyncRunLogEntry {
  id: number;
  status: "running" | "success" | "failed";
  started_at: string;
  finished_at: string | null;
  records_synced: number;
  error_message: string | null;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, body.detail || response.statusText);
  }

  return response.json() as Promise<T>;
}

export const api = {
  login: (username: string, password: string) =>
    request<{ status: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request<{ status: string }>("/auth/logout", { method: "POST" }),
  me: () => request<CurrentUser>("/auth/me"),
  costSummary: (provider: Provider, period: Period) =>
    request<CostSummary>(`/api/costs/summary?provider=${provider}&period=${period}`),
  costBreakdown: (provider: Provider, period: Period) =>
    request<CostBreakdown>(`/api/costs/breakdown?provider=${provider}&period=${period}`),
  serviceTrend: (provider: Provider, serviceName: string, months = 6) =>
    request<ServiceTrend>(
      `/api/costs/service-trend?provider=${provider}&service_name=${encodeURIComponent(serviceName)}&months=${months}`,
    ),
  syncStatus: (provider: Provider) => request<SyncStatus>(`/api/sync/status?provider=${provider}`),
  triggerSync: (provider: Provider) =>
    request<{ status: string }>(`/api/sync/trigger?provider=${provider}`, { method: "POST" }),
  syncLogs: (provider: Provider) => request<SyncRunLogEntry[]>(`/api/sync/logs?provider=${provider}`),
};
