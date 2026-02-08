import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import WorkflowDesigner from '../components/WorkflowDesigner';

export default function WorkflowNew() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data: {
      name: string;
      description: string;
      triggers: { source: string; event_type: string; conditions: Record<string, string>; sort_order: number }[];
      actions: { target: string; action_type: string; parameters: Record<string, string>; sort_order: number }[];
    }) => api.post('/workflows', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      navigate('/workflows');
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Neuer Workflow</h1>
        <p className="mt-1 text-sm text-gray-500">
          Erstellen Sie einen neuen automatisierten Workflow zwischen Paperless und Lexoffice
        </p>
      </div>

      <WorkflowDesigner
        onSave={(data) => {
          createMutation.mutate({
            name: data.name,
            description: data.description,
            triggers: [
              {
                source: data.trigger.source,
                event_type: data.trigger.event_type,
                conditions: data.trigger.conditions,
                sort_order: 0,
              },
            ],
            actions: data.actions.map((a, idx) => ({
              target: a.target,
              action_type: a.action_type,
              parameters: a.parameters,
              sort_order: idx,
            })),
          });
        }}
        onCancel={() => navigate('/workflows')}
      />
    </div>
  );
}
