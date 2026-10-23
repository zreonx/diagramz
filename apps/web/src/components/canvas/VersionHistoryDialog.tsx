'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  History,
  Plus,
  RotateCcw,
  Clock,
  Loader2,
  Sparkles,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api';
import { useDiagramStore } from '@/stores/diagram.store';
import { DiagramVersionSummary } from '@diagramz/shared';
import { normalizeToZCanvasDocument } from '@/lib/zcanvaskit';
import { toast } from 'sonner';

interface VersionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diagramId: string;
  onRestoreVersion: (version: DiagramVersionSummary) => void;
}

function formatVersionDate(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function getVersionStats(canvasData: unknown): { nodes: number; edges: number } {
  try {
    const doc = normalizeToZCanvasDocument(canvasData);
    return {
      nodes: doc.nodes?.length || 0,
      edges: doc.edges?.length || 0,
    };
  } catch {
    return { nodes: 0, edges: 0 };
  }
}

export function VersionHistoryDialog({
  open,
  onOpenChange,
  diagramId,
  onRestoreVersion,
}: VersionHistoryDialogProps) {
  const [versions, setVersions] = useState<DiagramVersionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [versionName, setVersionName] = useState('');
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const fetchVersions = useCallback(async () => {
    if (!diagramId) return;
    setIsLoading(true);
    try {
      const res = await apiClient.get<DiagramVersionSummary[]>(`/diagrams/${diagramId}/versions`);
      setVersions(res.data || []);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load version history');
    } finally {
      setIsLoading(false);
    }
  }, [diagramId]);

  useEffect(() => {
    if (open && diagramId) {
      fetchVersions();
    }
  }, [open, diagramId, fetchVersions]);

  const handleCreateVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!diagramId) return;

    setIsCreating(true);
    try {
      const { canvasData, mermaidCode } = useDiagramStore.getState();
      const label =
        versionName.trim() ||
        `Checkpoint • ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

      const res = await apiClient.post<DiagramVersionSummary>(`/diagrams/${diagramId}/versions`, {
        versionName: label,
        canvasData,
        mermaidCode,
      });

      setVersions((prev) => [res.data, ...prev]);
      setVersionName('');
      toast.success(`Saved checkpoint "${res.data.versionName}"`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create checkpoint');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRestore = async (v: DiagramVersionSummary) => {
    setRestoringId(v.id);
    try {
      onRestoreVersion(v);
      toast.success(`Restored diagram to "${v.versionName || 'Selected Version'}"`);
      onOpenChange(false);
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-2xl border border-border/60 bg-background/95 backdrop-blur-md p-6 shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <History className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold tracking-tight">
                Version History & Checkpoints
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Save named architecture snapshots and restore any previous state in one click.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Create New Checkpoint Form */}
        <form onSubmit={handleCreateVersion} className="flex items-center gap-2 pt-2">
          <Input
            value={versionName}
            onChange={(e) => setVersionName(e.target.value)}
            placeholder="Checkpoint name (e.g., v1.0 Initial RFC)..."
            className="h-9 text-xs flex-1 rounded-lg"
            maxLength={100}
          />
          <Button
            type="submit"
            size="sm"
            disabled={isCreating}
            className="h-9 px-3 text-xs font-medium gap-1.5 rounded-lg shrink-0 cursor-pointer"
          >
            {isCreating ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Plus className="size-3.5" />
            )}
            <span>Save Checkpoint</span>
          </Button>
        </form>

        {/* Version List */}
        <div className="mt-3 max-h-[340px] overflow-y-auto space-y-2 pr-1">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="size-5 animate-spin text-primary" />
              <span className="text-xs">Loading version history...</span>
            </div>
          ) : versions.length === 0 ? (
            <div className="py-10 px-4 text-center rounded-xl border border-dashed border-border/60 bg-muted/20">
              <Clock className="size-7 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-xs font-medium text-foreground">No checkpoints saved yet</p>
              <p className="text-[11px] text-muted-foreground mt-1 max-w-xs mx-auto">
                Create a checkpoint above before making major architecture changes so you can always roll back.
              </p>
            </div>
          ) : (
            versions.map((v, idx) => {
              const stats = getVersionStats(v.canvasData);
              return (
                <div
                  key={v.id}
                  className="group flex items-center justify-between gap-3 p-3 rounded-xl border border-border/60 bg-card/60 hover:bg-card hover:border-primary/40 transition-all"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground truncate">
                        {v.versionName || `Version ${versions.length - idx}`}
                      </span>
                      {idx === 0 && (
                        <Badge
                          variant="outline"
                          className="text-[9px] h-4 px-1.5 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 shrink-0"
                        >
                          Latest
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2.5 mt-1 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {formatVersionDate(v.createdAt)}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 font-mono text-[10px]">
                        <Layers className="size-3 text-primary/70" />
                        {stats.nodes} nodes, {stats.edges} edges
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={restoringId === v.id}
                    onClick={() => handleRestore(v)}
                    className="h-7 px-2.5 text-xs gap-1.5 rounded-lg border-border/60 hover:border-primary/50 hover:bg-primary/10 hover:text-primary shrink-0 cursor-pointer"
                  >
                    {restoringId === v.id ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <RotateCcw className="size-3" />
                    )}
                    <span>Restore</span>
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
