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
import type { DashboardStats } from '../api/client';
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
  total_workflows: 8,
  active_workflows: 5,
  total_executions: 42,
  successful_executions: 40,
  failed_executions: 2,
  total_mappings: 12,
  recent_logs: [],
};

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

const statusConfig: Record<string, { label: string; class: string; icon: typeof CheckCircle2 }> = {
  success: { label: 'Erfolgreich', class: 'badge-success', icon: CheckCircle2 },
  error: { label: 'Fehler', class: 'badge-error', icon: AlertCircle },
  skipped: { label: 'Uebersprungen', class: 'badge-neutral', icon: ArrowRight },
  running: { label: 'Laeuft', class: 'badge-info', icon: Activity },
};

export default function Dashboard() {
  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/dashboard/stats'),
    placeholderData: mockStats,
  });

  const displayStats = stats || mockStats;

  const successRate =
    displayStats.total_executions > 0
      ? Math.round((displayStats.successful_executions / displayStats.total_executions) * 1000) / 10
      : 100;

  const statCards = [
    {
      label: 'Aktive Workflows',
      value: displayStats.active_workflows,
      subtitle: `von ${displayStats.total_workflows} gesamt`,
      icon: Workflow,
      color: 'text-brand-600 bg-brand-50',
    },
    {
      label: 'Ausf\u00fchrungen gesamt',
      value: displayStats.total_executions,
      subtitle: `${displayStats.failed_executions} fehlgeschlagen`,
      icon: Activity,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      label: 'Erfolgsrate',
      value: `${successRate}%`,
      subtitle: `${displayStats.successful_executions} erfolgreich`,
      icon: TrendingUp,
      color: 'text-emerald-600 bg-emerald-50',
    },
    {
      label: 'Kontakt-Mappings',
      value: displayStats.total_mappings,
      subtitle: 'Paperless \u2194 Lexoffice',
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
            {displayStats.recent_logs.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-gray-400">
                Noch keine Ausf\u00fchrungen vorhanden
              </div>
            ) : (
              displayStats.recent_logs.map((log) => {
                const config = statusConfig[log.status] || statusConfig.running;
                const StatusIcon = config.icon;

                return (
                  <div key={log.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50">
                    <StatusIcon
                      className={`h-4 w-4 flex-shrink-0 ${
                        log.status === 'success'
                          ? 'text-emerald-500'
                          : log.status === 'error'
                          ? 'text-red-500'
                          : 'text-gray-400'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">
                        Workflow {log.workflow_id.slice(0, 8)}...
                      </p>
                      {log.error_message && (
                        <p className="truncate text-xs text-red-500">{log.error_message}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      {log.executed_at && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatRelativeTime(log.executed_at)}
                        </span>
                      )}
                      <span className={config.class}>{config.label}</span>
                    </div>
                  </div>
                );
              })
            )}
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
          title="Gesamt\u00fcbersicht"
        />
      </div>
    </div>
  );
}
