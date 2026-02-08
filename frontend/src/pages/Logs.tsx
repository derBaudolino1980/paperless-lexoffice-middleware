import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  XCircle,
  SkipForward,
  Loader2,
  ChevronDown,
  ChevronUp,
  Filter,
  Calendar,
  Search,
  RefreshCw,
} from 'lucide-react';
import { api } from '../api/client';
import type { WorkflowLog, PaginatedResponse } from '../api/client';

type StatusFilterType = 'all' | 'success' | 'error' | 'skipped';

const statusConfig: Record<string, {
  label: string;
  icon: typeof CheckCircle2;
  rowClass: string;
  iconClass: string;
  badgeClass: string;
}> = {
  success: {
    label: 'Erfolgreich',
    icon: CheckCircle2,
    rowClass: 'hover:bg-emerald-50/50',
    iconClass: 'text-emerald-500',
    badgeClass: 'badge-success',
  },
  error: {
    label: 'Fehler',
    icon: XCircle,
    rowClass: 'hover:bg-red-50/50',
    iconClass: 'text-red-500',
    badgeClass: 'badge-error',
  },
  skipped: {
    label: 'Übersprungen',
    icon: SkipForward,
    rowClass: 'hover:bg-gray-50',
    iconClass: 'text-gray-400',
    badgeClass: 'badge-neutral',
  },
  running: {
    label: 'Läuft',
    icon: Loader2,
    rowClass: 'hover:bg-blue-50/50',
    iconClass: 'text-blue-500 animate-spin',
    badgeClass: 'badge-info',
  },
};

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export default function Logs() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: response, refetch, isFetching } = useQuery<PaginatedResponse<WorkflowLog>>({
    queryKey: ['logs'],
    queryFn: () => api.get('/logs', { page_size: 50 }),
  });

  const logs = response?.items || [];

  const filtered = useMemo(() => {
    return logs.filter((log) => {
      if (statusFilter !== 'all' && log.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          log.workflow_id.toLowerCase().includes(q) ||
          (log.error_message && log.error_message.toLowerCase().includes(q)) ||
          log.id.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [logs, statusFilter, searchQuery]);

  const successCount = logs.filter((l) => l.status === 'success').length;
  const errorCount = logs.filter((l) => l.status === 'error').length;
  const skippedCount = logs.filter((l) => l.status === 'skipped').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Protokolle</h1>
          <p className="mt-1 text-sm text-gray-500">
            Übersicht aller Workflow-Ausführungen und deren Ergebnisse
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="btn-secondary"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Aktualisieren
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          <div>
            <p className="text-lg font-bold text-emerald-700">{successCount}</p>
            <p className="text-xs text-emerald-600">Erfolgreich</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-red-100 bg-red-50 px-4 py-3">
          <XCircle className="h-5 w-5 text-red-500" />
          <div>
            <p className="text-lg font-bold text-red-700">{errorCount}</p>
            <p className="text-xs text-red-600">Fehler</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
          <SkipForward className="h-5 w-5 text-gray-400" />
          <div>
            <p className="text-lg font-bold text-gray-700">{skippedCount}</p>
            <p className="text-xs text-gray-500">Übersprungen</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            className="input-field pl-9"
            placeholder="Protokolle durchsuchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1">
            {([
              ['all', 'Alle'],
              ['success', 'Erfolg'],
              ['error', 'Fehler'],
              ['skipped', 'Überspr.'],
            ] as [StatusFilterType, string][]).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setStatusFilter(value)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                  statusFilter === value
                    ? 'bg-brand-600 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80">
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Workflow
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    Zeitpunkt
                  </div>
                </th>
                <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Search className="h-8 w-8 text-gray-300" />
                      <p className="text-sm font-medium text-gray-500">Keine Protokolleinträge gefunden</p>
                      <p className="text-xs text-gray-400">Passen Sie die Filter an oder warten Sie auf neue Ausführungen.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((log) => {
                  const config = statusConfig[log.status] || statusConfig.running;
                  const StatusIcon = config.icon;
                  const isExpanded = expandedId === log.id;

                  return (
                    <tr key={log.id} className="group">
                      <td colSpan={4} className="p-0">
                        <div
                          className={`flex cursor-pointer items-center px-5 py-3.5 transition-colors ${config.rowClass}`}
                          onClick={() => setExpandedId(isExpanded ? null : log.id)}
                        >
                          <div className="flex w-[100px] items-center gap-2">
                            <StatusIcon className={`h-4 w-4 flex-shrink-0 ${config.iconClass}`} />
                            <span className={config.badgeClass}>{config.label}</span>
                          </div>

                          <div className="flex-1 px-5">
                            <p className="text-sm font-medium text-gray-900">
                              Workflow {log.workflow_id.slice(0, 8)}...
                            </p>
                            {log.error_message && (
                              <p className="mt-0.5 truncate text-xs text-red-500">{log.error_message}</p>
                            )}
                          </div>

                          <div className="w-[180px] px-5 text-sm text-gray-500">
                            {formatTimestamp(log.executed_at)}
                          </div>

                          <div className="w-[60px] text-right">
                            {isExpanded ? (
                              <ChevronUp className="ml-auto h-4 w-4 text-gray-400" />
                            ) : (
                              <ChevronDown className="ml-auto h-4 w-4 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100" />
                            )}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-gray-100 bg-gray-50/80 px-5 py-4">
                            <div className="grid gap-4 lg:grid-cols-2">
                              <div>
                                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                                  Eingabedaten
                                </h4>
                                {log.input_data ? (
                                  <pre className="overflow-x-auto rounded-lg bg-white p-3 font-mono text-xs text-gray-700 ring-1 ring-gray-200 scrollbar-thin">
                                    {formatJson(log.input_data)}
                                  </pre>
                                ) : (
                                  <p className="text-xs text-gray-400">Keine Eingabedaten vorhanden</p>
                                )}
                              </div>

                              <div>
                                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                                  {log.status === 'error' ? 'Fehlermeldung' : 'Ausgabedaten'}
                                </h4>
                                {log.status === 'error' && log.error_message ? (
                                  <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 ring-1 ring-red-200">
                                    {log.error_message}
                                  </div>
                                ) : log.output_data ? (
                                  <pre className="overflow-x-auto rounded-lg bg-white p-3 font-mono text-xs text-gray-700 ring-1 ring-gray-200 scrollbar-thin">
                                    {formatJson(log.output_data)}
                                  </pre>
                                ) : (
                                  <p className="text-xs text-gray-400">Keine Ausgabedaten vorhanden</p>
                                )}
                              </div>
                            </div>

                            <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
                              <span>ID: {log.id}</span>
                              <span>Workflow-ID: {log.workflow_id}</span>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
