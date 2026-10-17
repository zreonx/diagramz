'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Sparkles,
  FolderPlus,
  MoreHorizontal,
  Send,
  Search,
  FileText,
  ArrowDown,
  ArrowUp,
  Trash2,
  Edit2,
  Share2,
  Copy,
  Check,
  Columns2,
  Loader2,
  ExternalLink,
  Sun,
  Moon,
  CheckSquare,
  Square,
  MinusSquare,
  AlertTriangle,
  X,
  Star,
  LayoutGrid,
  List,
  Layers,
  Clock,
  Users,
  Compass,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useTheme } from '@/hooks/use-theme';
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
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DiagramSummary, ProjectSummary, WorkspaceSummary, WorkspaceMemberSummary } from '@diagramz/shared';
import { ShareDiagramDialog } from '@/components/canvas/ShareDiagramDialog';
import { formatRelativeTime, cn } from '@/lib/utils';
import { toast } from 'sonner';
import { CreateDiagramDialog, StarterTemplateKey } from '@/components/canvas/CreateDiagramDialog';
import { getEraserTemplate } from '@/lib/eraser-templates';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';

type ViewMode = 'list' | 'grid';
type FilterTab = 'all' | 'starred' | 'shared';
type SortOption = 'updated' | 'created' | 'title';

export default function DashboardPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Core Data States
  const [diagrams, setDiagrams] = useState<DiagramSummary[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceSummary | null>(null);
  const [members, setMembers] = useState<WorkspaceMemberSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeFolderName, setActiveFolderName] = useState('Untitled Folder');
  const [isLoading, setIsLoading] = useState(true);

  // Interactive Controls
  const [filterQuery, setFilterQuery] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [sortBy, setSortBy] = useState<SortOption>('updated');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [isCreatingDiagram, setIsCreatingDiagram] = useState(false);

  // Creation & Dialog States
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [initialTemplateKey, setInitialTemplateKey] = useState<StarterTemplateKey>('blank');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer' | 'admin'>('editor');
  const [isInviting, setIsInviting] = useState(false);
  const [createdInviteUrl, setCreatedInviteUrl] = useState<string | null>(null);
  const [copiedInviteLink, setCopiedInviteLink] = useState(false);

  // Folder rename modal
  const [showRenameFolderModal, setShowRenameFolderModal] = useState(false);
  const [newFolderNameInput, setNewFolderNameInput] = useState('');

  // Diagram rename modal
  const [showRenameDiagramModal, setShowRenameDiagramModal] = useState(false);
  const [renamingDiagram, setRenamingDiagram] = useState<{ id: string; title: string } | null>(null);
  const [newDiagramTitleInput, setNewDiagramTitleInput] = useState('');

  // Multi-selection & Batch Deletion States
  const [selectedDiagramIds, setSelectedDiagramIds] = useState<Set<string>>(new Set());
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);
  const [isDeletingBatch, setIsDeletingBatch] = useState(false);

  // Sharing Dialog State
  const [sharingDiagram, setSharingDiagram] = useState<DiagramSummary | null>(null);

  // Initialize view mode from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedMode = localStorage.getItem('diagramz_dashboard_view_mode') as ViewMode | null;
      if (savedMode === 'list' || savedMode === 'grid') {
        setViewMode(savedMode);
      }
    }
  }, []);

  const handleChangeViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('diagramz_dashboard_view_mode', mode);
    }
  };

  // Keyboard shortcut for Search & Create
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl?.tagName === 'INPUT' ||
        activeEl?.tagName === 'TEXTAREA' ||
        activeEl?.getAttribute('contenteditable') === 'true';

      if (e.key === '/' && !isInput) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }

      if ((e.key === 'c' || e.key === 'C') && !isInput && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleCreateDiagram();
      }

      if (e.key === 'Escape') {
        if (filterQuery) setFilterQuery('');
        if (selectedDiagramIds.size > 0) setSelectedDiagramIds(new Set());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filterQuery, selectedDiagramIds]);

  // Fetch initial workspace, projects, diagrams, and members
  useEffect(() => {
    apiClient
      .get<WorkspaceSummary[]>('/workspaces')
      .then(async (wsRes) => {
        if (wsRes.data.length === 0) {
          setIsLoading(false);
          return;
        }
        const ws = wsRes.data[0];
        setActiveWorkspace(ws);

        // Fetch team members
        apiClient
          .get<WorkspaceMemberSummary[]>(`/workspaces/${ws.id}/members`)
          .then((mRes) => setMembers(mRes.data))
          .catch(() => {});

        // Fetch projects
        const projRes = await apiClient.get<ProjectSummary[]>(`/workspaces/${ws.id}/projects`);
        let activeProj = projRes.data[0];
        if (!activeProj) {
          const newProj = await apiClient.post<ProjectSummary>(`/workspaces/${ws.id}/projects`, {
            name: 'Untitled Folder',
          });
          activeProj = newProj.data;
          setProjects([activeProj]);
        } else {
          setProjects(projRes.data);
        }
        setSelectedProjectId(activeProj.id);
        setActiveFolderName(activeProj.name || 'Untitled Folder');

        // Fetch diagrams
        const diagRes = await apiClient.get<DiagramSummary[]>(`/projects/${activeProj.id}/diagrams`);
        setDiagrams(diagRes.data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setIsLoading(false);
      });
  }, []);

  // Direct 1-Click "Create Diagram" handler
  const handleCreateDiagram = async () => {
    if (isCreatingDiagram) return;
    setIsCreatingDiagram(true);

    try {
      let targetProjectId = selectedProjectId;
      if (!targetProjectId) {
        if (projects.length > 0) {
          targetProjectId = projects[0].id;
        } else if (activeWorkspace) {
          const newProj = await apiClient.post<ProjectSummary>(`/workspaces/${activeWorkspace.id}/projects`, {
            name: 'Untitled Folder',
          });
          targetProjectId = newProj.data.id;
          setProjects([newProj.data]);
        }
      }

      if (!targetProjectId) {
        throw new Error('Unable to resolve active workspace project');
      }

      const initialCanvasData = getEraserTemplate('blank');
      const count = diagrams.length + 1;
      const title = `Untitled Diagram ${count > 1 ? count : ''}`.trim();

      const res = await apiClient.post<DiagramSummary>(`/projects/${targetProjectId}/diagrams`, {
        title,
        viewMode: 'both',
        documentContent: `# ${title}\n\nStart drafting your technical design, API specifications, and architectural notes here.`,
        mermaidCode: `flowchart LR\n    Client[Client App] --> Gateway[API Gateway]\n    Gateway --> Service[Core Service]\n    Service --> DB[(Database)]`,
        canvasData: initialCanvasData,
      });

      toast.success('Diagram created!');
      router.push(`/diagram/${res.data.id}`);
    } catch (err: any) {
      console.error('Failed to create diagram', err);
      toast.error(err.response?.data?.message || 'Failed to create diagram');
      setIsCreatingDiagram(false);
    }
  };

  // Open Template Modal if user chooses "Browse Templates..."
  const openCreateWithTemplate = (templateKey: StarterTemplateKey = 'blank') => {
    setInitialTemplateKey(templateKey);
    setCreateModalOpen(true);
  };

  // Star / Favorite toggle (Optimistic)
  const handleToggleStar = async (diagramId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const target = diagrams.find((d) => d.id === diagramId);
    if (!target) return;

    const nextStarred = !target.isStarred;
    setDiagrams((prev) =>
      prev.map((d) => (d.id === diagramId ? { ...d, isStarred: nextStarred } : d))
    );

    try {
      await apiClient.patch(`/diagrams/${diagramId}/star`);
      toast.success(nextStarred ? 'Added to Starred' : 'Removed from Starred');
    } catch (err) {
      // rollback
      setDiagrams((prev) =>
        prev.map((d) => (d.id === diagramId ? { ...d, isStarred: !nextStarred } : d))
      );
      toast.error('Failed to update favorite status');
    }
  };

  const handleInviteCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace || !inviteEmail.trim()) return;
    setIsInviting(true);
    try {
      const res = await apiClient.post(`/workspaces/${activeWorkspace.id}/invitations`, {
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      const url = typeof window !== 'undefined' ? `${window.location.origin}/invite/${res.data.token}` : '';
      setCreatedInviteUrl(url);
      toast.success(`Invite created for ${inviteEmail.trim()}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to send invite');
    } finally {
      setIsInviting(false);
    }
  };

  const handleCopyInviteLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedInviteLink(true);
    toast.success('Invite link copied to clipboard!');
    setTimeout(() => setCopiedInviteLink(false), 2000);
  };

  const handleRenameFolder = async () => {
    if (!newFolderNameInput.trim()) return;
    setActiveFolderName(newFolderNameInput.trim());
    setShowRenameFolderModal(false);
    toast.success('Folder renamed');
  };

  const handleRenameDiagram = async () => {
    if (!renamingDiagram || !newDiagramTitleInput.trim()) return;
    try {
      await apiClient.patch(`/diagrams/${renamingDiagram.id}`, {
        title: newDiagramTitleInput.trim(),
      });
      setDiagrams((prev) =>
        prev.map((d) =>
          d.id === renamingDiagram.id ? { ...d, title: newDiagramTitleInput.trim() } : d
        )
      );
      setShowRenameDiagramModal(false);
      setRenamingDiagram(null);
      toast.success('Diagram renamed');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to rename diagram');
    }
  };

  const handleDeleteDiagram = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!confirm('Are you sure you want to delete this diagram?')) return;
    try {
      await apiClient.delete(`/diagrams/${id}`);
      setDiagrams((prev) => prev.filter((d) => d.id !== id));
      setSelectedDiagramIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.success('Diagram deleted');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete diagram');
    }
  };

  // Filtered & Sorted Diagrams
  const filteredDiagrams = useMemo(() => {
    return diagrams
      .filter((d) => {
        // Tab filter
        if (filterTab === 'starred' && !d.isStarred) return false;
        if (filterTab === 'shared' && !d.isPublic) return false;

        // Query search
        if (!filterQuery.trim()) return true;
        const q = filterQuery.toLowerCase();
        return (
          d.title.toLowerCase().includes(q) ||
          (d.mermaidCode && d.mermaidCode.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        if (sortBy === 'title') {
          return a.title.localeCompare(b.title);
        }
        if (sortBy === 'created') {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        // default: updated
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [diagrams, filterTab, filterQuery, sortBy]);

  // Multi-selection Handlers
  const toggleSelectDiagram = (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setSelectedDiagramIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const allFilteredSelected =
    filteredDiagrams.length > 0 &&
    filteredDiagrams.every((d) => selectedDiagramIds.has(d.id));

  const someFilteredSelected =
    !allFilteredSelected &&
    filteredDiagrams.some((d) => selectedDiagramIds.has(d.id));

  const toggleSelectAll = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (allFilteredSelected) {
      setSelectedDiagramIds(new Set());
    } else {
      setSelectedDiagramIds(new Set(filteredDiagrams.map((d) => d.id)));
    }
  };

  const handleConfirmBatchDelete = async () => {
    const idsToDelete = Array.from(selectedDiagramIds);
    if (idsToDelete.length === 0) return;

    setIsDeletingBatch(true);
    try {
      await apiClient.post('/diagrams/batch-delete', { diagramIds: idsToDelete });
      setDiagrams((prev) => prev.filter((d) => !selectedDiagramIds.has(d.id)));
      toast.success(`Deleted ${idsToDelete.length} ${idsToDelete.length === 1 ? 'diagram' : 'diagrams'}`);
      setSelectedDiagramIds(new Set());
      setShowBatchDeleteModal(false);
    } catch (err: any) {
      try {
        await Promise.all(idsToDelete.map((id) => apiClient.delete(`/diagrams/${id}`)));
        setDiagrams((prev) => prev.filter((d) => !selectedDiagramIds.has(d.id)));
        toast.success(`Deleted ${idsToDelete.length} ${idsToDelete.length === 1 ? 'diagram' : 'diagrams'}`);
        setSelectedDiagramIds(new Set());
        setShowBatchDeleteModal(false);
      } catch (fallbackErr: any) {
        toast.error('Failed to delete selected diagrams');
      }
    } finally {
      setIsDeletingBatch(false);
    }
  };

  const starredCount = useMemo(() => diagrams.filter((d) => d.isStarred).length, [diagrams]);
  const sharedCount = useMemo(() => diagrams.filter((d) => d.isPublic).length, [diagrams]);

  return (
    <div className="min-h-full flex flex-col bg-background text-foreground select-none">
      {/* ─── Top Header Bar ─── */}
      <header className="h-14 border-b border-border/40 px-6 sm:px-8 flex items-center justify-between bg-background/90 backdrop-blur-md sticky top-0 z-20 shrink-0">
        {/* Left: Sidebar Trigger & Folder Title */}
        <div className="flex items-center gap-2.5 min-w-0">
          <SidebarTrigger className="-ml-2 text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors rounded-lg size-8 cursor-pointer" />
          
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-base sm:text-lg font-semibold tracking-tight text-foreground truncate">
              {activeFolderName}
            </h1>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
                  title="Folder options"
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 rounded-xl p-1 shadow-xl">
                <DropdownMenuItem
                  onClick={() => {
                    setNewFolderNameInput(activeFolderName);
                    setShowRenameFolderModal(true);
                  }}
                  className="gap-2 text-xs cursor-pointer"
                >
                  <Edit2 className="size-3.5" />
                  <span>Rename Folder</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleCreateDiagram}
                  className="gap-2 text-xs cursor-pointer"
                >
                  <Plus className="size-3.5" />
                  <span>New Diagram</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              onClick={() => {
                setNewFolderNameInput('');
                setShowRenameFolderModal(true);
              }}
              className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
              title="Create New Folder"
            >
              <FolderPlus className="size-4" />
            </button>
          </div>
        </div>

        {/* Right: Search, Member Avatars, Actions & Theme */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Real-time Search Bar */}
          <div className="relative">
            <Search className="size-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Search diagrams..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="h-8.5 w-40 sm:w-60 pl-8.5 pr-8 text-xs rounded-xl border-border/60 bg-muted/20 focus:bg-background transition-all"
            />
            {filterQuery ? (
              <button
                type="button"
                onClick={() => setFilterQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 cursor-pointer"
                title="Clear search"
              >
                <X className="size-3" />
              </button>
            ) : (
              <div className="hidden sm:flex absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none items-center">
                <kbd className="px-1 py-0.2 rounded bg-muted/70 text-[9px] font-mono text-muted-foreground/70 border border-border/50">
                  /
                </kbd>
              </div>
            )}
          </div>

          {/* Collaborator Avatars */}
          <div className="hidden md:flex items-center -space-x-1.5">
            {members.slice(0, 3).map((m, idx) => (
              <div
                key={m.id || idx}
                title={m.user?.name || m.user?.email || 'Team Member'}
                className="size-7 rounded-full border-2 border-background bg-zinc-300 dark:bg-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-800 dark:text-zinc-200 overflow-hidden shadow-2xs"
              >
                {m.user?.avatarUrl ? (
                  <img src={m.user.avatarUrl} alt="" className="size-full object-cover" />
                ) : (
                  (m.user?.name || m.user?.email || 'U').charAt(0).toUpperCase()
                )}
              </div>
            ))}
            {members.length === 0 && (
              <div className="size-7 rounded-full border-2 border-background bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">
                {activeWorkspace?.name?.charAt(0).toUpperCase() || 'W'}
              </div>
            )}
          </div>

          {/* Quick Header "New Diagram" Button */}
          <Button
            size="sm"
            disabled={isCreatingDiagram}
            onClick={handleCreateDiagram}
            className="hidden sm:inline-flex h-8.5 px-3 gap-1.5 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs cursor-pointer"
          >
            {isCreatingDiagram ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Plus className="size-3.5 stroke-[2.2]" />
            )}
            <span>New Diagram</span>
          </Button>

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70 cursor-pointer"
            title="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>

          {/* Notifications */}
          <NotificationCenter />

          {/* Invite Collaborator Button */}
          <Button
            size="sm"
            onClick={() => setShowInviteModal(true)}
            className="h-8.5 px-3 gap-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-2xs cursor-pointer"
          >
            <Send className="size-3.5 rotate-45" />
            <span className="hidden sm:inline">Invite</span>
          </Button>
        </div>
      </header>

      {/* ─── Main Content Container ─── */}
      <main className="flex-1 p-6 sm:p-8 max-w-7xl mx-auto w-full space-y-7">
        {/* ─── Hero Action Section: "Create Diagram" (Single Focused Action) ─── */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Primary Action Card: Create Diagram */}
          <div
            onClick={handleCreateDiagram}
            className={cn(
              'group relative flex flex-col justify-between p-5 rounded-2xl border transition-all duration-200 cursor-pointer text-left',
              'border-primary/30 bg-gradient-to-br from-card to-card/60 hover:border-primary/60 hover:shadow-md md:col-span-2',
              isCreatingDiagram && 'opacity-80 pointer-events-none'
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="size-12 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground flex items-center justify-center transition-all duration-200 shadow-2xs">
                  {isCreatingDiagram ? (
                    <Loader2 className="size-6 animate-spin" />
                  ) : (
                    <Plus className="size-6 stroke-[2.2]" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                      Create Diagram
                    </h2>
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-primary/30 text-primary">
                      Instant Blank Canvas
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 max-w-md">
                    Start a fresh dual-pane canvas and technical document with real-time sync, smart routing, and architecture stencils.
                  </p>
                </div>
              </div>

              {/* Template dropdown shortcut for power users */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground rounded-lg gap-1.5 border-border/70 cursor-pointer"
                  >
                    <Compass className="size-3.5" />
                    <span className="hidden sm:inline">Templates</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-xl p-1 shadow-xl">
                  <DropdownMenuItem
                    onClick={() => openCreateWithTemplate('blank')}
                    className="gap-2 text-xs cursor-pointer font-medium"
                  >
                    <Plus className="size-3.5 text-primary" />
                    <span>Blank Canvas</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => openCreateWithTemplate('global-payment-system')}
                    className="gap-2 text-xs cursor-pointer"
                  >
                    <Layers className="size-3.5 text-blue-500" />
                    <span>Payment Architecture</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => openCreateWithTemplate('cloud-architecture')}
                    className="gap-2 text-xs cursor-pointer"
                  >
                    <Compass className="size-3.5 text-indigo-500" />
                    <span>Cloud Microservices</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => openCreateWithTemplate('database-erd')}
                    className="gap-2 text-xs cursor-pointer"
                  >
                    <FileText className="size-3.5 text-emerald-500" />
                    <span>Database ERD Schema</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setCreateModalOpen(true)}
                    className="gap-2 text-xs cursor-pointer text-muted-foreground"
                  >
                    <Sparkles className="size-3.5" />
                    <span>Browse All Templates...</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono border border-border/60">
                  C
                </kbd>
                <span>Press key to create</span>
              </span>
              <span className="text-primary font-medium flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                <span>Start Diagram</span>
                <ArrowRight className="size-3" />
              </span>
            </div>
          </div>

          {/* Quick Metrics & Overview Card */}
          <div className="flex flex-col justify-between p-5 rounded-2xl border border-border/60 bg-card/40">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                Workspace Overview
              </span>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-muted/30 border border-border/40">
                  <div className="text-xl font-bold text-foreground">
                    {diagrams.length}
                  </div>
                  <span className="text-[11px] text-muted-foreground font-medium">Total Files</span>
                </div>
                <div
                  onClick={() => setFilterTab(filterTab === 'starred' ? 'all' : 'starred')}
                  className="p-3 rounded-xl bg-muted/30 border border-border/40 hover:border-amber-400/50 cursor-pointer transition-colors"
                >
                  <div className="text-xl font-bold text-amber-500 flex items-center gap-1">
                    <Star className="size-4 fill-amber-500" />
                    <span>{starredCount}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground font-medium">Starred Files</span>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
              <span className="truncate">{activeWorkspace?.name || 'Workspace'}</span>
              <span className="font-medium text-foreground">{members.length || 1} members</span>
            </div>
          </div>
        </section>

        {/* ─── Filter Tabs, Sorting & View Toggle Bar ─── */}
        <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          {/* Left: Filter Tabs */}
          <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-xl border border-border/40 w-fit">
            <button
              type="button"
              onClick={() => setFilterTab('all')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer',
                filterTab === 'all'
                  ? 'bg-background text-foreground shadow-2xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              All Files ({diagrams.length})
            </button>

            <button
              type="button"
              onClick={() => setFilterTab('starred')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer',
                filterTab === 'starred'
                  ? 'bg-background text-foreground shadow-2xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Star className={cn('size-3.5', starredCount > 0 && 'fill-amber-400 text-amber-400')} />
              <span>Starred ({starredCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterTab('shared')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer',
                filterTab === 'shared'
                  ? 'bg-background text-foreground shadow-2xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Share2 className="size-3.5" />
              <span>Public ({sharedCount})</span>
            </button>
          </div>

          {/* Right: Sort & View Mode Switcher */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* Sort Dropdown */}
            <Select value={sortBy} onValueChange={(val: SortOption) => setSortBy(val)}>
              <SelectTrigger className="h-8.5 w-38 text-xs rounded-xl border-border/60 bg-card/60">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="updated">Recently Edited</SelectItem>
                <SelectItem value="created">Date Created</SelectItem>
                <SelectItem value="title">Alphabetical (A-Z)</SelectItem>
              </SelectContent>
            </Select>

            {/* View Mode Segmented Switcher */}
            <div className="flex items-center bg-muted/40 p-0.5 rounded-xl border border-border/40">
              <button
                type="button"
                onClick={() => handleChangeViewMode('grid')}
                className={cn(
                  'p-1.5 rounded-lg transition-colors cursor-pointer',
                  viewMode === 'grid'
                    ? 'bg-background text-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                title="Grid view"
              >
                <LayoutGrid className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => handleChangeViewMode('list')}
                className={cn(
                  'p-1.5 rounded-lg transition-colors cursor-pointer',
                  viewMode === 'list'
                    ? 'bg-background text-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                title="List view"
              >
                <List className="size-4" />
              </button>
            </div>
          </div>
        </section>

        {/* ─── Diagrams Content Area ─── */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 py-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-44 rounded-2xl bg-muted/30 border border-border/30 animate-pulse" />
            ))}
          </div>
        ) : filteredDiagrams.length === 0 ? (
          <div className="py-20 text-center text-xs text-muted-foreground border border-dashed border-border/60 rounded-2xl bg-card/20 flex flex-col items-center justify-center p-6">
            <div className="size-12 rounded-2xl bg-muted/50 flex items-center justify-center mb-3 text-muted-foreground/60">
              {filterTab === 'starred' ? (
                <Star className="size-6 text-amber-500/60" />
              ) : filterQuery ? (
                <Search className="size-6 text-muted-foreground/60" />
              ) : (
                <FileText className="size-6 text-muted-foreground/60" />
              )}
            </div>

            <p className="font-semibold text-sm text-foreground">
              {filterTab === 'starred'
                ? 'No starred diagrams yet'
                : filterTab === 'shared'
                ? 'No public diagrams shared'
                : filterQuery
                ? `No diagrams found for "${filterQuery}"`
                : 'No files in this folder yet'}
            </p>

            <p className="text-muted-foreground mt-1 max-w-sm">
              {filterTab === 'starred'
                ? 'Click the star icon on any diagram to bookmark your essential designs for quick access.'
                : filterQuery
                ? 'Try searching with different keywords or clear the filter.'
                : 'Click "Create Diagram" above to launch a new dual-canvas document with real-time specs.'}
            </p>

            {filterQuery ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setFilterQuery('')}
                className="mt-4 rounded-xl text-xs cursor-pointer"
              >
                Clear Search
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleCreateDiagram}
                className="mt-4 rounded-xl text-xs font-semibold gap-1.5 cursor-pointer"
              >
                <Plus className="size-3.5" />
                <span>Create Diagram</span>
              </Button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          /* ─── Grid View ─── */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredDiagrams.map((diagram) => {
              const isSelected = selectedDiagramIds.has(diagram.id);
              return (
                <div
                  key={diagram.id}
                  onClick={() => router.push(`/diagram/${diagram.id}`)}
                  className={cn(
                    'group relative flex flex-col rounded-2xl border transition-all duration-150 cursor-pointer overflow-hidden bg-card/60 hover:bg-card hover:border-primary/50 hover:shadow-xs',
                    isSelected
                      ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                      : 'border-border/60'
                  )}
                >
                  {/* Card Thumbnail / Header */}
                  <div className="h-28 bg-gradient-to-b from-muted/40 to-muted/15 border-b border-border/40 p-3 flex items-start justify-between relative overflow-hidden">
                    {/* Subtle grid background accent */}
                    <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(#888_1px,transparent_1px)] [background-size:12px_12px]" />

                    {/* Multi-select Checkbox */}
                    <button
                      type="button"
                      onClick={(e) => toggleSelectDiagram(diagram.id, e)}
                      className={cn(
                        'size-6 rounded-md flex items-center justify-center transition-all cursor-pointer z-10',
                        isSelected
                          ? 'text-primary bg-background shadow-2xs opacity-100'
                          : 'text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-background/80'
                      )}
                      title={isSelected ? 'Deselect' : 'Select'}
                    >
                      {isSelected ? (
                        <CheckSquare className="size-4 text-primary" />
                      ) : (
                        <Square className="size-4" />
                      )}
                    </button>

                    {/* Star Button */}
                    <button
                      type="button"
                      onClick={(e) => handleToggleStar(diagram.id, e)}
                      className={cn(
                        'size-6 rounded-md flex items-center justify-center transition-all cursor-pointer z-10',
                        diagram.isStarred
                          ? 'text-amber-400 opacity-100'
                          : 'text-muted-foreground/60 opacity-0 group-hover:opacity-100 hover:text-amber-400 hover:bg-background/80'
                      )}
                      title={diagram.isStarred ? 'Unstar' : 'Star'}
                    >
                      <Star className={cn('size-4', diagram.isStarred && 'fill-amber-400')} />
                    </button>
                  </div>

                  {/* Card Body */}
                  <div className="p-3.5 flex flex-col flex-1 justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <div className="size-5 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <Columns2 className="size-3" />
                        </div>
                        <h3 className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors truncate flex-1">
                          {diagram.title}
                        </h3>
                        {diagram.isPublic && (
                          <Badge variant="outline" className="text-[9px] py-0 px-1 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 shrink-0">
                            Public
                          </Badge>
                        )}
                      </div>

                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">
                        Edited {formatRelativeTime(diagram.updatedAt)}
                      </p>
                    </div>

                    {/* Card Footer: Author & 3-dots Menu */}
                    <div className="pt-2 border-t border-border/30 flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <div className="size-5 rounded-full bg-zinc-800 text-white flex items-center justify-center text-[9px] font-bold">
                          {activeWorkspace?.name?.charAt(0) || 'U'}
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {formatRelativeTime(diagram.createdAt)}
                        </span>
                      </div>

                      {/* Dropdown Menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <button
                            className="size-6 rounded-md flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                            title="More options"
                          >
                            <MoreHorizontal className="size-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-42 rounded-xl p-1 shadow-xl">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/diagram/${diagram.id}`);
                            }}
                            className="gap-2 text-xs cursor-pointer"
                          >
                            <ExternalLink className="size-3.5" />
                            <span>Open Diagram</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenamingDiagram({ id: diagram.id, title: diagram.title });
                              setNewDiagramTitleInput(diagram.title);
                              setShowRenameDiagramModal(true);
                            }}
                            className="gap-2 text-xs cursor-pointer"
                          >
                            <Edit2 className="size-3.5" />
                            <span>Rename</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setSharingDiagram(diagram);
                            }}
                            className="gap-2 text-xs cursor-pointer"
                          >
                            <Share2 className="size-3.5" />
                            <span>Share...</span>
                          </DropdownMenuItem>
                          {diagram.isPublic && diagram.shareToken && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                const shareUrl = `${window.location.origin}/share/${diagram.shareToken}`;
                                navigator.clipboard.writeText(shareUrl);
                                toast.success('Share link copied');
                              }}
                              className="gap-2 text-xs cursor-pointer"
                            >
                              <Copy className="size-3.5" />
                              <span>Copy Share Link</span>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => handleDeleteDiagram(diagram.id, e)}
                            className="gap-2 text-xs text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                          >
                            <Trash2 className="size-3.5" />
                            <span>Delete</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ─── List / Table View ─── */
          <div className="space-y-1">
            {/* Table Column Headers */}
            <div className="grid grid-cols-12 px-4 py-2 text-[11px] font-semibold text-muted-foreground/80 uppercase tracking-wider border-b border-border/40 select-none">
              <div className="col-span-6 sm:col-span-5 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="size-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
                  title={allFilteredSelected ? 'Deselect all' : 'Select all'}
                >
                  {allFilteredSelected ? (
                    <CheckSquare className="size-4 text-primary" />
                  ) : someFilteredSelected ? (
                    <MinusSquare className="size-4 text-primary" />
                  ) : (
                    <Square className="size-4 opacity-50 hover:opacity-100" />
                  )}
                </button>
                <span>NAME</span>
              </div>
              <div className="col-span-3 sm:col-span-2 text-left">
                <span>CREATED</span>
              </div>
              <div className="col-span-3 sm:col-span-3 flex items-center gap-1 text-foreground font-semibold">
                <ArrowDown className="size-3 text-primary stroke-[2.5]" />
                <span>EDITED</span>
              </div>
              <div className="hidden sm:block sm:col-span-1 text-center">
                <span>FAVORITE</span>
              </div>
              <div className="hidden sm:block sm:col-span-1 text-right">
                <span>ACTIONS</span>
              </div>
            </div>

            {/* Table Rows */}
            <div className="space-y-0.5 pt-1">
              {filteredDiagrams.map((diagram) => {
                const isSelected = selectedDiagramIds.has(diagram.id);
                return (
                  <div
                    key={diagram.id}
                    onClick={() => router.push(`/diagram/${diagram.id}`)}
                    className={cn(
                      'grid grid-cols-12 px-4 py-2.5 items-center rounded-xl transition-colors cursor-pointer group',
                      isSelected
                        ? 'bg-primary/10 border border-primary/25 shadow-2xs'
                        : 'hover:bg-muted/40 border border-transparent'
                    )}
                  >
                    {/* Name Column */}
                    <div className="col-span-6 sm:col-span-5 flex items-center gap-2.5 min-w-0 pr-2">
                      <button
                        type="button"
                        onClick={(e) => toggleSelectDiagram(diagram.id, e)}
                        className={cn(
                          'size-5 rounded flex items-center justify-center transition-opacity cursor-pointer shrink-0',
                          isSelected
                            ? 'text-primary opacity-100'
                            : 'text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground'
                        )}
                        title={isSelected ? 'Deselect' : 'Select'}
                      >
                        {isSelected ? (
                          <CheckSquare className="size-4 text-primary" />
                        ) : (
                          <Square className="size-4" />
                        )}
                      </button>

                      <div className="size-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 group-hover:scale-105 transition-transform">
                        <Columns2 className="size-3.5" />
                      </div>

                      <span className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors truncate">
                        {diagram.title}
                      </span>

                      {diagram.isPublic && (
                        <Badge variant="outline" className="text-[9px] py-0 px-1 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 shrink-0">
                          Public
                        </Badge>
                      )}
                    </div>

                    {/* Created Column */}
                    <div className="col-span-3 sm:col-span-2 text-xs text-muted-foreground">
                      {formatRelativeTime(diagram.createdAt)}
                    </div>

                    {/* Edited Column */}
                    <div className="col-span-3 sm:col-span-3 text-xs text-muted-foreground">
                      {formatRelativeTime(diagram.updatedAt)}
                    </div>

                    {/* Star Column */}
                    <div className="hidden sm:flex sm:col-span-1 items-center justify-center">
                      <button
                        type="button"
                        onClick={(e) => handleToggleStar(diagram.id, e)}
                        className={cn(
                          'size-7 rounded-md flex items-center justify-center transition-colors cursor-pointer',
                          diagram.isStarred
                            ? 'text-amber-400'
                            : 'text-muted-foreground/40 hover:text-amber-400 hover:bg-muted/60 opacity-0 group-hover:opacity-100'
                        )}
                        title={diagram.isStarred ? 'Unstar' : 'Star'}
                      >
                        <Star className={cn('size-3.5', diagram.isStarred && 'fill-amber-400')} />
                      </button>
                    </div>

                    {/* Action Column */}
                    <div className="hidden sm:flex sm:col-span-1 items-center justify-end gap-1.5">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <button className="size-7 rounded-md flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors opacity-0 group-hover:opacity-100 cursor-pointer">
                            <MoreHorizontal className="size-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-42 rounded-xl p-1 shadow-xl">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/diagram/${diagram.id}`);
                            }}
                            className="gap-2 text-xs cursor-pointer"
                          >
                            <ExternalLink className="size-3.5" />
                            <span>Open File</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenamingDiagram({ id: diagram.id, title: diagram.title });
                              setNewDiagramTitleInput(diagram.title);
                              setShowRenameDiagramModal(true);
                            }}
                            className="gap-2 text-xs cursor-pointer"
                          >
                            <Edit2 className="size-3.5" />
                            <span>Rename</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setSharingDiagram(diagram);
                            }}
                            className="gap-2 text-xs cursor-pointer"
                          >
                            <Share2 className="size-3.5" />
                            <span>Share...</span>
                          </DropdownMenuItem>
                          {diagram.isPublic && diagram.shareToken && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                const shareUrl = `${window.location.origin}/share/${diagram.shareToken}`;
                                navigator.clipboard.writeText(shareUrl);
                                toast.success('Share link copied');
                              }}
                              className="gap-2 text-xs cursor-pointer"
                            >
                              <Copy className="size-3.5" />
                              <span>Copy Link</span>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => handleDeleteDiagram(diagram.id, e)}
                            className="gap-2 text-xs text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                          >
                            <Trash2 className="size-3.5" />
                            <span>Delete</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* ─── Floating Bulk Actions Bar ─── */}
      {selectedDiagramIds.size > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-card/95 backdrop-blur-md border border-border shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2 pr-2.5 border-r border-border text-xs font-medium text-foreground">
            <span className="size-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">
              {selectedDiagramIds.size}
            </span>
            <span>{selectedDiagramIds.size === 1 ? 'file selected' : 'files selected'}</span>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleSelectAll}
            className="h-8 text-xs font-normal text-muted-foreground hover:text-foreground cursor-pointer"
          >
            {allFilteredSelected ? 'Deselect all' : `Select all (${filteredDiagrams.length})`}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSelectedDiagramIds(new Set())}
            className="h-8 text-xs font-normal text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="size-3.5 mr-1" />
            Clear
          </Button>

          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={isDeletingBatch}
            onClick={() => setShowBatchDeleteModal(true)}
            className="h-8 px-3 text-xs font-semibold gap-1.5 shadow-xs cursor-pointer"
          >
            {isDeletingBatch ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Trash2 className="size-3.5" />
            )}
            <span>Delete ({selectedDiagramIds.size})</span>
          </Button>
        </div>
      )}

      {/* ─── Batch Delete Confirmation Modal ─── */}
      <Dialog open={showBatchDeleteModal} onOpenChange={setShowBatchDeleteModal}>
        <DialogContent className="sm:max-w-md rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              <span>Delete {selectedDiagramIds.size} {selectedDiagramIds.size === 1 ? 'diagram' : 'diagrams'}?</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1.5">
              Are you sure you want to permanently delete the selected {selectedDiagramIds.size} {selectedDiagramIds.size === 1 ? 'diagram' : 'diagrams'}? This action cannot be undone and will delete all associated canvas scenes, specifications, and version history.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isDeletingBatch}
              onClick={() => setShowBatchDeleteModal(false)}
              className="rounded-xl text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isDeletingBatch}
              onClick={handleConfirmBatchDelete}
              className="rounded-xl text-xs gap-1.5 font-semibold cursor-pointer"
            >
              {isDeletingBatch ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
              <span>Permanently Delete</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Rename Diagram Modal ─── */}
      <Dialog open={showRenameDiagramModal} onOpenChange={setShowRenameDiagramModal}>
        <DialogContent className="sm:max-w-sm rounded-2xl p-5 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Rename Diagram</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={newDiagramTitleInput}
              onChange={(e) => setNewDiagramTitleInput(e.target.value)}
              placeholder="e.g. Distributed Ingress Topology"
              className="h-9 text-xs rounded-xl"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameDiagram();
              }}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowRenameDiagramModal(false)}
              className="rounded-xl text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleRenameDiagram}
              className="rounded-xl text-xs font-semibold cursor-pointer"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Create Diagram & Templates Modal ─── */}
      <CreateDiagramDialog
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        projectId={selectedProjectId || undefined}
        initialTemplateKey={initialTemplateKey}
      />

      {/* ─── Invite Collaborator Modal ─── */}
      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent className="sm:max-w-md rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Invite to Workspace</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Invite teammates to collaborate in real-time on diagrams and specifications.
            </DialogDescription>
          </DialogHeader>

          {createdInviteUrl ? (
            <div className="space-y-4 pt-2">
              <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <Check className="size-4" />
                  Invitation Link Ready
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Share this invitation link with <strong>{inviteEmail}</strong>. When they open the link, they will join with{' '}
                  <strong className="capitalize">{inviteRole}</strong> permissions.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Invitation URL</label>
                <div className="flex items-center gap-2">
                  <Input readOnly value={createdInviteUrl} className="h-9 font-mono text-[11px] bg-muted/40" />
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 px-3 gap-1.5 shrink-0 text-xs font-medium"
                    onClick={() => handleCopyInviteLink(createdInviteUrl)}
                  >
                    {copiedInviteLink ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    {copiedInviteLink ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>

              <DialogFooter className="pt-2 flex flex-row items-center justify-between gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCreatedInviteUrl(null);
                    setInviteEmail('');
                  }}
                  className="rounded-xl text-xs border-border/60"
                >
                  Invite Another
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setShowInviteModal(false);
                    setCreatedInviteUrl(null);
                    setInviteEmail('');
                  }}
                  className="rounded-xl text-xs font-medium"
                >
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleInviteCollaborator} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Input
                  type="email"
                  required
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="h-9 text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Select
                  value={inviteRole}
                  onValueChange={(val: 'editor' | 'viewer' | 'admin') => setInviteRole(val)}
                >
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="editor">Editor (Can edit & diagram)</SelectItem>
                    <SelectItem value="viewer">Viewer (Read-only)</SelectItem>
                    <SelectItem value="admin">Admin (Full permissions)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowInviteModal(false)}
                  className="rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isInviting}
                  className="rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                >
                  {isInviting ? 'Generating...' : 'Generate Invite Link'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Rename / New Folder Modal ─── */}
      <Dialog open={showRenameFolderModal} onOpenChange={setShowRenameFolderModal}>
        <DialogContent className="sm:max-w-sm rounded-2xl p-5 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Folder Name</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={newFolderNameInput}
              onChange={(e) => setNewFolderNameInput(e.target.value)}
              placeholder="e.g. Architecture Specs"
              className="h-9 text-xs rounded-xl"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameFolder();
              }}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowRenameFolderModal(false)}
              className="rounded-xl text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleRenameFolder}
              className="rounded-xl text-xs font-semibold cursor-pointer"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Share Diagram Dialog ─── */}
      {sharingDiagram && (
        <ShareDiagramDialog
          open={!!sharingDiagram}
          onOpenChange={(open) => !open && setSharingDiagram(null)}
          diagramId={sharingDiagram.id}
          diagramTitle={sharingDiagram.title}
          initialIsPublic={sharingDiagram.isPublic}
          initialShareToken={sharingDiagram.shareToken}
          initialShareRole={sharingDiagram.shareRole || 'viewer'}
          onShareSettingsChanged={(settings) => {
            setDiagrams((prev) =>
              prev.map((d) =>
                d.id === sharingDiagram.id
                  ? {
                      ...d,
                      isPublic: settings.isPublic,
                      shareToken: settings.shareToken,
                      shareRole: settings.shareRole,
                    }
                  : d
              )
            );
          }}
        />
      )}
    </div>
  );
}
