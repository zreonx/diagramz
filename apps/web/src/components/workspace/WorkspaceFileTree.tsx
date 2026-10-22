'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Folder,
  FolderOpen,
  FileText,
  ChevronRight,
  ChevronDown,
  Plus,
  MoreVertical,
  Star,
  Trash2,
  Edit2,
  FolderPlus,
  FilePlus,
  Share2,
  MoveRight,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import {
  WorkspaceTreeResponse,
  WorkspaceFolderNode,
  DiagramSummary,
  FolderSummary,
} from '@diagramz/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface WorkspaceFileTreeProps {
  workspaceId: string;
  activeDiagramId?: string;
  onSelectDiagram?: (diagramId: string) => void;
  className?: string;
}

export function WorkspaceFileTree({
  workspaceId,
  activeDiagramId,
  onSelectDiagram,
  className,
}: WorkspaceFileTreeProps) {
  const router = useRouter();
  const [treeData, setTreeData] = useState<WorkspaceTreeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Dialog States
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [newDocDialogOpen, setNewDocDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [targetParentId, setTargetParentId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<{ id: string; name: string; type: 'folder' | 'doc' } | null>(null);
  const [dialogInputName, setDialogInputName] = useState('');

  const fetchTree = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const res = await apiClient.get<WorkspaceTreeResponse>(`/workspaces/${workspaceId}/tree`);
      setTreeData(res.data);
      // Auto-expand all folders by default on initial load
      setExpandedFolders((prev) => {
        if (prev.size > 0) return prev;
        const allIds = new Set<string>();
        const traverse = (folders: WorkspaceFolderNode[]) => {
          for (const f of folders) {
            allIds.add(f.id);
            if (f.children?.length) traverse(f.children);
          }
        };
        if (res.data.folders) traverse(res.data.folders);
        return allIds;
      });
    } catch (err) {
      console.error('Failed to load workspace tree', err);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  const toggleFolder = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const handleCreateFolder = async () => {
    if (!dialogInputName.trim() || !workspaceId) return;
    try {
      await apiClient.post(`/workspaces/${workspaceId}/folders`, {
        name: dialogInputName.trim(),
        parentId: targetParentId,
      });
      setNewFolderDialogOpen(false);
      setDialogInputName('');
      setTargetParentId(null);
      await fetchTree();
    } catch (err) {
      console.error('Failed to create folder', err);
    }
  };

  const handleCreateDocument = async () => {
    if (!dialogInputName.trim() || !workspaceId) return;
    try {
      // Find or create default project in workspace
      const projectsRes = await apiClient.get(`/workspaces/${workspaceId}/projects`);
      let projectId = projectsRes.data?.[0]?.id;
      if (!projectId) {
        const newProj = await apiClient.post(`/workspaces/${workspaceId}/projects`, {
          name: 'General',
        });
        projectId = newProj.data.id;
      }

      const res = await apiClient.post(`/projects/${projectId}/diagrams`, {
        title: dialogInputName.trim(),
        folderId: targetParentId,
        viewMode: 'canvas',
        documentContent: `# ${dialogInputName.trim()}\n\nWelcome to your new document! Start writing your technical spec or notes here.`,
      });

      setNewDocDialogOpen(false);
      setDialogInputName('');
      setTargetParentId(null);
      await fetchTree();

      if (onSelectDiagram) {
        onSelectDiagram(res.data.id);
      } else {
        router.push(`/diagram/${res.data.id}`);
      }
    } catch (err) {
      console.error('Failed to create document', err);
    }
  };

  const handleRename = async () => {
    if (!editingItem || !dialogInputName.trim()) return;
    try {
      if (editingItem.type === 'folder') {
        await apiClient.patch(`/folders/${editingItem.id}`, { name: dialogInputName.trim() });
      } else {
        await apiClient.patch(`/diagrams/${editingItem.id}`, { title: dialogInputName.trim() });
      }
      setRenameDialogOpen(false);
      setEditingItem(null);
      setDialogInputName('');
      await fetchTree();
    } catch (err) {
      console.error('Failed to rename item', err);
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm('Are you sure you want to delete this folder? Documents inside will be moved to the workspace root.')) return;
    try {
      await apiClient.delete(`/folders/${folderId}`);
      await fetchTree();
    } catch (err) {
      console.error('Failed to delete folder', err);
    }
  };

  const handleDeleteDiagram = async (diagramId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    try {
      await apiClient.delete(`/diagrams/${diagramId}`);
      await fetchTree();
    } catch (err) {
      console.error('Failed to delete diagram', err);
    }
  };

  const handleToggleStar = async (diagramId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiClient.patch(`/diagrams/${diagramId}/star`);
      await fetchTree();
    } catch (err) {
      console.error('Failed to toggle star', err);
    }
  };

  const renderFolderNode = (node: WorkspaceFolderNode, depth = 0) => {
    const isExpanded = expandedFolders.has(node.id);
    const hasChildren = (node.children?.length > 0) || (node.diagrams?.length > 0);

    return (
      <div key={node.id} className="select-none text-xs">
        <div
          className={cn(
            'group flex items-center justify-between py-1 px-2 rounded-md hover:bg-sidebar-accent hover:text-sidebar-accent-foreground cursor-pointer transition-colors text-sidebar-foreground/70 h-8',
          )}
          style={{ paddingLeft: `${depth * 12 + 6}px` }}
          onClick={(e) => toggleFolder(node.id, e)}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              className="p-0.5 hover:bg-muted/60 rounded text-muted-foreground hover:text-foreground"
              onClick={(e) => toggleFolder(node.id, e)}
            >
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
            {isExpanded ? (
              <FolderOpen className="w-3.5 h-3.5 text-foreground shrink-0" />
            ) : (
              <Folder className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            )}
            <span className="truncate font-medium text-xs">{node.name}</span>
          </div>

          <div
            className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              title="New Document in folder"
              className="p-1 hover:bg-muted/70 rounded-md text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => {
                setTargetParentId(node.id);
                setDialogInputName('');
                setNewDocDialogOpen(true);
              }}
            >
              <FilePlus className="w-3 h-3" />
            </button>

            <button
              title="New Subfolder"
              className="p-1 hover:bg-muted/70 rounded-md text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => {
                setTargetParentId(node.id);
                setDialogInputName('');
                setNewFolderDialogOpen(true);
              }}
            >
              <FolderPlus className="w-3 h-3" />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1 hover:bg-muted/70 rounded-md text-muted-foreground hover:text-foreground transition-colors">
                  <MoreVertical className="w-3 h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40 rounded-xl bg-popover/95 backdrop-blur-md border border-border/60 text-popover-foreground shadow-xl p-1">
                <DropdownMenuItem
                  onClick={() => {
                    setEditingItem({ id: node.id, name: node.name, type: 'folder' });
                    setDialogInputName(node.name);
                    setRenameDialogOpen(true);
                  }}
                  className="gap-2 cursor-pointer text-xs rounded-lg"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Rename
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border/40" />
                <DropdownMenuItem
                  onClick={() => handleDeleteFolder(node.id)}
                  className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer text-xs rounded-lg"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Folder
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {isExpanded && hasChildren && (
          <div className="flex flex-col">
            {node.children.map((child) => renderFolderNode(child, depth + 1))}
            {node.diagrams.map((diag) => renderDiagramItem(diag, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const renderDiagramItem = (diag: DiagramSummary, depth = 0) => {
    const isActive = activeDiagramId === diag.id;

    return (
      <div
        key={diag.id}
        className={cn(
          'group flex items-center justify-between py-1 px-2 rounded-md transition-colors cursor-pointer text-xs select-none h-8',
          isActive
            ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
            : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent',
        )}
        style={{ paddingLeft: `${depth * 12 + 18}px` }}
        onClick={() => {
          if (onSelectDiagram) {
            onSelectDiagram(diag.id);
          } else {
            router.push(`/diagram/${diag.id}`);
          }
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <FileText className={cn('w-3.5 h-3.5 shrink-0 transition-colors', isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
          <span className="truncate text-xs">{diag.title}</span>
        </div>

        <div
          className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            title={diag.isStarred ? 'Unstar' : 'Star'}
            className={cn('p-1 rounded-md hover:bg-muted/70 transition-colors', diag.isStarred ? 'text-amber-400 opacity-100' : 'text-muted-foreground')}
            onClick={(e) => handleToggleStar(diag.id, e)}
          >
            <Star className={cn('w-3 h-3', diag.isStarred && 'fill-amber-400')} />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 hover:bg-muted/70 rounded-md text-muted-foreground hover:text-foreground transition-colors">
                <MoreVertical className="w-3 h-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 rounded-xl bg-popover/95 backdrop-blur-md border border-border/60 text-popover-foreground shadow-xl p-1">
              <DropdownMenuItem
                onClick={() => {
                  setEditingItem({ id: diag.id, name: diag.title, type: 'doc' });
                  setDialogInputName(diag.title);
                  setRenameDialogOpen(true);
                }}
                className="gap-2 cursor-pointer text-xs rounded-lg"
              >
                <Edit2 className="w-3.5 h-3.5" /> Rename
              </DropdownMenuItem>
              {diag.shareToken && (
                <DropdownMenuItem
                  onClick={() => {
                    const url = `${window.location.origin}/share/${diag.shareToken}`;
                    navigator.clipboard.writeText(url);
                    toast.success('Share link copied to clipboard');
                  }}
                  className="gap-2 cursor-pointer text-xs rounded-lg"
                >
                  <Share2 className="w-3.5 h-3.5" /> Copy Share Link
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator className="bg-border/40" />
              <DropdownMenuItem
                onClick={() => handleDeleteDiagram(diag.id)}
                className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer text-xs rounded-lg"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Document
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  };

  return (
    <div className={cn('flex flex-col h-full bg-transparent text-sidebar-foreground select-none', className)}>
      {/* Header with Add Actions */}
      <div className="flex items-center justify-between px-2 pt-2.5 pb-1.5 border-t border-sidebar-border/40 mt-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          Documents & Folders
        </span>
        <div className="flex items-center gap-0.5">
          <Button
            size="icon"
            variant="ghost"
            className="size-5.5 rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground cursor-pointer"
            title="New Diagram / Document"
            onClick={() => {
              setTargetParentId(null);
              setDialogInputName('');
              setNewDocDialogOpen(true);
            }}
          >
            <FilePlus className="size-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-5.5 rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground cursor-pointer"
            title="New Folder"
            onClick={() => {
              setTargetParentId(null);
              setDialogInputName('');
              setNewFolderDialogOpen(true);
            }}
          >
            <FolderPlus className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Tree Content */}
      <div className="flex-1 eraser-doc-scroll overflow-y-auto p-2 space-y-0.5">
        {isLoading ? (
          <div className="p-3 text-xs text-muted-foreground/60">Loading workspace files...</div>
        ) : !treeData || (treeData.folders.length === 0 && treeData.rootDiagrams.length === 0) ? (
          <div className="p-4 text-center text-xs text-muted-foreground/60 flex flex-col items-center gap-2">
            <Folder className="w-8 h-8 text-muted-foreground/40" />
            <p>No documents or folders yet.</p>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-border text-foreground hover:bg-sidebar-accent"
              onClick={() => {
                setTargetParentId(null);
                setDialogInputName('Untitled Document');
                setNewDocDialogOpen(true);
              }}
            >
              + Create First Doc
            </Button>
          </div>
        ) : (
          <>
            {treeData.folders.map((f) => renderFolderNode(f, 0))}
            {treeData.rootDiagrams.map((d) => renderDiagramItem(d, 0))}
          </>
        )}
      </div>

      {/* New Folder Dialog */}
      <Dialog open={newFolderDialogOpen} onOpenChange={setNewFolderDialogOpen}>
        <DialogContent className="sm:max-w-md bg-background/95 backdrop-blur-md border border-border/60 text-foreground rounded-2xl shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base text-foreground font-semibold tracking-tight">
              {targetParentId ? 'Create New Subfolder' : 'Create New Folder'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-3">
            <Input
              autoFocus
              placeholder="e.g. Architecture Specs, Microservices..."
              value={dialogInputName}
              onChange={(e) => setDialogInputName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
              className="bg-muted/30 border-border/60 text-foreground h-9 rounded-lg focus:bg-background transition-colors"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setNewFolderDialogOpen(false)}
              className="rounded-lg border-border/60 text-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreateFolder}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg"
            >
              Create Folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Document Dialog */}
      <Dialog open={newDocDialogOpen} onOpenChange={setNewDocDialogOpen}>
        <DialogContent className="sm:max-w-md bg-background/95 backdrop-blur-md border border-border/60 text-foreground rounded-2xl shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base text-foreground font-semibold tracking-tight">Create New Document</DialogTitle>
          </DialogHeader>
          <div className="py-3">
            <Input
              autoFocus
              placeholder="e.g. Payment Gateway Flow, Auth Architecture..."
              value={dialogInputName}
              onChange={(e) => setDialogInputName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateDocument()}
              className="bg-muted/30 border-border/60 text-foreground h-9 rounded-lg focus:bg-background transition-colors"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setNewDocDialogOpen(false)}
              className="rounded-lg border-border/60 text-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreateDocument}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg"
            >
              Create Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-md bg-background/95 backdrop-blur-md border border-border/60 text-foreground rounded-2xl shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base text-foreground font-semibold tracking-tight">
              Rename {editingItem?.type === 'folder' ? 'Folder' : 'Document'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-3">
            <Input
              autoFocus
              value={dialogInputName}
              onChange={(e) => setDialogInputName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              className="bg-muted/30 border-border/60 text-foreground h-9 rounded-lg focus:bg-background transition-colors"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRenameDialogOpen(false)}
              className="rounded-lg border-border/60 text-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleRename}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

