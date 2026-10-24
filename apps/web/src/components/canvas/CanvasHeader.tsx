'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  Code2,
  Sparkles,
  Boxes,
  Share2,
  Download,
  Check,
  Copy,
  Cloud,
  Loader2,
  Star,
  Columns2,
  FileText,
  Palette,
  Sun,
  Moon,
  Wand2,
  History,
  CopyPlus,
  Upload,
  Presentation,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDiagramStore } from '@/stores/diagram.store';
import { ShareDiagramDialog } from './ShareDiagramDialog';
import { VersionHistoryDialog } from './VersionHistoryDialog';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/use-theme';
import {
  exportDocumentToSvg,
  exportDocumentToPng,
  exportDocumentToPdf,
  exportDocumentToClipboard,
  downloadSvg,
  normalizeToZCanvasDocument,
} from '@/lib/zcanvaskit';
import { toast } from 'sonner';

interface CanvasHeaderProps {
  title: string;
  workspaceName?: string;
  folderName?: string;
  onBeautifyLayout?: () => void;
  onRestoreSnapshot?: (snapshot: {
    canvasData?: unknown;
    mermaidCode?: string;
    documentContent?: string;
    title?: string;
  }) => void;
}

export function CanvasHeader({
  title,
  workspaceName = 'Workspace',
  folderName,
  onBeautifyLayout,
  onRestoreSnapshot,
}: CanvasHeaderProps) {
  const router = useRouter();
  const saveStatus = useDiagramStore((s) => s.saveStatus);
  const saveDiagram = useDiagramStore((s) => s.saveDiagram);
  const currentDiagram = useDiagramStore((s) => s.currentDiagram);
  const collaborators = useDiagramStore((s) => s.collaborators);
  const panelMode = useDiagramStore((s) => s.panelMode);
  const setPanelMode = useDiagramStore((s) => s.setPanelMode);
  const viewMode = useDiagramStore((s) => s.viewMode);
  const setViewMode = useDiagramStore((s) => s.setViewMode);

  const { theme, toggleTheme, isDark } = useTheme();

  const togglePanel = (mode: 'none' | 'mermaid' | 'ai' | 'library') => {
    setPanelMode(panelMode === mode ? 'none' : mode);
  };

  const [isStarred, setIsStarred] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [exportFormat, setExportFormat] = useState<'png' | 'pdf' | 'svg' | 'json'>('png');
  const [exportScale, setExportScale] = useState<number>(2);
  const [exportTransparent, setExportTransparent] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [isPublicShare, setIsPublicShare] = useState(false);
  const [shareLinkCopied, setShareLinkCopied] = useState(false);
  const jsonFileInputRef = React.useRef<HTMLInputElement>(null);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitleValue, setEditingTitleValue] = useState(title);
  const titleInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditingTitleValue(title);
  }, [title]);

  useEffect(() => {
    if (isEditingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isEditingTitle]);

  const handleCommitTitle = async () => {
    setIsEditingTitle(false);
    const trimmed = editingTitleValue.trim();
    if (!trimmed || trimmed === title || !currentDiagram) {
      setEditingTitleValue(title);
      return;
    }

    try {
      useDiagramStore.setState({
        currentDiagram: { ...currentDiagram, title: trimmed },
      });
      await apiClient.patch(`/diagrams/${currentDiagram.id}`, { title: trimmed });
      toast.success('Diagram renamed');
    } catch (e: any) {
      toast.error('Failed to rename diagram');
      setEditingTitleValue(title);
    }
  };

  useEffect(() => {
    if (currentDiagram) {
      setIsPublicShare(currentDiagram.isPublic);
      setIsStarred(!!currentDiagram.isStarred);
    }
  }, [currentDiagram]);

  const handleToggleStar = async () => {
    if (!currentDiagram) return;
    try {
      const nextStar = !isStarred;
      setIsStarred(nextStar);
      await apiClient.patch(`/diagrams/${currentDiagram.id}/star`);
    } catch (e) {
      setIsStarred(!isStarred);
    }
  };

  const handleDuplicateDiagram = async () => {
    if (!currentDiagram || isDuplicating) return;
    setIsDuplicating(true);
    try {
      const { canvasData, mermaidCode, documentContent, viewMode: currentViewMode } =
        useDiagramStore.getState();
      const res = await apiClient.post(`/projects/${currentDiagram.projectId}/diagrams`, {
        title: `${currentDiagram.title} (Copy)`,
        folderId: currentDiagram.folderId || null,
        viewMode: currentViewMode || 'canvas',
        documentContent: documentContent || '',
        mermaidCode: mermaidCode || '',
        canvasData: canvasData || { nodes: [], edges: [] },
      });
      toast.success('Diagram duplicated! Opening copy...');
      router.push(`/diagram/${res.data.id}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to duplicate diagram');
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleImportJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const canvasData = parsed.canvasData || (parsed.nodes ? parsed : null);
      if (!canvasData) {
        toast.error('Invalid Diagramz JSON file format');
        return;
      }
      onRestoreSnapshot?.({
        canvasData,
        mermaidCode: typeof parsed.mermaidCode === 'string' ? parsed.mermaidCode : undefined,
        documentContent:
          typeof parsed.documentContent === 'string' ? parsed.documentContent : undefined,
        title: typeof parsed.title === 'string' ? parsed.title : undefined,
      });
      setShowExportModal(false);
      toast.success(`Imported "${file.name}" onto canvas!`);
    } catch {
      toast.error('Could not parse JSON file');
    } finally {
      if (jsonFileInputRef.current) {
        jsonFileInputRef.current.value = '';
      }
    }
  };

  const handleExport = async () => {
    if (!currentDiagram) return;
    setIsExporting(true);
    try {
      const { canvasData, mermaidCode, documentContent, viewMode: currentViewMode } =
        useDiagramStore.getState();
      const doc = normalizeToZCanvasDocument(canvasData);
      const safeTitle = (currentDiagram.title || 'diagram')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-');

      if (exportFormat === 'json') {
        const jsonPayload = {
          version: '2.0',
          title: currentDiagram.title,
          viewMode: currentViewMode,
          mermaidCode,
          documentContent,
          canvasData: doc,
          exportedAt: new Date().toISOString(),
        };
        const blob = new Blob([JSON.stringify(jsonPayload, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${safeTitle}.diagramz.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Exported editable .diagramz.json backup');
        setShowExportModal(false);
        return;
      }

      const filename = `${safeTitle}.${exportFormat}`;

      if (exportFormat === 'svg') {
        const svgString = exportDocumentToSvg(doc, {
          isDark,
          transparentBackground: exportTransparent,
          fitToContent: true,
          padding: 48,
        });
        downloadSvg(svgString, filename);
        toast.success('Diagram exported as vector SVG');
      } else if (exportFormat === 'pdf') {
        await exportDocumentToPdf(doc, {
          filename,
          scale: exportScale,
          isDark,
          fitToContent: true,
          padding: 48,
        });
        toast.success('Diagram exported as PDF document');
      } else {
        await exportDocumentToPng(doc, {
          filename,
          scale: exportScale,
          isDark,
          transparentBackground: exportTransparent,
          fitToContent: true,
          padding: 48,
        });
        toast.success(`Diagram exported as HD PNG (${exportScale}x)`);
      }

      setShowExportModal(false);
    } catch (e: any) {
      console.error('Export failed:', e);
      toast.error(`Export failed: ${e?.message || 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyToClipboard = async () => {
    if (!currentDiagram) return;
    setIsCopying(true);
    try {
      const { canvasData } = useDiagramStore.getState();
      const doc = normalizeToZCanvasDocument(canvasData);
      await exportDocumentToClipboard(doc, {
        scale: Math.max(2, exportScale),
        isDark,
        transparentBackground: exportTransparent,
        fitToContent: true,
        padding: 48,
      });
      toast.success('Diagram copied to clipboard as HD image');
    } catch (e: any) {
      console.error('Clipboard copy failed:', e);
      toast.error('Failed to copy to clipboard');
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <header className="h-13 border-b border-border/50 bg-background/80 backdrop-blur-md px-4 flex items-center justify-between select-none z-20 shrink-0">
      {/* Left: Breadcrumbs & Back */}
      <div className="flex items-center gap-2">
        <Link
          href="/dashboard"
          className="text-muted-foreground hover:text-foreground size-8 rounded-lg flex items-center justify-center hover:bg-muted/70 transition-colors"
          title="Back to Dashboard"
        >
          <ChevronLeft className="w-4 h-4" />
        </Link>

        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground font-medium">{workspaceName}</span>
          {folderName && (
            <>
              <span className="text-muted-foreground/40">/</span>
              <span className="text-foreground font-medium">{folderName}</span>
            </>
          )}
          <span className="text-muted-foreground/40">/</span>
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={editingTitleValue}
              onChange={(e) => setEditingTitleValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCommitTitle();
                if (e.key === 'Escape') {
                  setEditingTitleValue(title);
                  setIsEditingTitle(false);
                }
              }}
              onBlur={handleCommitTitle}
              className="text-foreground font-semibold tracking-tight text-xs bg-muted/60 border border-primary/40 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-primary h-6 max-w-[200px]"
            />
          ) : (
            <span
              onClick={() => setIsEditingTitle(true)}
              className="text-foreground font-semibold tracking-tight hover:bg-muted/50 px-1.5 py-0.5 rounded cursor-pointer transition-colors max-w-[240px] truncate block"
              title="Click to rename diagram"
            >
              {editingTitleValue || title}
            </span>
          )}
        </div>

        <button
          onClick={handleToggleStar}
          className={cn(
            'p-1 ml-1 rounded-md hover:bg-muted/70 transition-colors cursor-pointer',
            isStarred ? 'text-amber-500' : 'text-muted-foreground/40 hover:text-muted-foreground',
          )}
          title={isStarred ? 'Starred' : 'Add to Starred'}
        >
          <Star className={cn('w-3.5 h-3.5', isStarred && 'fill-amber-500')} />
        </button>

        {/* Save Status */}
        <div className="ml-2">
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1 text-[11px] text-amber-500 font-medium px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
              <Loader2 className="w-3 h-3 animate-spin" /> Saving...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium px-2 py-0.5 rounded-full bg-muted/40 border border-border/40">
              <Cloud className="w-3 h-3 text-emerald-500" /> Saved
            </span>
          )}
          {saveStatus === 'unsaved' && (
            <button
              onClick={() => saveDiagram()}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground font-medium px-2 py-0.5 rounded-full bg-muted/40 border border-border/40 hover:bg-muted transition-colors cursor-pointer"
            >
              <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
              Unsaved • Save
            </button>
          )}
        </div>
      </div>

      {/* Center: Eraser-Style View Mode Switcher (Doc | Both | Canvas) */}
      <div className="flex items-center p-0.5 rounded-lg bg-muted/50 border border-border/50">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setViewMode('doc')}
          className={cn(
            'h-7 px-3 text-xs gap-1.5 rounded-md font-medium transition-all cursor-pointer',
            viewMode === 'doc'
              ? 'bg-background text-foreground shadow-2xs font-semibold'
              : 'text-muted-foreground hover:text-foreground',
          )}
          title="Document Only Mode (Full Document View)"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Doc</span>
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={() => setViewMode('both')}
          className={cn(
            'h-7 px-3 text-xs gap-1.5 rounded-md font-medium transition-all cursor-pointer',
            viewMode === 'both'
              ? 'bg-background text-foreground shadow-2xs font-semibold'
              : 'text-muted-foreground hover:text-foreground',
          )}
          title="Both (Document on Left, Canvas on Right)"
        >
          <Columns2 className="w-3.5 h-3.5" />
          <span>Both</span>
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={() => setViewMode('canvas')}
          className={cn(
            'h-7 px-3 text-xs gap-1.5 rounded-md font-medium transition-all cursor-pointer',
            viewMode === 'canvas'
              ? 'bg-background text-foreground shadow-2xs font-semibold'
              : 'text-muted-foreground hover:text-foreground',
          )}
          title="Canvas Only Mode (Full Visual Canvas)"
        >
          <Palette className="w-3.5 h-3.5" />
          <span>Canvas</span>
        </Button>
      </div>

      {/* Right: Actions, Panels, Exports */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        {/* Collaborators Avatar Stack */}
        {collaborators.length > 0 && (
          <div className="hidden md:flex items-center -space-x-2 mr-1">
            {collaborators.slice(0, 4).map((c) => (
              <div
                key={c.userId}
                title={c.name}
                className="w-6.5 h-6.5 rounded-full border-2 border-background flex items-center justify-center text-[10px] font-bold text-white shadow-xs"
                style={{ backgroundColor: c.color }}
              >
                {c.name.charAt(0).toUpperCase()}
              </div>
            ))}
          </div>
        )}

        {/* Presentation Mode Toggle */}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('zcanvas:toggle-presentation'));
            }
          }}
          className="h-8 text-xs gap-1.5 rounded-lg px-2 sm:px-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
          title="Full-Screen Presentation Mode (F5)"
        >
          <Presentation className="w-3.5 h-3.5 text-rose-500" />
          <span className="hidden xl:inline">Present</span>
        </Button>

        {/* Auto Layout / Beautify Architecture */}
        {onBeautifyLayout && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onBeautifyLayout}
            className="h-8 text-xs gap-1.5 rounded-lg px-2 sm:px-3 text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all cursor-pointer"
            title="Auto-align and beautify diagram architecture layout"
          >
            <Wand2 className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden xl:inline">Auto Layout</span>
          </Button>
        )}

        {/* Component Libraries Toggle */}
        <Button
          size="sm"
          variant={panelMode === 'library' ? 'secondary' : 'ghost'}
          onClick={() => togglePanel('library')}
          className="h-8 text-xs gap-1.5 rounded-lg px-2 sm:px-3"
          title="Browse & insert software architecture & cloud components"
        >
          <Boxes className="w-3.5 h-3.5 text-blue-500" />
          <span className="hidden xl:inline">Components</span>
        </Button>

        {/* Mermaid Code Mode Toggle */}
        <Button
          size="sm"
          variant={panelMode === 'mermaid' ? 'secondary' : 'ghost'}
          onClick={() => togglePanel('mermaid')}
          className="h-8 text-xs gap-1.5 rounded-lg px-2 sm:px-3"
          title="Mermaid Live Code Editor"
        >
          <Code2 className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">Code</span>
        </Button>

        {/* AI Assistant Mode Toggle */}
        <Button
          size="sm"
          variant={panelMode === 'ai' ? 'secondary' : 'outline'}
          onClick={() => togglePanel('ai')}
          className={cn(
            'h-8 text-xs gap-1.5 rounded-lg px-2 sm:px-3 transition-all',
            panelMode === 'ai'
              ? 'bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/30'
              : 'border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-300 hover:bg-purple-500/15',
          )}
          title="AI Architect Assistant"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-500" />
          <span className="hidden lg:inline">AI Architect</span>
        </Button>

        {/* Version History Button */}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowHistoryModal(true)}
          className="h-8 text-xs gap-1.5 rounded-lg px-2 sm:px-2.5 text-muted-foreground hover:text-foreground hover:bg-muted/70 cursor-pointer"
          title="Version History & Named Checkpoints"
        >
          <History className="w-3.5 h-3.5 text-emerald-500" />
          <span className="hidden 2xl:inline">History</span>
        </Button>

        {/* Duplicate Diagram Button */}
        <Button
          size="sm"
          variant="ghost"
          onClick={handleDuplicateDiagram}
          disabled={isDuplicating}
          className="h-8 text-xs gap-1.5 rounded-lg px-2 sm:px-2.5 text-muted-foreground hover:text-foreground hover:bg-muted/70 cursor-pointer"
          title="Duplicate this diagram"
        >
          {isDuplicating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <CopyPlus className="w-3.5 h-3.5" />
          )}
          <span className="hidden 2xl:inline">Duplicate</span>
        </Button>

        {/* Share Button */}
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowShareModal(true)}
          className="h-8 text-xs gap-1.5 rounded-lg border-border/60 px-2 sm:px-3"
          title="Share diagram"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Share</span>
        </Button>

        {/* Export Button */}
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowExportModal(true)}
          className="h-8 text-xs gap-1.5 rounded-lg border-border/60 px-2 sm:px-3"
          title="Export or Import diagram"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Export</span>
        </Button>

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70 shrink-0"
          onClick={toggleTheme}
          title="Toggle canvas theme"
        >
          {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </Button>
      </div>

      {/* Share Dialog */}
      {currentDiagram && (
        <ShareDiagramDialog
          open={showShareModal}
          onOpenChange={setShowShareModal}
          diagramId={currentDiagram.id}
          diagramTitle={currentDiagram.title}
          initialIsPublic={currentDiagram.isPublic}
          initialShareToken={currentDiagram.shareToken}
          initialShareRole={currentDiagram.shareRole || 'viewer'}
          onShareSettingsChanged={(settings) => {
            setIsPublicShare(settings.isPublic);
          }}
        />
      )}

      {/* Version History Dialog */}
      {currentDiagram && (
        <VersionHistoryDialog
          open={showHistoryModal}
          onOpenChange={setShowHistoryModal}
          diagramId={currentDiagram.id}
          onRestoreVersion={(version) => {
            onRestoreSnapshot?.({
              canvasData: version.canvasData,
              mermaidCode: version.mermaidCode ?? undefined,
            });
          }}
        />
      )}

      {/* Hidden File Input for JSON Import */}
      <input
        ref={jsonFileInputRef}
        type="file"
        accept=".json,.diagramz.json"
        onChange={handleImportJsonFile}
        className="hidden"
      />

      {/* Export & Import Dialog */}
      <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
        <DialogContent className="sm:max-w-md rounded-2xl border border-border/60 bg-background/95 backdrop-blur-md p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold tracking-tight">
              Export & Backup Diagram
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Generate crisp visual assets (PNG, SVG, PDF) or export/import editable .diagramz.json backups.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Format Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Format</Label>
              <div className="grid grid-cols-4 gap-2">
                {(['png', 'svg', 'pdf', 'json'] as const).map((fmt) => (
                  <Button
                    key={fmt}
                    type="button"
                    size="sm"
                    variant={exportFormat === fmt ? 'default' : 'outline'}
                    onClick={() => setExportFormat(fmt)}
                    className="uppercase text-xs font-semibold h-8 rounded-lg border-border/60"
                  >
                    {fmt}
                  </Button>
                ))}
              </div>
            </div>

            {exportFormat === 'json' ? (
              <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5 space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Exports the full editable <strong className="text-foreground">.diagramz.json</strong> bundle (nodes, connectors, Mermaid code, and markdown spec) for Git repositories or offline backups.
                </p>
                <div className="pt-1 border-t border-border/40 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground font-medium">
                    Have an existing backup?
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => jsonFileInputRef.current?.click()}
                    className="h-7 text-xs gap-1.5 rounded-lg border-border/60"
                  >
                    <Upload className="w-3 h-3 text-primary" />
                    <span>Import .json File</span>
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* Resolution Scale (for PNG and PDF) */}
                {exportFormat !== 'svg' && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">Resolution Quality</Label>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {exportScale === 1
                          ? '72 DPI'
                          : exportScale === 2
                            ? '144 DPI (Retina HD)'
                            : '300 DPI (Ultra 4K)'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[1, 2, 3].map((s) => (
                        <Button
                          key={s}
                          type="button"
                          size="sm"
                          variant={exportScale === s ? 'default' : 'outline'}
                          onClick={() => setExportScale(s)}
                          className="text-xs font-medium h-8 rounded-lg border-border/60"
                        >
                          {s}x {s === 2 ? '(HD)' : s === 3 ? '(4K)' : '(Std)'}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Background Style */}
                {exportFormat !== 'pdf' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Background</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={!exportTransparent ? 'default' : 'outline'}
                        onClick={() => setExportTransparent(false)}
                        className="text-xs font-medium h-8 rounded-lg border-border/60"
                      >
                        Canvas {isDark ? 'Dark (#020617)' : 'Light (#FFFFFF)'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={exportTransparent ? 'default' : 'outline'}
                        onClick={() => setExportTransparent(true)}
                        className="text-xs font-medium h-8 rounded-lg border-border/60"
                      >
                        Transparent
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 mt-4 pt-2 border-t border-border/40">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowExportModal(false)}
              className="rounded-lg border-border/60 text-xs"
            >
              Cancel
            </Button>

            <div className="flex items-center gap-2">
              {exportFormat === 'png' && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleCopyToClipboard}
                  disabled={isExporting || isCopying}
                  className="rounded-lg text-xs font-medium border border-border/60"
                  title="Copy high-resolution image directly to clipboard"
                >
                  {isCopying ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  {isCopying ? 'Copying...' : 'Copy Image'}
                </Button>
              )}

              <Button
                size="sm"
                onClick={handleExport}
                disabled={isExporting || isCopying}
                className="rounded-lg text-xs font-medium"
              >
                {isExporting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                ) : (
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                )}
                {isExporting ? 'Exporting...' : 'Download Export'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
