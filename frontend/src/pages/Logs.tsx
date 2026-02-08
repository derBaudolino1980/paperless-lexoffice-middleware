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
  Clock,
  Search,
  RefreshCw,
} from 'lucide-react';
import { api } from '../api/client';
import type { WorkflowExecution } from '../api/client';

const mockLogs: WorkflowExecution[] = [
  {
    id: 'ex1',
    workflow_id: 'wf1',
    workflow_name: 'Rechnungen zu Lexoffice',
    status: 'success',
    started_at: new Date(Date.now() - 5 * 60000).toISOString(),
    finished_at: new Date(Date.now() - 4.8 * 60000).toISOString(),
    duration_ms: 1230,
    input_data: { document_id: 42, title: 'Rechnung 2024-001', tags: ['Rechnung', 'Firma ABC'] },
    output_data: { voucher_id: 'lx-v-001', status: 'created' },
  },
  {
    id: 'ex2',
    workflow_id: 'wf2',
    workflow_name: 'Belege archivieren',
    status: 'success',
    started_at: new Date(Date.now() - 15 * 60000).toISOString(),
    finished_at: new Date(Date.now() - 14.5 * 60000).toISOString(),
    duration_ms: 890,
    input_data: { voucher_id: 'lx-v-002', type: 'purchaseinvoice' },
    output_data: { document_id: 43, tags_added: ['Lexoffice-Import'] },
  },
  {
    id: 'ex3',
    workflow_id: 'wf3',
    workflow_name: 'Kontakte synchronisieren',
    status: 'error',
    started_at: new Date(Date.now() - 30 * 60000).toISOString(),
    finished_at: new Date(Date.now() - 29.8 * 60000).toISOString(),
    duration_ms: 4520,
    input_data: { correspondent_id: 12, name: 'Muster GmbH' },
    error_message: 'Lexoffice API: Rate limit erreicht (429 Too Many Requests)',
  },
  {
    id: 'ex4',
    workflow_id: 'wf1',
    workflow_name: 'Rechnungen zu Lexoffice',
    status: 'success',
    started_at: new Date(Date.now() - 60 * 60000).toISOString(),
    finished_at: new Date(Date.now() - 59.5 * 60000).toISOString(),
    duration_ms: 1100,
    input_data: { document_id: 41, title: 'Rechnung 2024-002', tags: ['Rechnung'] },
    output_data: { voucher_id: 'lx-v-003', status: 'created' },
  },
  {
    id: 'ex5',
    workflow_id: 'wf4',
    workflow_name: 'Dokumenttyp-Erkennung',
    status: 'skipped',
    started_at: new Date(Date.now() - 90 * 60000).toISOString(),
    finished_at: new Date(Date.now() - 90 * 60000).toISOString(),
    duration_ms: 45,
    input_data: { document_id: 40, title: 'Scan_2024_03.pdf' },
    output_data: { reason: 'Dokumenttyp bereits zugewiesen' },
  },
  {
    id: 'ex6',
    workflow_id: 'wf1',
    workflow_name: 'Rechnungen zu Lexoffice',
    status: 'success',
    started_at: new Date(Date.now() - 120 * 60000).toISOString(),
    finished_at: new Date(Date.now() - 119.8 * 60000).toISOString(),
    duration_ms: 980,
    input_data: { document_id: 39, title: 'Rechnung RE-2024-100' },
    output_data: { voucher_id: 'lx-v-004', status: 'created' },
  },
  {
    id: 'ex7',
    workflow_id: 'wf2',
    workflow_name: 'Belege archivieren',
    status: 'error',
    started_at: new Date(Date.now() - 180 * 60000).toISOString(),
    finished_at: new Date(Date.now() - 179.5 * 60000).toISOString(),
    duration_ms: 15200,
    input_data: { voucher_id: 'lx-v-005', type: 'salesinvoice' },
    error_message: 'Paperless API: Datei-Upload fehlgeschlagen (413 Payload Too Large)',
  },
  {
    id: 'ex8',
    workflow_id: 'wf4',
    workflow_name: 'Dokumenttyp-Erkennung',
    status: 'success',
    started_at: new Date(Date.now() - 240 * 60000).toISOString(),
    finished_at: new Date(Date.now() - 239.8 * 60000).toISOString(),
    duration_ms: 2340,
    input_data: { document_id: 38, title: 'Vertrag_Muster.pdf' },
    output_data: { detected_type: 'Vertrag', confidence: 0.94 },
  },
];

type StatusFilterType = 'all' | 'success' | 'error' | 'skipped';

const statusConfig = {
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
    label: '\u00dcbersprungen',
    icon: SkipForward,
    rowClass: 'hover:bg-gray-50',
    iconClass: 'text-gray-400',
    badgeClass: 'badge-neutral',
  },
  running: {
    label: 'L\u00e4uft',
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

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export default function Logs() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('all');
  const [workflowFilter, setWorkflowFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: logs, refetch, isFetching } = useQuery<WorkflowExecution[]>({
    queryKey: ['executions'],
    queryFn: () => api.get('/executions'),
    placeholderData: mockLogs,
  });

  const displayLogs = logs || mockLogs;

  const workflowNames = useMemo(() => {
    const names = new Set(displayLogs.map((l) => l.workflow_name));
    return Array.from(names).sort();
  }, [displayLogs]);

  const filtered = useMemo(() => {
    return displayLogs.filter((log) => {
      if (statusFilter !== 'all' && log.status !== statusFilter) return false;
      if (workflowFilter && log.workflow_name !== workflowFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          log.workflow_name.toLowerCase().includes(q) ||
          (log.error_message && log.error_message.toLowerCase().includes(q)) ||
          log.id.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [displayLogs, statusFilter, workflowFilter, searchQuery]);

  const successCount = displayLogs.filter((l) => l.status === 'success').length;
  const errorCount = displayLogs.filter((l) => l.status === 'error').length;
  const skippedCount = displayLogs.filter((l) => l.status === 'skipped').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Protokolle</h1>
          <p className="mt-1 text-sm text-gray-500">
            \u00dcbersicht aller Workflow-Ausf\u00fchrungen und deren Ergebnisse
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
            <p className="text-xs text-gray-500">\u00dcbersprungen</p>
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
          <select
            className="input-field w-auto"
            value={workflowFilter}
            onChange={(e) => setWorkflowFilter(e.target.value)}
          >
            <option value="">Alle Workflows</option>
            {workflowNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>

          <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1">
            {([
              ['all', 'Alle'],
              ['success', 'Erfolg'],
              ['error', 'Fehler'],
              ['skipped', '\u00dcberspr.'],
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
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    Dauer
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
                  <td colSpan={5} className="px-5 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Search className="h-8 w-8 text-gray-300" />
                      <p className="text-sm font-medium text-gray-500">Keine Protokolleintr\u00e4ge gefunden</p>
                      <p className="text-xs text-gray-400">Passen Sie die Filter an oder warten Sie auf neue Ausf\u00fchrungen.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((log) => {
                  const config = statusConfig[log.status];
                  const StatusIcon = config.icon;
                  const isExpanded = expandedId === log.id;

                  return (
                    <tr key={log.id} className="group">
                      <td colSpan={5} className="p-0">
                        <div
                          className={`flex cursor-pointer items-center px-5 py-3.5 transition-colors ${config.rowClass}`}
                          onClick={() => setExpandedId(isExpanded ? null : log.id)}
                        >
                          <div className="flex w-[100px] items-center gap-2">
                            <StatusIcon className={`h-4 w-4 flex-shrink-0 ${config.iconClass}`} />
                            <span className={config.badgeClass}>{config.label}</span>
                          </div>

                          <div className="flex-1 px-5">
                            <p className="text-sm font-medium text-gray-900">{log.workflow_name}</p>
                            {log.error_message && (
                              <p className="mt-0.5 truncate text-xs text-red-500">{log.error_message}</p>
                            )}
                          </div>

                          <div className="w-[180px] px-5 text-sm text-gray-500">
                            {formatTimestamp(log.started_at)}
                          </div>

                          <div className="w-[80px] px-5 text-sm text-gray-500">
                            {log.duration_ms !== undefined ? formatDuration(log.duration_ms) : '-'}
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
                              {log.finished_at && (
                                <span>Beendet: {formatTimestamp(log.finished_at)}</span>
                              )}
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
