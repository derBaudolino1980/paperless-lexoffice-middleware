const API_BASE = '/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body: unknown,
  ) {
    super(`API-Fehler: ${status} ${statusText}`);
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = await response.text();
    }
    throw new ApiError(response.status, response.statusText, body);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json();
}

function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
  const url = `${API_BASE}${path}`;
  if (!params) return url;
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      searchParams.append(key, String(value));
    }
  });
  const qs = searchParams.toString();
  return qs ? `${url}?${qs}` : url;
}

export const api = {
  async get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    const response = await fetch(buildUrl(path, params), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse<T>(response);
  },

  async post<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(buildUrl(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(response);
  },

  async put<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(buildUrl(path), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(response);
  },

  async patch<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(buildUrl(path), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(response);
  },

  async delete<T>(path: string): Promise<T> {
    const response = await fetch(buildUrl(path), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse<T>(response);
  },
};

// ── Paginated response wrapper ─────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

// ── Workflow types (match backend schemas) ──────────────────────

export interface WorkflowTrigger {
  id?: string;
  workflow_id?: string;
  source: 'paperless' | 'lexoffice' | 'schedule';
  event_type: string;
  conditions?: Record<string, unknown>;
  sort_order: number;
}

export interface WorkflowAction {
  id?: string;
  workflow_id?: string;
  target: 'paperless' | 'lexoffice';
  action_type: string;
  parameters?: Record<string, unknown>;
  sort_order: number;
}

export interface Workflow {
  id: string;
  name: string;
  description: string | null;
  mermaid_definition: string | null;
  enabled: boolean;
  triggers: WorkflowTrigger[];
  actions: WorkflowAction[];
  created_at: string;
  updated_at: string;
}

export interface WorkflowListItem {
  id: string;
  name: string;
  description: string | null;
  mermaid_definition: string | null;
  enabled: boolean;
  trigger_count: number;
  action_count: number;
  created_at: string;
  updated_at: string;
}

// ── Log types (match backend WorkflowLogRead) ──────────────────

export interface WorkflowLog {
  id: string;
  workflow_id: string;
  status: string;
  input_data?: Record<string, unknown>;
  output_data?: Record<string, unknown>;
  error_message?: string | null;
  executed_at: string;
}

// ── Dashboard types (match backend DashboardStats) ─────────────

export interface DashboardStats {
  total_workflows: number;
  active_workflows: number;
  total_executions: number;
  successful_executions: number;
  failed_executions: number;
  total_mappings: number;
  recent_logs: {
    id: string;
    workflow_id: string;
    status: string;
    error_message?: string | null;
    executed_at: string | null;
  }[];
}

// ── Connection types ───────────────────────────────────────────

export interface ConnectionTestResponse {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface ConnectionSaveResponse {
  success: boolean;
  message: string;
}
