import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Filter, Search } from 'lucide-react';
import { api } from '../api/client';
import type { Workflow, PaginatedResponse } from '../api/client';
import WorkflowCard from '../components/WorkflowCard';

type StatusFilter = 'all' | 'enabled' | 'disabled';

export default function Workflows() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const { data: response } = useQuery<PaginatedResponse<Workflow>>({
    queryKey: ['workflows'],
    queryFn: () => api.get('/workflows'),
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
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/workflows/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workflows'] }),
  });

  const workflows = response?.items || [];

  const filtered = workflows.filter((wf) => {
    if (statusFilter === 'enabled' && !wf.enabled) return false;
    if (statusFilter === 'disabled' && wf.enabled) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        wf.name.toLowerCase().includes(q) ||
        (wf.description || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const activeCount = workflows.filter((wf) => wf.enabled).length;
  const inactiveCount = workflows.filter((wf) => !wf.enabled).length;

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
            ['all', `Alle (${workflows.length})`],
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
