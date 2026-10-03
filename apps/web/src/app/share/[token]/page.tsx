'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import mermaid from 'mermaid';
import { apiClient } from '@/lib/api';
import { DiagramDetail } from '@diagramz/shared';
import { Layers, Globe, Loader2, AlertCircle } from 'lucide-react';
import { Excalidraw } from '@/components/canvas/ExcalidrawWrapper';

export default function PublicSharePage() {
  const params = useParams();
  const token = params.token as string;

  const [diagram, setDiagram] = useState<DiagramDetail | null>(null);
  const [svgOutput, setSvgOutput] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'canvas' | 'mermaid'>('mermaid');

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      securityLevel: 'loose',
    });

    apiClient
      .get<DiagramDetail>(`/share/${token}`)
      .then(async (res) => {
        setDiagram(res.data);
        if (res.data.mermaidCode) {
          try {
            const { svg } = await mermaid.render('share-mermaid-preview', res.data.mermaidCode);
            setSvgOutput(svg);
          } catch {
            // Error rendering mermaid
          }
        }
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Shared diagram not found or expired.');
        setIsLoading(false);
      });
  }, [token]);

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-xs">Loading shared diagram...</p>
      </div>
    );
  }

  if (error || !diagram) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 p-6 text-center">
        <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
        <h2 className="text-base font-semibold text-slate-100 mb-1">Diagram Unavailable</h2>
        <p className="text-xs text-slate-400 max-w-sm">{error || 'This diagram is not public.'}</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      {/* Read-only Header */}
      <header className="h-12 border-b border-slate-800 bg-slate-900/90 px-6 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center text-white">
            <Layers className="w-4 h-4" />
          </div>
          <span className="text-sm font-semibold text-white">{diagram.title}</span>
          <span className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
            <Globe className="w-3 h-3" /> Public Preview
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('mermaid')}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              viewMode === 'mermaid'
                ? 'bg-blue-600 text-white font-medium'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Mermaid Diagram
          </button>
          <button
            onClick={() => setViewMode('canvas')}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              viewMode === 'canvas'
                ? 'bg-blue-600 text-white font-medium'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Canvas View
          </button>
        </div>
      </header>

      {/* Main View Surface */}
      <div className="flex-1 overflow-auto bg-[#121212] p-8 flex items-center justify-center">
        {viewMode === 'mermaid' ? (
          svgOutput ? (
            <div
              className="max-w-4xl max-h-full overflow-auto p-8 bg-slate-900/60 rounded-2xl border border-slate-800 shadow-2xl flex items-center justify-center [&>svg]:max-w-full [&>svg]:h-auto"
              dangerouslySetInnerHTML={{ __html: svgOutput }}
            />
          ) : (
            <div className="text-xs text-slate-500">No Mermaid diagram code available.</div>
          )
        ) : (
          <div className="w-full h-full">
            <Excalidraw
              viewModeEnabled={true}
              initialData={{
                elements: (diagram.canvasData as any)?.elements || [],
                appState: { theme: 'dark', viewBackgroundColor: '#121212' },
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
