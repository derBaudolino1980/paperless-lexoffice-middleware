import { useState, useMemo, useCallback } from 'react';
import { Plus, Trash2, GripVertical, Save, Eye } from 'lucide-react';
import MermaidViewer from './MermaidViewer';

interface TriggerConfig {
  source: 'paperless' | 'lexoffice' | 'schedule';
  event_type: string;
  conditions: Record<string, string>;
}

interface ActionConfig {
  id: string;
  target: 'paperless' | 'lexoffice';
  action_type: string;
  parameters: Record<string, string>;
  order: number;
}

interface WorkflowFormData {
  name: string;
  description: string;
  trigger: TriggerConfig;
  actions: ActionConfig[];
}

interface WorkflowDesignerProps {
  initialData?: WorkflowFormData;
  onSave: (data: WorkflowFormData) => void;
  onCancel: () => void;
}

const triggerEvents: Record<string, { label: string; events: { value: string; label: string }[] }> = {
  paperless: {
    label: 'Paperless-ngx',
    events: [
      { value: 'document_created', label: 'Dokument erstellt' },
      { value: 'document_updated', label: 'Dokument aktualisiert' },
      { value: 'document_tagged', label: 'Dokument getaggt' },
      { value: 'document_type_assigned', label: 'Dokumenttyp zugewiesen' },
    ],
  },
  lexoffice: {
    label: 'Lexoffice',
    events: [
      { value: 'invoice_created', label: 'Rechnung erstellt' },
      { value: 'invoice_paid', label: 'Rechnung bezahlt' },
      { value: 'contact_created', label: 'Kontakt erstellt' },
      { value: 'voucher_created', label: 'Beleg erstellt' },
    ],
  },
  schedule: {
    label: 'Zeitplan',
    events: [
      { value: 'cron_daily', label: 'Täglich' },
      { value: 'cron_hourly', label: 'Stündlich' },
      { value: 'cron_weekly', label: 'Wöchentlich' },
      { value: 'cron_custom', label: 'Benutzerdefiniert (Cron)' },
    ],
  },
};

const actionTypes: Record<string, { label: string; actions: { value: string; label: string; params: string[] }[] }> = {
  paperless: {
    label: 'Paperless-ngx',
    actions: [
      { value: 'create_document', label: 'Dokument erstellen', params: ['title', 'correspondent', 'document_type'] },
      { value: 'update_metadata', label: 'Metadaten aktualisieren', params: ['field', 'value'] },
      { value: 'add_tag', label: 'Tag hinzufügen', params: ['tag_name'] },
      { value: 'assign_correspondent', label: 'Korrespondent zuweisen', params: ['correspondent_name'] },
    ],
  },
  lexoffice: {
    label: 'Lexoffice',
    actions: [
      { value: 'create_invoice', label: 'Rechnung erstellen', params: ['contact_id', 'line_items'] },
      { value: 'create_voucher', label: 'Beleg erstellen', params: ['voucher_type', 'amount'] },
      { value: 'create_contact', label: 'Kontakt erstellen', params: ['name', 'email'] },
      { value: 'upload_document', label: 'Dokument hochladen', params: ['voucher_id', 'file_path'] },
    ],
  },
};

const conditionFields: Record<string, { value: string; label: string }[]> = {
  paperless: [
    { value: 'tag', label: 'Tag enthält' },
    { value: 'document_type', label: 'Dokumenttyp ist' },
    { value: 'correspondent', label: 'Korrespondent ist' },
    { value: 'title_contains', label: 'Titel enthält' },
  ],
  lexoffice: [
    { value: 'amount_gt', label: 'Betrag größer als' },
    { value: 'contact_name', label: 'Kontaktname enthält' },
    { value: 'voucher_type', label: 'Belegtyp ist' },
  ],
  schedule: [],
};

function generateId(): string {
  return `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const sourceLabels: Record<string, string> = {
  paperless: 'Paperless-ngx',
  lexoffice: 'Lexoffice',
  schedule: 'Zeitplan',
};

function generateMermaidDefinition(form: WorkflowFormData): string {
  if (!form.trigger.source || !form.trigger.event_type) {
    return '';
  }

  const lines = ['graph LR'];
  const srcLabel = sourceLabels[form.trigger.source] || form.trigger.source;
  const eventLabel = triggerEvents[form.trigger.source]?.events.find(
    (e) => e.value === form.trigger.event_type
  )?.label || form.trigger.event_type;

  lines.push(`  T[("${srcLabel}<br/>${eventLabel}")] --> |Trigger| P{{"PLX Middleware"}}`);

  const conditionEntries = Object.entries(form.trigger.conditions).filter(([, v]) => v);
  if (conditionEntries.length > 0) {
    const condLabel = conditionEntries.map(([k, v]) => `${k}: ${v}`).join(', ');
    lines.push(`  T -. "${condLabel}" .-> C["Bedingungen"]`);
    lines.push('  C --> P');
  }

  if (form.actions.length === 0) {
    lines.push('  P --> |"..."| Z["Ziel konfigurieren"]');
    lines.push('  style Z fill:#94a3b8,stroke:#64748b,color:#fff');
  } else {
    form.actions.forEach((action, index) => {
      const targetLabel = sourceLabels[action.target] || action.target;
      const actLabel = actionTypes[action.target]?.actions.find(
        (a) => a.value === action.action_type
      )?.label || action.action_type || 'Aktion';
      lines.push(`  P --> |"${actLabel}"| A${index}["${targetLabel}"]`);
    });
  }

  lines.push('  style T fill:#0d9488,stroke:#0f766e,color:#fff');
  lines.push('  style P fill:#1e293b,stroke:#334155,color:#fff');
  if (conditionEntries.length > 0) {
    lines.push('  style C fill:#f59e0b,stroke:#d97706,color:#fff');
  }
  form.actions.forEach((_, index) => {
    lines.push(`  style A${index} fill:#0ea5e9,stroke:#0284c7,color:#fff`);
  });

  return lines.join('\n');
}

export default function WorkflowDesigner({ initialData, onSave, onCancel }: WorkflowDesignerProps) {
  const [form, setForm] = useState<WorkflowFormData>(
    initialData || {
      name: '',
      description: '',
      trigger: {
        source: 'paperless',
        event_type: '',
        conditions: {},
      },
      actions: [],
    }
  );
  const [showPreview, setShowPreview] = useState(true);
  const [conditionKey, setConditionKey] = useState('');
  const [conditionValue, setConditionValue] = useState('');

  const mermaidDef = useMemo(() => generateMermaidDefinition(form), [form]);

  const updateTrigger = useCallback((updates: Partial<TriggerConfig>) => {
    setForm((prev) => ({
      ...prev,
      trigger: { ...prev.trigger, ...updates },
    }));
  }, []);

  const addCondition = useCallback(() => {
    if (!conditionKey || !conditionValue) return;
    setForm((prev) => ({
      ...prev,
      trigger: {
        ...prev.trigger,
        conditions: { ...prev.trigger.conditions, [conditionKey]: conditionValue },
      },
    }));
    setConditionKey('');
    setConditionValue('');
  }, [conditionKey, conditionValue]);

  const removeCondition = useCallback((key: string) => {
    setForm((prev) => {
      const newConditions = { ...prev.trigger.conditions };
      delete newConditions[key];
      return {
        ...prev,
        trigger: { ...prev.trigger, conditions: newConditions },
      };
    });
  }, []);

  const addAction = useCallback(() => {
    const newAction: ActionConfig = {
      id: generateId(),
      target: 'lexoffice',
      action_type: '',
      parameters: {},
      order: form.actions.length,
    };
    setForm((prev) => ({
      ...prev,
      actions: [...prev.actions, newAction],
    }));
  }, [form.actions.length]);

  const updateAction = useCallback((index: number, updates: Partial<ActionConfig>) => {
    setForm((prev) => {
      const newActions = [...prev.actions];
      newActions[index] = { ...newActions[index], ...updates };
      return { ...prev, actions: newActions };
    });
  }, []);

  const removeAction = useCallback((index: number) => {
    setForm((prev) => ({
      ...prev,
      actions: prev.actions.filter((_, i) => i !== index).map((a, i) => ({ ...a, order: i })),
    }));
  }, []);

  const updateActionParam = useCallback((actionIndex: number, key: string, value: string) => {
    setForm((prev) => {
      const newActions = [...prev.actions];
      newActions[actionIndex] = {
        ...newActions[actionIndex],
        parameters: { ...newActions[actionIndex].parameters, [key]: value },
      };
      return { ...prev, actions: newActions };
    });
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  const availableConditions = conditionFields[form.trigger.source] || [];
  const availableEvents = triggerEvents[form.trigger.source]?.events || [];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-900">Grundeinstellungen</h3>
            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="wf-name" className="block text-sm font-medium text-gray-700">
                  Name
                </label>
                <input
                  id="wf-name"
                  type="text"
                  className="input-field mt-1"
                  placeholder="z.B. Rechnungen zu Lexoffice"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label htmlFor="wf-desc" className="block text-sm font-medium text-gray-700">
                  Beschreibung
                </label>
                <textarea
                  id="wf-desc"
                  className="input-field mt-1"
                  rows={3}
                  placeholder="Beschreiben Sie den Zweck dieses Workflows..."
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-900">Trigger-Konfiguration</h3>
            <p className="mt-1 text-xs text-gray-500">
              Wann soll dieser Workflow ausgelöst werden?
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="trigger-source" className="block text-sm font-medium text-gray-700">
                  Quelle
                </label>
                <select
                  id="trigger-source"
                  className="input-field mt-1"
                  value={form.trigger.source}
                  onChange={(e) => {
                    const source = e.target.value as TriggerConfig['source'];
                    updateTrigger({ source, event_type: '', conditions: {} });
                  }}
                >
                  {Object.entries(triggerEvents).map(([key, { label }]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="trigger-event" className="block text-sm font-medium text-gray-700">
                  Ereignis
                </label>
                <select
                  id="trigger-event"
                  className="input-field mt-1"
                  value={form.trigger.event_type}
                  onChange={(e) => updateTrigger({ event_type: e.target.value })}
                  required
                >
                  <option value="">Ereignis wählen...</option>
                  {availableEvents.map((event) => (
                    <option key={event.value} value={event.value}>{event.label}</option>
                  ))}
                </select>
              </div>

              {availableConditions.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Bedingungen</label>
                  <div className="mt-2 space-y-2">
                    {Object.entries(form.trigger.conditions).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm">
                        <span className="font-medium text-gray-700">{key}</span>
                        <span className="text-gray-400">=</span>
                        <span className="text-gray-600">{value}</span>
                        <button
                          type="button"
                          onClick={() => removeCondition(key)}
                          className="ml-auto text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <select
                      className="input-field flex-1"
                      value={conditionKey}
                      onChange={(e) => setConditionKey(e.target.value)}
                    >
                      <option value="">Feld wählen...</option>
                      {availableConditions.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      className="input-field flex-1"
                      placeholder="Wert"
                      value={conditionValue}
                      onChange={(e) => setConditionValue(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={addCondition}
                      disabled={!conditionKey || !conditionValue}
                      className="btn-secondary"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Aktionen</h3>
                <p className="mt-1 text-xs text-gray-500">
                  Was soll bei Auslösung passieren?
                </p>
              </div>
              <button type="button" onClick={addAction} className="btn-secondary text-xs">
                <Plus className="h-4 w-4" /> Aktion hinzufügen
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {form.actions.length === 0 && (
                <div className="rounded-lg border-2 border-dashed border-gray-200 p-6 text-center">
                  <p className="text-sm text-gray-400">
                    Noch keine Aktionen definiert. Fügen Sie eine Aktion hinzu.
                  </p>
                </div>
              )}

              {form.actions.map((action, index) => {
                const availableActions = actionTypes[action.target]?.actions || [];
                const selectedAction = availableActions.find((a) => a.value === action.action_type);
                const params = selectedAction?.params || [];

                return (
                  <div
                    key={action.id}
                    className="rounded-lg border border-gray-200 bg-gray-50/50 p-4"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <GripVertical className="h-4 w-4 text-gray-300" />
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs font-medium text-white">
                        {index + 1}
                      </span>
                      <span className="text-sm font-medium text-gray-700">Aktion {index + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeAction(index)}
                        className="ml-auto text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600">Ziel</label>
                        <select
                          className="input-field mt-1"
                          value={action.target}
                          onChange={(e) =>
                            updateAction(index, {
                              target: e.target.value as ActionConfig['target'],
                              action_type: '',
                              parameters: {},
                            })
                          }
                        >
                          {Object.entries(actionTypes).map(([key, { label }]) => (
                            <option key={key} value={key}>{label}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600">Aktionstyp</label>
                        <select
                          className="input-field mt-1"
                          value={action.action_type}
                          onChange={(e) =>
                            updateAction(index, { action_type: e.target.value, parameters: {} })
                          }
                        >
                          <option value="">Aktion wählen...</option>
                          {availableActions.map((a) => (
                            <option key={a.value} value={a.value}>{a.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {params.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <label className="block text-xs font-medium text-gray-600">Parameter</label>
                        {params.map((param) => (
                          <div key={param} className="flex items-center gap-2">
                            <span className="w-32 text-xs text-gray-500">{param}</span>
                            <input
                              type="text"
                              className="input-field flex-1"
                              placeholder={`Wert für ${param}`}
                              value={action.parameters[param] || ''}
                              onChange={(e) => updateActionParam(index, param, e.target.value)}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="sticky top-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Workflow-Vorschau</h3>
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="btn-ghost text-xs"
              >
                <Eye className="h-3.5 w-3.5" />
                {showPreview ? 'Ausblenden' : 'Anzeigen'}
              </button>
            </div>

            {showPreview && (
              <MermaidViewer definition={mermaidDef} title="Live-Vorschau" />
            )}

            {showPreview && mermaidDef && (
              <details className="mt-3 rounded-lg border border-gray-200 bg-white">
                <summary className="cursor-pointer px-4 py-2.5 text-xs font-medium text-gray-600 hover:text-gray-900">
                  Mermaid-Quellcode anzeigen
                </summary>
                <pre className="overflow-x-auto border-t border-gray-100 px-4 py-3 font-mono text-xs text-gray-600">
                  {mermaidDef}
                </pre>
              </details>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-5">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Abbrechen
        </button>
        <button type="submit" className="btn-primary">
          <Save className="h-4 w-4" /> Workflow speichern
        </button>
      </div>
    </form>
  );
}
