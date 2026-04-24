const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("llmeter_token");
}

export function setToken(token: string) {
  localStorage.setItem("llmeter_token", token);
}

export function clearToken() {
  localStorage.removeItem("llmeter_token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// Auth
export const api = {
  login: (username: string, password: string) =>
    request<{ access_token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  // Providers
  getProviders: () => request<Provider[]>("/api/providers"),
  createProvider: (data: ProviderCreate) =>
    request<Provider>("/api/providers", { method: "POST", body: JSON.stringify(data) }),
  updateProvider: (id: number, data: Partial<ProviderCreate>) =>
    request<Provider>(`/api/providers/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteProvider: (id: number) =>
    request<void>(`/api/providers/${id}`, { method: "DELETE" }),
  testProvider: (id: number, api_key?: string) =>
    request<{ ok: boolean; message: string; latency_ms?: number; models?: string[] }>(
      `/api/providers/${id}/test`,
      { method: "POST", body: JSON.stringify({ api_key: api_key || "" }) }
    ),
  getProviderModels: (id: number, api_key?: string) => {
    const q = api_key ? `?api_key=${encodeURIComponent(api_key)}` : "";
    return request<{ models: string[] }>(`/api/providers/${id}/models${q}`);
  },

  // Logs
  getLogs: (params: LogsParams) => {
    const q = new URLSearchParams();
    if (params.page) q.set("page", String(params.page));
    if (params.limit) q.set("limit", String(params.limit));
    if (params.provider) q.set("provider", params.provider);
    if (params.model) q.set("model", params.model);
    if (params.status) q.set("status", params.status);
    if (params.from_time) q.set("from_time", params.from_time);
    if (params.to_time) q.set("to_time", params.to_time);
    if (params.search) q.set("search", params.search);
    return request<PaginatedLogs>(`/api/logs?${q}`);
  },
  getLogsSummary: (params: LogsParams) => {
    const q = new URLSearchParams();
    if (params.provider) q.set("provider", params.provider);
    if (params.model) q.set("model", params.model);
    if (params.status) q.set("status", params.status);
    if (params.from_time) q.set("from_time", params.from_time);
    if (params.to_time) q.set("to_time", params.to_time);
    if (params.search) q.set("search", params.search);
    return request<LogSummary>(`/api/logs/summary?${q}`);
  },
  getLog: (id: number) => request<LogDetail>(`/api/logs/${id}`),
  getDistinctModels: () => request<{ models: string[] }>("/api/logs/distinct-models"),
  clearLogs: () => request<void>("/api/logs", { method: "DELETE" }),
  bulkSearchLogs: (request_ids: string[], page = 1, limit = 200) =>
    request<PaginatedLogs>(`/api/logs/search?page=${page}&limit=${limit}`, {
      method: "POST",
      body: JSON.stringify({ request_ids }),
    }),

  // Analytics
  getAnalytics: (from?: string, to?: string) => {
    const q = new URLSearchParams();
    if (from) q.set("from_time", from);
    if (to) q.set("to_time", to);
    return request<AnalyticsSummary>(`/api/analytics/summary?${q}`);
  },

  // Settings
  getSettings: () => request<AppSettings>("/api/settings"),
  updateSettings: (data: Partial<AppSettings>) =>
    request<AppSettings>("/api/settings", { method: "PATCH", body: JSON.stringify(data) }),
  changePassword: (current_password: string, new_password: string) =>
    request<void>("/api/settings/password", {
      method: "POST",
      body: JSON.stringify({ current_password, new_password }),
    }),

  // Tokens
  getTokens: () => request<ApiToken[]>("/api/tokens"),
  createToken: (data: { name: string; expires_at?: string }) =>
    request<ApiToken & { token: string }>("/api/tokens", { method: "POST", body: JSON.stringify(data) }),
  revokeToken: (id: number) => request<void>(`/api/tokens/${id}`, { method: "DELETE" }),
};

// Types
export interface ModelMapping {
  target?: string;
  cost_input_per_1m: number;
  cost_cache_per_1m: number;
  cost_output_per_1m: number;
}

export interface Provider {
  id: number;
  name: string;
  base_url: string;
  api_key: string;
  key_mask: string;
  model_aliases: Record<string, ModelMapping>;
  cost_input_per_1m: number;
  cost_cache_per_1m: number;
  cost_output_per_1m: number;
  weight: number;
  is_active: boolean;
  color: string;
  created_at: string;
  updated_at: string;
  last_test_at: string | null;
  last_test_ok: boolean | null;
  last_test_message: string | null;
  last_test_latency_ms: number | null;
  models_response: Record<string, unknown> | null;
}

export interface ProviderCreate {
  name: string;
  base_url: string;
  api_key: string;
  model_aliases?: Record<string, ModelMapping>;
  cost_input_per_1m?: number;
  cost_cache_per_1m?: number;
  cost_output_per_1m?: number;
  weight?: number;
  is_active?: boolean;
  color?: string;
}

export interface LogItem {
  id: number;
  request_id: string;
  provider_id: number | null;
  provider_name: string;
  provider_color: string;
  model_requested: string;
  model_used: string;
  status_code: number;
  prompt_tokens: number;
  cache_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
  latency_ms: number;
  ttfb_ms: number;
  error_message: string | null;
  timing_dns_ms: number;
  timing_tls_ms: number;
  route: string | null;
  created_at: string;
}

export interface LogDetail extends LogItem {
  request_body: Record<string, unknown> | null;
  response_body: Record<string, unknown> | null;
}

export interface PaginatedLogs {
  items: LogItem[];
  total: number;
  page: number;
  limit: number;
}

export interface LogSummary {
  total_requests: number;
  ok_requests: number;
  error_requests: number;
  error_rate: number;
  total_cost_usd: number;
  avg_cost_per_request: number;
  avg_latency_ms: number;
  avg_ttfb_ms: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_cache_tokens: number;
  total_tokens: number;
}

export interface LogsParams {
  page?: number;
  limit?: number;
  provider?: string;
  model?: string;
  status?: string;
  from_time?: string;
  to_time?: string;
  search?: string;
}

export interface AnalyticsSummary {
  total_requests: number;
  total_cost_usd: number;
  avg_cost_per_req: number;
  avg_latency_ms: number;
  p95_latency_ms: number;
  avg_ttfb_ms: number;
  p95_ttfb_ms: number;
  error_rate: number;
  error_count: number;
  delta_requests: number;
  delta_cost: number;
  delta_latency: number;
  delta_ttfb: number;
  delta_error_rate: number;
  by_provider: Array<{ provider_name: string; provider_color: string; count: number; cost: number }>;
  by_model: Array<{ model: string; count: number; cost: number; avg_cost: number }>;
  cost_over_time: Array<{
    date: string;
    cost: number;
    requests: number;
    prompt_tokens: number;
    cache_tokens: number;
    completion_tokens: number;
  }>;
}

export interface AppSettings {
  admin_username: string;
  proxy_timeout_seconds: number;
  proxy_max_retries: number;
  proxy_retry_backoff: string;
  log_retention_days: number;
  default_currency: string;
  usd_to_toman_rate: number;
  proxy_base_url: string;
  require_proxy_auth: boolean;
}

export interface ApiToken {
  id: number;
  name: string;
  token_prefix: string;
  created_at: string;
  expires_at: string | null;
  last_used_at: string | null;
}
