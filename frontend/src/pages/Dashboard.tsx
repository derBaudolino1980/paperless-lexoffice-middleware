import { useQuery } from '@tanstack/react-query';
import {
  Workflow,
  Activity,
  CheckCircle2,
  Link2,
  TrendingUp,
  Clock,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { api } from '../api/client';
import type { DashboardStats, WorkflowExecution } from '../api/client';
import MermaidViewer from '../components/MermaidViewer';

const SYSTEM_ARCHITECTURE_DIAGRAM = `graph TB
  subgraph Paperless["Paperless-ngx"]
    P1["Dokumente"]
    P2["Tags & Metadaten"]
    P3["Korrespondenten"]
  end

  subgraph PLX["PLX Middleware"]
    M1{{"Trigger Engine"}}
    M2{{"Regel-Prozessor"}}
    M3{{"Aktions-Manager"}}
    M1 --> M2
    M2 --> M3
  end

  subgraph Lexoffice["Lexoffice"]
    L1["Rechnungen"]
    L2["Belege"]
    L3["Kontakte"]
  end

  P1 --> |Webhook| M1
  P2 --> |Events| M1
  P3 --> |Updates| M1
  L1 --> |Callback| M1
  L2 --> |Events| M1

  M3 --> |API| P1
  M3 --> |API| P2
  M3 --> |API| L1
  M3 --> |API| L2
  M3 --> |API| L3

  style Paperless fill:#059669,stroke:#047857,color:#fff
  style PLX fill:#1e293b,stroke:#334155,color:#fff
  style Lexoffice fill:#0284c7,stroke:#0369a1,color:#fff
  style M1 fill:#0d9488,stroke:#0f766e,color:#fff
  style M2 fill:#0d9488,stroke:#0f766e,color:#fff
  style M3 fill:#0d9488,stroke:#0f766e,color:#fff
`;

const mockStats: DashboardStats = {
  active_workflows: 5,
  total_workflows: 8,
  executions_today: 42,
  success_rate: 97.6,
  connected_systems: 2,
  total_systems: 2,
};

const mockExecutions: WorkflowExecution[] = [
  {
    id: '1',
    workflow_id: 'wf1',
    workflow_name: 'Rechnungen zu Lexoffice',
    status: 'success',
    started_at: new Date(Date.now() - 5 * 60000).toISOString(),
    finished_at: new Date(Date.now() - 4.8 * 60000).toISOString(),
    duration_ms: 1230,
  },
  {
    id: '2',
    workflow_id: 'wf2',
    workflow_name: 'Belege archivieren',
    status: 'success',
    started_at: new Date(Date.now() - 15 * 60000).toISOString(),
    finished_at: new Date(Date.now() - 14.5 * 60000).toISOString(),
    duration_ms: 890,
  },
  {
    id: '3',
    workflow_id: 'wf3',
    workflow_name: 'Kontakte synchronisieren',
    status: 'error',
    started_at: new Date(Date.now() - 30 * 60000).toISOString(),
    finished_at: new Date(Date.now() - 29.8 * 60000).toISOString(),
    duration_ms: 4520,
    error_message: 'Lexoffice API: Rate limit erreicht',
  },
  {
    id: '4',
    workflow_id: 'wf1',
    workflow_name: 'Rechnungen zu Lexoffice',
    status: 'success',
    started_at: new Date(Date.now() - 60 * 60000).toISOString(),
    finished_at: new Date(Date.now() - 59.5 * 60000).toISOString(),
    duration_ms: 1100,
  },
  {
    id: '5',
    workflow_id: 'wf4',
    workflow_name: 'Dokumenttyp-Erkennung',
    status: 'skipped',
    started_at: new Date(Date.now() - 90 * 60000).toISOString(),
    finished_at: new Date(Date.now() - 90 * 60000).toISOString(),
    duration_ms: 45,
  },
];

function formatRelativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Gerade eben';
  if (minutes < 60) return `Vor ${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  return `Vor ${days} Tag${days > 1 ? 'en' : ''}`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const statusConfig = {
  success: { label: 'Erfolgreich', class: 'badge-success', icon: CheckCircle2 },
  error: { label: 'Fehler', class: 'badge-error', icon: AlertCircle },
  skipped: { label: 'Uebersprungen', class: 'badge-neutral', icon: ArrowRight },
  running: { label: 'Laeuft', class: 'badge-info', icon: Activity },
};

export default function Dashboard() {
  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/stats'),
    placeholderData: mockStats,
  });

  const { data: executions } = useQuery<WorkflowExecution[]>({
    queryKey: ['recent-executions'],
    queryFn: () => api.get('/executions/recent'),
    placeholderData: mockExecutions,
  });

  const displayStats = stats || mockStats;
  const displayExecutions = executions || mockExecutions;

  const statCards = [
    {
      label: 'Aktive Workflows',
      value: displayStats.active_workflows,
      subtitle: `von ${displayStats.total_workflows} gesamt`,
      icon: Workflow,
      color: 'text-brand-600 bg-brand-50',
    },
    {
      label: 'Ausf\u00fchrungen heute',
      value: displayStats.executions_today,
      subtitle: 'seit Mitternacht',
      icon: Activity,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      label: 'Erfolgsrate',
      value: `${displayStats.success_rate}%`,
      subtitle: 'letzte 24 Stunden',
      icon: TrendingUp,
      color: 'text-emerald-600 bg-emerald-50',
    },
    {
      label: 'Verbundene Systeme',
      value: displayStats.connected_systems,
      subtitle: `von ${displayStats.total_systems} konfiguriert`,
      icon: Link2,
      color: 'text-violet-600 bg-violet-50',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          \u00dcbersicht \u00fcber Ihre Paperless-Lexoffice Integration
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.label} className="card p-5">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.color}`}>
                <card.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                <p className="text-xs font-medium text-gray-500">{card.label}</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-400">{card.subtitle}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Letzte Ausf\u00fchrungen</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {displayExecutions.map((exec) => {
              const config = statusConfig[exec.status];
              const StatusIcon = config.icon;

              return (
                <div key={exec.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50">
                  <StatusIcon
                    className={`h-4 w-4 flex-shrink-0 ${
                      exec.status === 'success'
                        ? 'text-emerald-500'
                        : exec.status === 'error'
                        ? 'text-red-500'
                        : 'text-gray-400'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {exec.workflow_name}
                    </p>
                    {exec.error_message && (
                      <p className="truncate text-xs text-red-500">{exec.error_message}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    {exec.duration_ms !== undefined && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(exec.duration_ms)}
                      </span>
                    )}
                    <span>{formatRelativeTime(exec.started_at)}</span>
                    <span className={config.class}>{config.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Systemstatus</h2>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3 rounded-lg bg-gray-50 px-4 py-3">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Paperless-ngx</p>
                <p className="text-xs text-gray-500">Verbunden - API erreichbar</p>
              </div>
              <span className="badge-success">Online</span>
            </div>

            <div className="flex items-center gap-3 rounded-lg bg-gray-50 px-4 py-3">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Lexoffice</p>
                <p className="text-xs text-gray-500">Verbunden - API erreichbar</p>
              </div>
              <span className="badge-success">Online</span>
            </div>

            <div className="flex items-center gap-3 rounded-lg bg-gray-50 px-4 py-3">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">PLX Middleware</p>
                <p className="text-xs text-gray-500">Backend aktiv - Alle Dienste laufen</p>
              </div>
              <span className="badge-success">Aktiv</span>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Systemarchitektur</h2>
        <MermaidViewer
          definition={SYSTEM_ARCHITECTURE_DIAGRAM}
          title="Gesamtsystem\u00fcbersicht"
        />
      </div>
    </div>
  );
}
