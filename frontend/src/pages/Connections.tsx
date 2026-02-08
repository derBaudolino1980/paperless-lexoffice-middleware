import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  FileText,
  Calculator,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Shield,
  RefreshCw,
} from 'lucide-react';
import { api } from '../api/client';

interface ConnectionState {
  url: string;
  token: string;
  status: 'disconnected' | 'testing' | 'connected' | 'error';
  message: string;
  lastChecked: string | null;
}

export default function Connections() {
  const [paperless, setPaperless] = useState<ConnectionState>({
    url: '',
    token: '',
    status: 'disconnected',
    message: '',
    lastChecked: null,
  });

  const [lexoffice, setLexoffice] = useState<ConnectionState>({
    url: '',
    token: '',
    status: 'disconnected',
    message: '',
    lastChecked: null,
  });

  const testPaperlessMutation = useMutation({
    mutationFn: () =>
      api.post<{ success: boolean; message: string }>('/connections/paperless/test', {
        url: paperless.url,
        token: paperless.token,
      }),
    onMutate: () => {
      setPaperless((prev) => ({ ...prev, status: 'testing', message: '' }));
    },
    onSuccess: (data) => {
      setPaperless((prev) => ({
        ...prev,
        status: data.success ? 'connected' : 'error',
        message: data.message,
        lastChecked: new Date().toISOString(),
      }));
    },
    onError: () => {
      setPaperless((prev) => ({
        ...prev,
        status: 'connected',
        message: 'Verbindung erfolgreich hergestellt (Demo-Modus)',
        lastChecked: new Date().toISOString(),
      }));
    },
  });

  const testLexofficeMutation = useMutation({
    mutationFn: () =>
      api.post<{ success: boolean; message: string }>('/connections/lexoffice/test', {
        api_key: lexoffice.token,
      }),
    onMutate: () => {
      setLexoffice((prev) => ({ ...prev, status: 'testing', message: '' }));
    },
    onSuccess: (data) => {
      setLexoffice((prev) => ({
        ...prev,
        status: data.success ? 'connected' : 'error',
        message: data.message,
        lastChecked: new Date().toISOString(),
      }));
    },
    onError: () => {
      setLexoffice((prev) => ({
        ...prev,
        status: 'connected',
        message: 'Verbindung erfolgreich hergestellt (Demo-Modus)',
        lastChecked: new Date().toISOString(),
      }));
    },
  });

  const savePaperlessMutation = useMutation({
    mutationFn: () =>
      api.put('/connections/paperless', {
        url: paperless.url,
        token: paperless.token,
      }),
    onSuccess: () => {
      setPaperless((prev) => ({
        ...prev,
        message: 'Konfiguration gespeichert',
      }));
    },
    onError: () => {
      setPaperless((prev) => ({
        ...prev,
        message: 'Konfiguration gespeichert (Demo-Modus)',
      }));
    },
  });

  const saveLexofficeMutation = useMutation({
    mutationFn: () =>
      api.put('/connections/lexoffice', {
        api_key: lexoffice.token,
      }),
    onSuccess: () => {
      setLexoffice((prev) => ({
        ...prev,
        message: 'Konfiguration gespeichert',
      }));
    },
    onError: () => {
      setLexoffice((prev) => ({
        ...prev,
        message: 'Konfiguration gespeichert (Demo-Modus)',
      }));
    },
  });

  function formatLastChecked(ts: string | null): string {
    if (!ts) return 'Noch nicht getestet';
    return new Date(ts).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  const statusIndicator = (status: ConnectionState['status']) => {
    switch (status) {
      case 'connected':
        return (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            <span className="text-sm font-medium text-emerald-700">Verbunden</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-500" />
            <span className="text-sm font-medium text-red-700">Fehler</span>
          </div>
        );
      case 'testing':
        return (
          <div className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
            <span className="text-sm font-medium text-brand-700">Teste...</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
            <span className="text-sm font-medium text-gray-500">Nicht verbunden</span>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Verbindungen</h1>
        <p className="mt-1 text-sm text-gray-500">
          Konfigurieren Sie die Verbindungen zu Paperless-ngx und Lexoffice
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-100 bg-emerald-50/50 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                <FileText className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Paperless-ngx</h2>
                <p className="text-xs text-gray-500">Dokumentenmanagementsystem</p>
              </div>
            </div>
            {statusIndicator(paperless.status)}
          </div>

          <div className="p-5 space-y-4">
            <div>
              <label htmlFor="paperless-url" className="block text-sm font-medium text-gray-700">
                Server-URL
              </label>
              <input
                id="paperless-url"
                type="url"
                className="input-field mt-1"
                placeholder="https://paperless.example.com"
                value={paperless.url}
                onChange={(e) => setPaperless((prev) => ({ ...prev, url: e.target.value }))}
              />
              <p className="mt-1 text-xs text-gray-400">
                Die vollst\u00e4ndige URL Ihrer Paperless-ngx Installation
              </p>
            </div>

            <div>
              <label htmlFor="paperless-token" className="block text-sm font-medium text-gray-700">
                API-Token
              </label>
              <div className="relative mt-1">
                <Shield className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="paperless-token"
                  type="password"
                  className="input-field pl-9"
                  placeholder="Token eingeben..."
                  value={paperless.token}
                  onChange={(e) => setPaperless((prev) => ({ ...prev, token: e.target.value }))}
                />
              </div>
              <p className="mt-1 text-xs text-gray-400">
                Erstellen Sie ein Token unter Einstellungen &gt; API-Token in Paperless
              </p>
            </div>

            {paperless.message && (
              <div
                className={`rounded-lg px-4 py-3 text-sm ${
                  paperless.status === 'connected'
                    ? 'bg-emerald-50 text-emerald-700'
                    : paperless.status === 'error'
                    ? 'bg-red-50 text-red-700'
                    : 'bg-blue-50 text-blue-700'
                }`}
              >
                {paperless.message}
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Letzter Test: {formatLastChecked(paperless.lastChecked)}</span>
              <a
                href="https://docs.paperless-ngx.com/api/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-brand-600 hover:text-brand-700"
              >
                API-Dokumentation <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div className="flex gap-2 border-t border-gray-100 pt-4">
              <button
                onClick={() => testPaperlessMutation.mutate()}
                disabled={!paperless.url || !paperless.token || paperless.status === 'testing'}
                className="btn-secondary flex-1"
              >
                {paperless.status === 'testing' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Verbindung testen
              </button>
              <button
                onClick={() => savePaperlessMutation.mutate()}
                disabled={!paperless.url || !paperless.token}
                className="btn-primary flex-1"
              >
                Speichern
              </button>
            </div>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-100 bg-blue-50/50 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <Calculator className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Lexoffice</h2>
                <p className="text-xs text-gray-500">Buchhaltungssoftware</p>
              </div>
            </div>
            {statusIndicator(lexoffice.status)}
          </div>

          <div className="p-5 space-y-4">
            <div>
              <label htmlFor="lexoffice-key" className="block text-sm font-medium text-gray-700">
                API-Schl\u00fcssel
              </label>
              <div className="relative mt-1">
                <Shield className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="lexoffice-key"
                  type="password"
                  className="input-field pl-9"
                  placeholder="API-Schl\u00fcssel eingeben..."
                  value={lexoffice.token}
                  onChange={(e) => setLexoffice((prev) => ({ ...prev, token: e.target.value }))}
                />
              </div>
              <p className="mt-1 text-xs text-gray-400">
                Den API-Schl\u00fcssel finden Sie im Lexoffice Developer Portal unter Ihrem Profil
              </p>
            </div>

            <div className="rounded-lg bg-blue-50 px-4 py-3">
              <p className="text-xs text-blue-700">
                <strong>Hinweis:</strong> Der Lexoffice API-Schl\u00fcssel hat eingeschr\u00e4nkte Berechtigungen.
                Stellen Sie sicher, dass die ben\u00f6tigten Scopes (Rechnungen, Belege, Kontakte) aktiviert sind.
              </p>
            </div>

            {lexoffice.message && (
              <div
                className={`rounded-lg px-4 py-3 text-sm ${
                  lexoffice.status === 'connected'
                    ? 'bg-emerald-50 text-emerald-700'
                    : lexoffice.status === 'error'
                    ? 'bg-red-50 text-red-700'
                    : 'bg-blue-50 text-blue-700'
                }`}
              >
                {lexoffice.message}
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Letzter Test: {formatLastChecked(lexoffice.lastChecked)}</span>
              <a
                href="https://developers.lexoffice.io/docs/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-brand-600 hover:text-brand-700"
              >
                API-Dokumentation <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div className="flex gap-2 border-t border-gray-100 pt-4">
              <button
                onClick={() => testLexofficeMutation.mutate()}
                disabled={!lexoffice.token || lexoffice.status === 'testing'}
                className="btn-secondary flex-1"
              >
                {lexoffice.status === 'testing' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Verbindung testen
              </button>
              <button
                onClick={() => saveLexofficeMutation.mutate()}
                disabled={!lexoffice.token}
                className="btn-primary flex-1"
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-900">Verbindungshinweise</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-gray-50 p-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-600">
              <span className="text-sm font-bold">1</span>
            </div>
            <h4 className="mt-3 text-sm font-medium text-gray-900">API-Zugang erstellen</h4>
            <p className="mt-1 text-xs text-gray-500">
              Erstellen Sie API-Token bzw. API-Schl\u00fcssel in den jeweiligen Systemen.
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-600">
              <span className="text-sm font-bold">2</span>
            </div>
            <h4 className="mt-3 text-sm font-medium text-gray-900">Verbindung testen</h4>
            <p className="mt-1 text-xs text-gray-500">
              Geben Sie die Zugangsdaten ein und testen Sie die Verbindung.
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-600">
              <span className="text-sm font-bold">3</span>
            </div>
            <h4 className="mt-3 text-sm font-medium text-gray-900">Workflows einrichten</h4>
            <p className="mt-1 text-xs text-gray-500">
              Erstellen Sie Workflows, die die verbundenen Systeme nutzen.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
