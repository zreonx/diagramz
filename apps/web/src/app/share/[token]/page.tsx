'use client';

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import mermaid from 'mermaid';
import { apiClient } from '@/lib/api';
import { DiagramDetail } from '@diagramz/shared';
import {
  Globe,
  Loader2,
  AlertCircle,
  Columns2,
  FileText,
  Compass,
  Code,
  Sun,
  Moon,
  Eye,
  Edit3,
  Check,
  Download,
  Copy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DocumentEditor } from '@/components/editor/DocumentEditor';
import { DiagramLoaderScreen } from '@/components/canvas/DiagramLoaderScreen';
import { useTheme } from '@/hooks/use-theme';
import {
  ZCanvas,
  normalizeToZCanvasDocument,
  exportZCanvasToStorage,
  ZCanvasDocument,
  exportDocumentToPng,
  exportDocumentToSvg,
  downloadSvg,
} from '@/lib/zcanvaskit';
import { toast } from 'sonner';

type ShareViewMode = 'both' | 'doc' | 'canvas' | 'mermaid';
type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

export default function PublicSharePage() {
  const params = useParams();
  const token = params?.token as string | undefined;

  const { theme, toggleTheme, isDark } = useTheme();

  const [diagram, setDiagram] = useState<DiagramDetail | null>(null);
  const [svgOutput, setSvgOutput] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ShareViewMode>('both');
  const [docRatio, setDocRatio] = useState<number>(38);
  const [isDragging, setIsDragging] = useState(false);

  // Editor mechanism states
  const [canEdit, setCanEdit] = useState<boolean>(false);
  const [documentContent, setDocumentContent] = useState<string>('');
  const [currentCanvasDoc, setCurrentCanvasDoc] = useState<ZCanvasDocument | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!token) return;

    mermaid.initialize({
      startOnLoad: false,
      theme: isDark ? 'dark' : 'default',
      securityLevel: 'loose',
    });

    apiClient
      .get<DiagramDetail>(`/share/${token}`)
      .then(async (res) => {
        setDiagram(res.data);
        const editable = !!(res.data.canEdit || res.data.shareRole === 'editor');
        setCanEdit(editable);
        setDocumentContent(res.data.documentContent || '');

        const initialDoc = normalizeToZCanvasDocument(res.data.canvasData);
        setCurrentCanvasDoc(initialDoc);

        if (res.data.viewMode && ['both', 'doc', 'canvas'].includes(res.data.viewMode)) {
          setViewMode(res.data.viewMode as ShareViewMode);
        } else if (!res.data.documentContent && res.data.canvasData) {
          setViewMode('canvas');
        }

        if (res.data.mermaidCode) {
          try {
            const { svg } = await mermaid.render('share-mermaid-preview', res.data.mermaidCode);
            setSvgOutput(svg);
          } catch {
            // Mermaid parse error ignored
          }
        }
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Diagram not found or sharing has been disabled.');
        setIsLoading(false);
      });
  }, [token, isDark]);

  // Debounced auto-save function for editor mode
  const triggerAutoSave = useCallback(
    (nextDoc: string, nextCanvas: ZCanvasDocument | null) => {
      if (!token || !canEdit) return;
      setSaveStatus('unsaved');

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        setSaveStatus('saving');
        try {
          const payload: any = {
            documentContent: nextDoc,
          };
          if (nextCanvas) {
            payload.canvasData = exportZCanvasToStorage(nextCanvas);
          }
          await apiClient.patch(`/share/${token}`, payload);
          setSaveStatus('saved');
        } catch (e) {
          console.error('Failed to save shared diagram changes:', e);
          setSaveStatus('error');
        }
      }, 1500);
    },
    [token, canEdit]
  );

  const handleDocumentChange = useCallback(
    (newContent: string) => {
      setDocumentContent(newContent);
      triggerAutoSave(newContent, currentCanvasDoc);
    },
    [currentCanvasDoc, triggerAutoSave]
  );

  const handleCanvasChange = useCallback(
    (newDoc: ZCanvasDocument) => {
      setCurrentCanvasDoc(newDoc);
      triggerAutoSave(documentContent, newDoc);
    },
    [documentContent, triggerAutoSave]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const ratio = (e.clientX / window.innerWidth) * 100;
      if (ratio >= 20 && ratio <= 80) {
        setDocRatio(ratio);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleExportPng = async () => {
    if (!currentCanvasDoc || !diagram) return;
    try {
      await exportDocumentToPng(currentCanvasDoc, {
        filename: `${diagram.title.toLowerCase().replace(/\s+/g, '-')}-shared.png`,
        scale: 2,
        isDark,
        transparentBackground: false,
        fitToContent: true,
        padding: 48,
      });
      toast.success('Diagram exported as PNG');
    } catch {
      toast.error('Failed to export diagram');
    }
  };

  const handleExportSvg = async () => {
    if (!currentCanvasDoc || !diagram) return;
    try {
      const svgString = await exportDocumentToSvg(currentCanvasDoc, {
        isDark,
        transparentBackground: false,
        fitToContent: true,
        padding: 48,
      });
      downloadSvg(svgString, `${diagram.title.toLowerCase().replace(/\s+/g, '-')}-shared.svg`);
      toast.success('Diagram exported as vector SVG');
    } catch {
      toast.error('Failed to export SVG');
    }
  };

  if (isLoading) {
    return (
      <DiagramLoaderScreen
        title={diagram?.title || 'Shared Diagram'}
        subtitle="Opening shared diagram workspace..."
      />
    );
  }

  if (error || !diagram || !currentCanvasDoc) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 text-center">
        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-1">Diagram Unavailable</h2>
        <p className="text-sm text-muted-foreground max-w-sm mb-6">
          {error || 'This diagram link has expired or access has been restricted by the owner.'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background">
      {/* Header */}
      <header className="h-12 border-b border-border bg-card/80 backdrop-blur-md px-4 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
              D
            </div>
            <span className="font-semibold text-sm tracking-tight">{diagram.title}</span>
          </div>

          {/* Access Badge: View Only vs Can Edit */}
          {canEdit ? (
            <Badge
              variant="outline"
              className="text-[10px] font-medium h-5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 gap-1"
            >
              <Edit3 className="w-2.5 h-2.5" />
              Can Edit
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-[10px] font-medium h-5 bg-muted/60 text-muted-foreground border-border gap-1"
            >
              <Eye className="w-2.5 h-2.5 text-amber-500" />
              View Only
            </Badge>
          )}

          {/* Save Status (in editor mode) */}
          {canEdit && (
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium pl-1">
              {saveStatus === 'saving' && (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-primary" />
                  <span>Saving...</span>
                </>
              )}
              {saveStatus === 'saved' && (
                <>
                  <Check className="w-3 h-3 text-emerald-500" />
                  <span>Saved</span>
                </>
              )}
              {saveStatus === 'unsaved' && <span className="text-amber-500">Unsaved changes</span>}
              {saveStatus === 'error' && <span className="text-destructive">Failed to save</span>}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Export Menu */}
          <div className="hidden sm:flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportPng}
              className="h-7 px-2 text-xs rounded-lg border-border/70 gap-1"
              title="Download PNG"
            >
              <Download className="w-3 h-3" />
              <span>PNG</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportSvg}
              className="h-7 px-2 text-xs rounded-lg border-border/70 gap-1"
              title="Download vector SVG"
            >
              <Download className="w-3 h-3" />
              <span>SVG</span>
            </Button>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border border-border/80">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setViewMode('both')}
              className={`h-7 px-2.5 text-xs rounded-md transition-all gap-1.5 ${
                viewMode === 'both'
                  ? 'bg-background text-foreground shadow-sm font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span>Both</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setViewMode('doc')}
              className={`h-7 px-2.5 text-xs rounded-md transition-all gap-1.5 ${
                viewMode === 'doc'
                  ? 'bg-background text-foreground shadow-sm font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Doc</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setViewMode('canvas')}
              className={`h-7 px-2.5 text-xs rounded-md transition-all gap-1.5 ${
                viewMode === 'canvas'
                  ? 'bg-background text-foreground shadow-sm font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Canvas</span>
            </Button>
            {diagram.mermaidCode && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setViewMode('mermaid')}
                className={`h-7 px-2.5 text-xs rounded-md transition-all gap-1.5 ${
                  viewMode === 'mermaid'
                    ? 'bg-background text-foreground shadow-sm font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                <span>Mermaid</span>
              </Button>
            )}
          </div>

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </div>
      </header>

      {/* Main Workspace Surface */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Document Pane */}
        {(viewMode === 'both' || viewMode === 'doc') && (
          <div
            style={{ width: viewMode === 'both' ? `${docRatio}%` : '100%' }}
            className="h-full overflow-hidden flex flex-col bg-background"
          >
            <DocumentEditor
              initialContent={documentContent}
              readOnly={!canEdit}
              onChange={canEdit ? handleDocumentChange : undefined}
              className="h-full border-r border-border"
            />
          </div>
        )}

        {/* Resizable Splitter */}
        {viewMode === 'both' && (
          <div
            onMouseDown={handleMouseDown}
            className={`w-1.5 hover:w-2 transition-all bg-muted border-x border-border hover:bg-accent cursor-col-resize z-30 select-none flex items-center justify-center ${
              isDragging ? 'bg-primary/20 w-2' : ''
            }`}
          >
            <div className="h-8 w-0.5 bg-muted-foreground/30 rounded-full" />
          </div>
        )}

        {/* Canvas Pane */}
        {(viewMode === 'both' || viewMode === 'canvas') && (
          <div
            style={{ width: viewMode === 'both' ? `${100 - docRatio}%` : '100%' }}
            className="h-full flex-1 overflow-hidden relative bg-[#090d16]"
          >
            <ZCanvas
              initialDocument={currentCanvasDoc}
              readOnly={!canEdit}
              onChange={canEdit ? handleCanvasChange : undefined}
            />
          </div>
        )}

        {/* Mermaid Code Mode */}
        {viewMode === 'mermaid' && (
          <div className="h-full w-full overflow-auto flex items-center justify-center p-8 bg-card/20">
            {svgOutput ? (
              <div
                className="max-w-full max-h-full flex items-center justify-center [&>svg]:max-w-full [&>svg]:h-auto"
                dangerouslySetInnerHTML={{ __html: svgOutput }}
              />
            ) : (
              <pre className="font-mono text-xs p-6 bg-muted/40 rounded-xl border border-border text-foreground overflow-auto max-w-2xl max-h-[80vh]">
                {diagram.mermaidCode}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
