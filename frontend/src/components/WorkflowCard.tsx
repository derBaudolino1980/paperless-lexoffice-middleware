import { useState } from 'react';
import {
  Play,
  Pause,
  Pencil,
  Trash2,
  Zap,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Clock,
  FileText,
  Calculator,
  Calendar,
} from 'lucide-react';
import type { Workflow } from '../api/client';
import MermaidViewer from './MermaidViewer';

interface WorkflowCardProps {
  workflow: Workflow;
  onToggle: (id: string, enabled: boolean) => void;
  onExecute: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

const sourceIcons: Record<string, typeof FileText> = {
  paperless: FileText,
  lexoffice: Calculator,
  schedule: Calendar,
};

const sourceLabels: Record<string, string> = {
  paperless: 'Paperless-ngx',
  lexoffice: 'Lexoffice',
  schedule: 'Zeitplan',
};

function generateWorkflowMermaid(workflow: Workflow): string {
  const lines = ['graph LR'];
  const source = workflow.trigger.source;
  const event = workflow.trigger.event_type;

  lines.push(`  T[("${sourceLabels[source]}\\n${event}")] --> |Trigger| P{{"PLX Middleware"}}`);

  workflow.actions.forEach((action, index) => {
    const target = sourceLabels[action.target] || action.target;
    const label = action.action_type;
    lines.push(`  P --> |"${label}"| A${index}["${target}"]`);
  });

  lines.push('  style T fill:#0d9488,stroke:#0f766e,color:#fff');
  lines.push('  style P fill:#1e293b,stroke:#334155,color:#fff');
  workflow.actions.forEach((_, index) => {
    lines.push(`  style A${index} fill:#0ea5e9,stroke:#0284c7,color:#fff`);
  });

  return lines.join('\n');
}

function formatTimestamp(ts: string): string {
  const date = new Date(ts);
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function WorkflowCard({
  workflow,
  onToggle,
  onExecute,
  onEdit,
  onDelete,
}: WorkflowCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const SourceIcon = sourceIcons[workflow.trigger.source] || FileText;
  const mermaidDef = generateWorkflowMermaid(workflow);

  return (
    <div className="card overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-lg ${
              workflow.enabled ? 'bg-brand-50 text-brand-600' : 'bg-gray-100 text-gray-400'
            }`}>
              <SourceIcon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">{workflow.name}</h3>
              <p className="mt-0.5 text-sm text-gray-500">{workflow.description}</p>
            </div>
          </div>

          <span className={workflow.enabled ? 'badge-success' : 'badge-neutral'}>
            {workflow.enabled ? 'Aktiv' : 'Inaktiv'}
          </span>
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
          <div className="flex items-center gap-1.5 rounded-md bg-gray-50 px-2.5 py-1.5">
            <SourceIcon className="h-3.5 w-3.5" />
            <span>{sourceLabels[workflow.trigger.source]}</span>
          </div>
          <ArrowRight className="h-3.5 w-3.5 text-gray-300" />
          {workflow.actions.map((action, idx) => {
            const TargetIcon = sourceIcons[action.target] || FileText;
            return (
              <div key={action.id || idx} className="flex items-center gap-1.5 rounded-md bg-gray-50 px-2.5 py-1.5">
                <TargetIcon className="h-3.5 w-3.5" />
                <span>{sourceLabels[action.target]}</span>
              </div>
            );
          })}
        </div>

        {workflow.last_execution && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-400">
            <Clock className="h-3.5 w-3.5" />
            <span>Letzte Ausf\u00fchrung: {formatTimestamp(workflow.last_execution)}</span>
            <span className="text-gray-300">|</span>
            <span>{workflow.execution_count} Ausf\u00fchrungen gesamt</span>
          </div>
        )}

        <div className="mt-4 flex items-center gap-2 border-t border-gray-100 pt-4">
          <button
            onClick={() => onToggle(workflow.id, !workflow.enabled)}
            className="btn-ghost text-xs"
            title={workflow.enabled ? 'Deaktivieren' : 'Aktivieren'}
          >
            {workflow.enabled ? (
              <><Pause className="h-3.5 w-3.5" /> Deaktivieren</>
            ) : (
              <><Play className="h-3.5 w-3.5" /> Aktivieren</>
            )}
          </button>

          <button
            onClick={() => onExecute(workflow.id)}
            className="btn-ghost text-xs"
            title="Jetzt ausf\u00fchren"
          >
            <Zap className="h-3.5 w-3.5" /> Ausf\u00fchren
          </button>

          <button
            onClick={() => onEdit(workflow.id)}
            className="btn-ghost text-xs"
            title="Bearbeiten"
          >
            <Pencil className="h-3.5 w-3.5" /> Bearbeiten
          </button>

          {confirmDelete ? (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-red-600">Sicher?</span>
              <button
                onClick={() => {
                  onDelete(workflow.id);
                  setConfirmDelete(false);
                }}
                className="btn-danger !py-1.5 !px-2.5 text-xs"
              >
                Ja, l\u00f6schen
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="btn-ghost !py-1.5 text-xs"
              >
                Abbrechen
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="btn-ghost ml-auto text-xs text-red-500 hover:text-red-700"
              title="L\u00f6schen"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            onClick={() => setExpanded(!expanded)}
            className="btn-ghost text-xs"
            title={expanded ? 'Diagramm ausblenden' : 'Diagramm anzeigen'}
          >
            {expanded ? (
              <><ChevronUp className="h-3.5 w-3.5" /> Diagramm</>
            ) : (
              <><ChevronDown className="h-3.5 w-3.5" /> Diagramm</>
            )}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/50 p-4">
          <MermaidViewer definition={mermaidDef} title="Workflow-Diagramm" />
        </div>
      )}
    </div>
  );
}
