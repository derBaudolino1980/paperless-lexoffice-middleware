import { useEffect, useRef, useState, useId, useCallback } from 'react';
import mermaid from 'mermaid';
import { AlertTriangle, Maximize2, Minimize2 } from 'lucide-react';

interface MermaidViewerProps {
  definition: string;
  className?: string;
  title?: string;
}

mermaid.initialize({
  startOnLoad: false,
  theme: 'neutral',
  securityLevel: 'strict',
  fontFamily: 'Inter, system-ui, sans-serif',
  flowchart: {
    useMaxWidth: true,
    htmlLabels: true,
    curve: 'basis',
    padding: 20,
  },
  themeVariables: {
    primaryColor: '#0d9488',
    primaryTextColor: '#ffffff',
    primaryBorderColor: '#0f766e',
    lineColor: '#94a3b8',
    secondaryColor: '#f0fdfa',
    tertiaryColor: '#f8fafc',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: '14px',
  },
});

function setSvgContent(container: HTMLDivElement, svgContent: string) {
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, 'image/svg+xml');
  const svgElement = doc.documentElement;
  if (svgElement && svgElement.nodeName === 'svg') {
    container.appendChild(container.ownerDocument.importNode(svgElement, true));
  }
}

export default function MermaidViewer({ definition, className = '', title }: MermaidViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const uniqueId = useId();
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [rendering, setRendering] = useState(false);

  const clearContainer = useCallback(() => {
    if (containerRef.current) {
      while (containerRef.current.firstChild) {
        containerRef.current.removeChild(containerRef.current.firstChild);
      }
    }
  }, []);

  useEffect(() => {
    if (!definition.trim() || !containerRef.current) return;

    let cancelled = false;

    async function renderDiagram() {
      setRendering(true);
      setError(null);

      try {
        const sanitizedId = `mermaid-${uniqueId.replace(/:/g, '-')}`;
        const { svg } = await mermaid.render(sanitizedId, definition.trim());
        if (!cancelled && containerRef.current) {
          setSvgContent(containerRef.current, svg);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Unbekannter Fehler beim Rendern des Diagramms';
          setError(message);
          clearContainer();
        }
      } finally {
        if (!cancelled) {
          setRendering(false);
        }
      }
    }

    renderDiagram();

    return () => {
      cancelled = true;
    };
  }, [definition, uniqueId, clearContainer]);

  if (!definition.trim()) {
    return (
      <div className={`flex items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50/50 p-8 ${className}`}>
        <p className="text-sm text-gray-400">Kein Diagramm definiert</p>
      </div>
    );
  }

  return (
    <div className={`relative ${expanded ? 'fixed inset-4 z-50' : ''} ${className}`}>
      {expanded && (
        <div className="fixed inset-0 -z-10 bg-black/50 backdrop-blur-sm" onClick={() => setExpanded(false)} />
      )}

      <div className={`flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white ${expanded ? 'h-full' : ''}`}>
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/80 px-4 py-2.5">
          {title ? (
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
              {title}
            </span>
          ) : (
            <span />
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600"
            title={expanded ? 'Verkleinern' : 'Vergrößern'}
          >
            {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-500" />
            <p className="text-xs text-amber-700">Diagramm-Fehler: {error}</p>
          </div>
        )}

        <div
          className={`mermaid-container flex items-center justify-center overflow-auto p-6 scrollbar-thin ${
            expanded ? 'flex-1' : 'min-h-[200px]'
          } ${rendering ? 'animate-pulse' : ''}`}
        >
          <div ref={containerRef} className="w-full text-center" />
        </div>
      </div>
    </div>
  );
}
