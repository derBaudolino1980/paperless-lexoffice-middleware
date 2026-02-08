import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Filter, Search } from 'lucide-react';
import { api } from '../api/client';
import type { Workflow } from '../api/client';
import WorkflowCard from '../components/WorkflowCard';

const mockWorkflows: Workflow[] = [
  {
    id: 'wf1',
    name: 'Rechnungen zu Lexoffice',
    description: 'Neue Rechnungen aus Paperless automatisch als Belege in Lexoffice anlegen',
    enabled: true,
    trigger: {
      source: 'paperless',
      event_type: 'document_tagged',
      conditions: { tag: 'Rechnung' },
    },
    actions: [
      {
        id: 'act1',
        target: 'lexoffice',
        action_type: 'create_voucher',
        parameters: { voucher_type: 'salesinvoice' },
        order: 0,
      },
    ],
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-06-20T14:30:00Z',
    last_execution: new Date(Date.now() - 5 * 60000).toISOString(),
    execution_count: 156,
  },
  {
    id: 'wf2',
    name: 'Belege archivieren',
    description: 'Lexoffice-Belege automatisch in Paperless archivieren und taggen',
    enabled: true,
    trigger: {
      source: 'lexoffice',
      event_type: 'voucher_created',
      conditions: {},
    },
    actions: [
      {
        id: 'act2',
        target: 'paperless',
        action_type: 'create_document',
        parameters: { document_type: 'Beleg', title: 'Lexoffice Beleg' },
        order: 0,
      },
      {
        id: 'act3',
        target: 'paperless',
        action_type: 'add_tag',
        parameters: { tag_name: 'Lexoffice-Import' },
        order: 1,
      },
    ],
    created_at: '2024-02-10T09:00:00Z',
    updated_at: '2024-06-18T11:00:00Z',
    last_execution: new Date(Date.now() - 15 * 60000).toISOString(),
    execution_count: 89,
  },
  {
    id: 'wf3',
    name: 'Kontakte synchronisieren',
    description: 'Korrespondenten aus Paperless mit Lexoffice-Kontakten abgleichen',
    enabled: false,
    trigger: {
      source: 'schedule',
      event_type: 'cron_daily',
      conditions: {},
    },
    actions: [
      {
        id: 'act4',
        target: 'lexoffice',
        action_type: 'create_contact',
        parameters: {},
        order: 0,
      },
    ],
    created_at: '2024-03-01T08:00:00Z',
    updated_at: '2024-05-15T16:45:00Z',
    last_execution: new Date(Date.now() - 30 * 60000).toISOString(),
    execution_count: 23,
  },
  {
    id: 'wf4',
    name: 'Dokumenttyp-Erkennung',
    description: 'Neue Dokumente in Paperless automatisch klassifizieren und den passenden Typ zuweisen',
    enabled: true,
    trigger: {
      source: 'paperless',
      event_type: 'document_created',
      conditions: {},
    },
    actions: [
      {
        id: 'act5',
        target: 'paperless',
        action_type: 'update_metadata',
        parameters: { field: 'document_type', value: 'auto' },
        order: 0,
      },
    ],
    created_at: '2024-04-20T12:00:00Z',
    updated_at: '2024-06-22T09:30:00Z',
    last_execution: new Date(Date.now() - 90 * 60000).toISOString(),
    execution_count: 312,
  },
];

type StatusFilter = 'all' | 'enabled' | 'disabled';

export default function Workflows() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const { data: workflows } = useQuery<Workflow[]>({
    queryKey: ['workflows'],
    queryFn: () => api.get('/workflows'),
    placeholderData: mockWorkflows,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.patch(`/workflows/${id}`, { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workflows'] }),
  });

  const executeMutation = useMutation({
    mutationFn: (id: string) => api.post(`/workflows/${id}/execute`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      queryClient.invalidateQueries({ queryKey: ['recent-executions'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/workflows/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workflows'] }),
  });

  const displayWorkflows = workflows || mockWorkflows;

  const filtered = displayWorkflows.filter((wf) => {
    if (statusFilter === 'enabled' && !wf.enabled) return false;
    if (statusFilter === 'disabled' && wf.enabled) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        wf.name.toLowerCase().includes(q) ||
        wf.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const activeCount = displayWorkflows.filter((wf) => wf.enabled).length;
  const inactiveCount = displayWorkflows.filter((wf) => !wf.enabled).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workflows</h1>
          <p className="mt-1 text-sm text-gray-500">
            Verwalten Sie Ihre automatisierten Workflows zwischen Paperless und Lexoffice
          </p>
        </div>
        <button onClick={() => navigate('/workflows/new')} className="btn-primary">
          <Plus className="h-4 w-4" /> Neuer Workflow
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            className="input-field pl-9"
            placeholder="Workflows durchsuchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1">
          <Filter className="ml-2 h-4 w-4 text-gray-400" />
          {([
            ['all', `Alle (${displayWorkflows.length})`],
            ['enabled', `Aktiv (${activeCount})`],
            ['disabled', `Inaktiv (${inactiveCount})`],
          ] as [StatusFilter, string][]).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
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

      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            <Search className="h-6 w-6 text-gray-400" />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-gray-900">Keine Workflows gefunden</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchQuery
              ? 'Versuchen Sie eine andere Suchanfrage.'
              : 'Erstellen Sie Ihren ersten Workflow.'}
          </p>
          {!searchQuery && (
            <button
              onClick={() => navigate('/workflows/new')}
              className="btn-primary mt-4"
            >
              <Plus className="h-4 w-4" /> Workflow erstellen
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((wf) => (
            <WorkflowCard
              key={wf.id}
              workflow={wf}
              onToggle={(id, enabled) => toggleMutation.mutate({ id, enabled })}
              onExecute={(id) => executeMutation.mutate(id)}
              onEdit={(id) => navigate(`/workflows/${id}/edit`)}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
