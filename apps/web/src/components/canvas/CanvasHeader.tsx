'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  Code2,
  Sparkles,
  Share2,
  Download,
  Check,
  Copy,
  Cloud,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDiagramStore, PanelMode } from '@/stores/diagram.store';
import { apiClient } from '@/lib/api';
import { ExportFormat } from '@diagramz/shared';

interface CanvasHeaderProps {
  title: string;
  workspaceName?: string;
  projectName?: string;
}

export function CanvasHeader({ title, workspaceName = 'Workspace', projectName = 'Project' }: CanvasHeaderProps) {
  const {
    currentDiagram,
    panelMode,
    setPanelMode,
    saveStatus,
    collaborators,
    saveDiagram,
    mermaidCode,
    canvasData,
  } = useDiagramStore();

  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('png');
  const [exportScale, setExportScale] = useState(2);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isPublicShare, setIsPublicShare] = useState(currentDiagram?.isPublic || false);
  const [shareLinkCopied, setShareLinkCopied] = useState(false);

  const togglePanel = (mode: PanelMode) => {
    setPanelMode(panelMode === mode ? 'none' : mode);
  };

  const handleExport = async () => {
    if (!currentDiagram) return;
    setIsExporting(true);
    try {
      const res = await apiClient.post('/export/queue', {
        diagramId: currentDiagram.id,
        format: exportFormat,
        scale: exportScale,
        mermaidCode,
        canvasData,
      });

      const { jobId } = res.data;
      // Download directly via API
      window.open(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}/export/download/${jobId}`, '_blank');
      setShowExportModal(false);
    } catch (e) {
      console.error('Export failed:', e);
    } finally {
      setIsExporting(false);
    }
  };

  const handleToggleShare = async () => {
    if (!currentDiagram) return;
    const nextPublicState = !isPublicShare;
    try {
      const res = await apiClient.post(`/diagrams/${currentDiagram.id}/share`, {
        isPublic: nextPublicState,
      });
      setIsPublicShare(res.data.isPublic);
    } catch (e) {
      console.error('Share toggle failed:', e);
    }
  };

  const shareUrl = typeof window !== 'undefined' && currentDiagram?.shareToken
    ? `${window.location.origin}/share/${currentDiagram.shareToken}`
    : '';

  const copyShareLink = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setShareLinkCopied(true);
      setTimeout(() => setShareLinkCopied(false), 2000);
    }
  };

  return (
    <header className="h-12 border-b border-slate-800 bg-slate-950/90 px-4 flex items-center justify-between select-none z-20">
      {/* Left: Breadcrumbs & Back */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium">{workspaceName}</span>
          <span className="text-slate-600">/</span>
          <span className="text-slate-400 font-medium">{projectName}</span>
          <span className="text-slate-600">/</span>
          <span className="text-slate-100 font-semibold">{title}</span>
        </div>

        {/* Save Status */}
        <div className="ml-2">
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1 text-[11px] text-amber-400">
              <Loader2 className="w-3 h-3 animate-spin" /> Saving...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1 text-[11px] text-slate-400">
              <Cloud className="w-3 h-3 text-slate-500" /> Saved
            </span>
          )}
          {saveStatus === 'unsaved' && (
            <button
              onClick={() => saveDiagram()}
              className="text-[11px] text-blue-400 hover:underline"
            >
              Unsaved changes • Click to save
            </button>
          )}
        </div>
      </div>

      {/* Right: Actions, Panels, Exports */}
      <div className="flex items-center gap-2">
        {/* Collaborators Avatar Stack */}
        {collaborators.length > 0 && (
          <div className="flex items-center -space-x-2 mr-2">
            {collaborators.slice(0, 4).map((c) => (
              <div
                key={c.userId}
                title={c.name}
                className="w-7 h-7 rounded-full border-2 border-slate-950 flex items-center justify-center text-[11px] font-bold text-white shadow"
                style={{ backgroundColor: c.color }}
              >
                {c.name.charAt(0).toUpperCase()}
              </div>
            ))}
            {collaborators.length > 4 && (
              <div className="w-7 h-7 rounded-full border-2 border-slate-950 bg-slate-800 text-[10px] font-bold text-slate-300 flex items-center justify-center">
                +{collaborators.length - 4}
              </div>
            )}
          </div>
        )}

        {/* Mermaid Code Mode Toggle */}
        <Button
          size="sm"
          variant={panelMode === 'mermaid' ? 'default' : 'outline'}
          onClick={() => togglePanel('mermaid')}
          className="h-8 text-xs gap-1.5"
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>Code</span>
        </Button>

        {/* AI Assistant Mode Toggle */}
        <Button
          size="sm"
          variant={panelMode === 'ai' ? 'default' : 'outline'}
          onClick={() => togglePanel('ai')}
          className="h-8 text-xs gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-0"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>AI Architect</span>
        </Button>

        {/* Share Button */}
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowShareModal(true)}
          className="h-8 text-xs gap-1.5"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>Share</span>
        </Button>

        {/* Export Button */}
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowExportModal(true)}
          className="h-8 text-xs gap-1.5"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export</span>
        </Button>
      </div>

      {/* Share Modal Dialog */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-semibold text-slate-100 mb-1">Share Diagram</h3>
            <p className="text-xs text-slate-400 mb-4">
              Anyone with this link can view this diagram in high resolution.
            </p>

            <div className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-800 mb-4">
              <div>
                <div className="text-xs font-medium text-slate-200">Public Link Sharing</div>
                <div className="text-[11px] text-slate-400">
                  {isPublicShare ? 'Enabled' : 'Disabled'}
                </div>
              </div>
              <Button
                size="sm"
                variant={isPublicShare ? 'destructive' : 'default'}
                onClick={handleToggleShare}
                className="h-7 text-xs"
              >
                {isPublicShare ? 'Disable' : 'Enable Link'}
              </Button>
            </div>

            {isPublicShare && (
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-300 select-all"
                />
                <Button size="sm" onClick={copyShareLink} className="h-8 px-3 text-xs">
                  {shareLinkCopied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                  {shareLinkCopied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            )}

            <div className="flex justify-end">
              <Button size="sm" variant="secondary" onClick={() => setShowShareModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal Dialog */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-sm w-full shadow-2xl">
            <h3 className="text-base font-semibold text-slate-100 mb-1">Export Diagram</h3>
            <p className="text-xs text-slate-400 mb-4">
              Generate pixel-perfect assets rendered via our asynchronous pipeline.
            </p>

            <div className="space-y-3 mb-5">
              <div>
                <label className="text-xs text-slate-300 block mb-1">Format</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['png', 'pdf', 'svg'] as ExportFormat[]).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => setExportFormat(fmt)}
                      className={`py-1.5 text-xs font-semibold rounded uppercase border transition-all ${
                        exportFormat === fmt
                          ? 'bg-blue-600 text-white border-blue-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Resolution Scale</label>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map((s) => (
                    <button
                      key={s}
                      onClick={() => setExportScale(s)}
                      className={`py-1.5 text-xs font-semibold rounded border transition-all ${
                        exportScale === s
                          ? 'bg-blue-600 text-white border-blue-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {s}x {s === 2 ? '(HD)' : s === 3 ? '(Ultra)' : '(Standard)'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setShowExportModal(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleExport} disabled={isExporting}>
                {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
                {isExporting ? 'Rendering...' : 'Download Export'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
