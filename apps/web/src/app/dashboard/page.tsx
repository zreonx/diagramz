'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Layers,
  Sparkles,
  Clock,
  Globe,
  Lock,
  Trash2,
  TrendingUp,
  FolderKanban,
  Users,
  Search,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DiagramSummary, ProjectSummary, WorkspaceSummary } from '@diagramz/shared';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';

export default function DashboardPage() {
  const router = useRouter();
  const [diagrams, setDiagrams] = useState<DiagramSummary[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('flowchart');
  const [initialMermaid, setInitialMermaid] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');

  const TEMPLATES: Record<string, { label: string; code: string; desc: string }> = {
    flowchart: {
      label: 'Flowchart / Architecture',
      desc: 'Top-down service architecture',
      code: `flowchart TD\n    Client[Web & Mobile Client] --> Gateway[API Gateway]\n    Gateway --> ServiceA[Order Service]\n    Gateway --> ServiceB[User Service]\n    ServiceA --> DB[(PostgreSQL)]`,
    },
    sequence: {
      label: 'Sequence Diagram',
      desc: 'API calls and authentication flow',
      code: `sequenceDiagram\n    autonumber\n    actor Client\n    participant API as API Server\n    participant DB as Database\n    Client->>API: POST /login\n    API->>DB: Verify credentials\n    DB-->>API: User OK\n    API-->>Client: JWT Token`,
    },
    eventdriven: {
      label: 'Event-Driven Kafka',
      desc: 'Pub/sub message broker flow',
      code: `flowchart LR\n    Producer[Order Producer] -->|Publish| Topic[(orders.topic)]\n    Topic --> ConsumerA[Payment Worker]\n    Topic --> ConsumerB[Email Notification Worker]`,
    },
    blank: {
      label: 'Blank Canvas',
      desc: 'Start with an empty canvas',
      code: `flowchart TD\n    Node1[Start] --> Node2[End]`,
    },
  };

  useEffect(() => {
    // 1. Fetch workspaces
    apiClient
      .get<WorkspaceSummary[]>('/workspaces')
      .then(async (wsRes) => {
        if (wsRes.data.length === 0) return;
        const ws = wsRes.data[0];

        // 2. Fetch projects
        const projRes = await apiClient.get<ProjectSummary[]>(`/workspaces/${ws.id}/projects`);
        let activeProj = projRes.data[0];

        // If no project exists yet, automatically create default project
        if (!activeProj) {
          const newProj = await apiClient.post<ProjectSummary>(`/workspaces/${ws.id}/projects`, {
            name: 'Main Diagrams',
          });
          activeProj = newProj.data;
          setProjects([activeProj]);
        } else {
          setProjects(projRes.data);
        }

        setSelectedProjectId(activeProj.id);

        // 3. Fetch diagrams
        const diagRes = await apiClient.get<DiagramSummary[]>(
          `/projects/${activeProj.id}/diagrams`,
        );
        setDiagrams(diagRes.data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setIsLoading(false);
      });
  }, []);

  const handleCreateDiagram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !newTitle.trim()) return;

    setIsSubmitting(true);
    const chosenCode = initialMermaid.trim() || TEMPLATES[selectedTemplate]?.code;

    try {
      const res = await apiClient.post(`/projects/${selectedProjectId}/diagrams`, {
        title: newTitle.trim(),
        mermaidCode: chosenCode,
      });

      toast.success('Diagram created successfully!');
      setShowCreateModal(false);
      router.push(`/diagram/${res.data.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create diagram');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDiagram = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!confirm('Are you sure you want to delete this diagram?')) return;

    try {
      await apiClient.delete(`/diagrams/${id}`);
      setDiagrams(diagrams.filter((d) => d.id !== id));
      toast.success('Diagram deleted');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete diagram');
    }
  };

  const filteredDiagrams = diagrams.filter(
    (d) =>
      d.title.toLowerCase().includes(filterQuery.toLowerCase()) ||
      (d.mermaidCode && d.mermaidCode.toLowerCase().includes(filterQuery.toLowerCase())),
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Dashboard Overview</h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time collaborative diagramming workspace, code-as-diagrams, and AI generation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => {
              setInitialMermaid(TEMPLATES.flowchart.code);
              setShowCreateModal(true);
            }}
            className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-md shadow-blue-600/20 gap-1.5"
          >
            <Plus className="size-4" />
            <span>New Diagram</span>
          </Button>
        </div>
      </div>

      {/* Metric / Stat Cards (shadcn Card design) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Diagrams</span>
            <div className="size-8 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Layers className="size-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white tracking-tight">{diagrams.length}</div>
            <div className="flex items-center gap-1 text-[11px] text-emerald-400 mt-1">
              <TrendingUp className="size-3" />
              <span>Available in project</span>
            </div>
          </div>
        </Card>

        <Card className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Active Projects</span>
            <div className="size-8 rounded-lg bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <FolderKanban className="size-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white tracking-tight">
              {projects.length || 1}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Scoped permissions</div>
          </div>
        </Card>

        <Card className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Multiplayer Presence</span>
            <div className="size-8 rounded-lg bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Users className="size-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white tracking-tight">Active</div>
            <div className="text-[11px] text-emerald-400 mt-1">Socket.IO Yjs CRDTs</div>
          </div>
        </Card>

        <Card className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">AI Architect</span>
            <div className="size-8 rounded-lg bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Sparkles className="size-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white tracking-tight">Online</div>
            <div className="text-[11px] text-purple-300 mt-1">Strict Mermaid validation</div>
          </div>
        </Card>
      </div>

      {/* Main Tabs (shadcn Tabs) */}
      <Tabs defaultValue="all" className="w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-3">
          <TabsList>
            <TabsTrigger value="all">All Diagrams</TabsTrigger>
            <TabsTrigger value="public">Public</TabsTrigger>
            <TabsTrigger value="private">Private</TabsTrigger>
          </TabsList>

          {/* Search & Filter using shadcn Input */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="size-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                type="text"
                placeholder="Filter diagrams..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="h-8 pl-8 pr-3 w-56 text-xs bg-slate-900 border-slate-800"
              />
            </div>
          </div>
        </div>

        {/* Tab 1: All Diagrams Grid */}
        <TabsContent value="all" className="m-0">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-44 rounded-xl bg-slate-900 border border-slate-800 animate-pulse"
                />
              ))}
            </div>
          ) : filteredDiagrams.length === 0 ? (
            <div className="border border-dashed border-slate-800 rounded-2xl p-12 text-center bg-slate-900/30">
              <div className="size-12 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-3">
                <Sparkles className="size-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-200 mb-1">No diagrams found</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mb-5">
                {filterQuery
                  ? 'No diagrams matching your filter query.'
                  : 'Get started by creating your first diagram or launch from an architectural template.'}
              </p>
              <Button
                size="sm"
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
              >
                Create Your First Diagram
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              {filteredDiagrams.map((diagram) => (
                <Link
                  key={diagram.id}
                  href={`/diagram/${diagram.id}`}
                  className="group flex flex-col justify-between p-5 rounded-xl bg-slate-900/90 border border-slate-800/80 hover:border-blue-500/50 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-150"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-semibold text-slate-100 group-hover:text-blue-400 transition-colors truncate">
                        {diagram.title}
                      </div>
                      <button
                        onClick={(e) => handleDeleteDiagram(diagram.id, e)}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-400 p-1 rounded transition-opacity"
                        title="Delete diagram"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>

                    <div className="h-24 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 overflow-hidden font-mono text-[11px] text-slate-300 mb-3 select-none">
                      <pre className="line-clamp-4 leading-relaxed">
                        {diagram.mermaidCode || 'Empty diagram canvas'}
                      </pre>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-3 border-t border-slate-800/80">
                    <span className="flex items-center gap-1.5">
                      <Clock className="size-3.5 text-slate-500" />
                      <span>{formatDate(diagram.updatedAt)}</span>
                    </span>

                    {diagram.isPublic ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
                        <Globe className="size-3" /> Public
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded">
                        <Lock className="size-3" /> Private
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab 2: Public */}
        <TabsContent value="public" className="m-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {filteredDiagrams
              .filter((d) => d.isPublic)
              .map((diagram) => (
                <Link
                  key={diagram.id}
                  href={`/diagram/${diagram.id}`}
                  className="group flex flex-col justify-between p-5 rounded-xl bg-slate-900/90 border border-slate-800"
                >
                  <div className="text-sm font-semibold text-slate-100">{diagram.title}</div>
                  <div className="text-xs text-slate-400 mt-2">Public Share Enabled</div>
                </Link>
              ))}
          </div>
        </TabsContent>

        {/* Tab 3: Private */}
        <TabsContent value="private" className="m-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {filteredDiagrams
              .filter((d) => !d.isPublic)
              .map((diagram) => (
                <Link
                  key={diagram.id}
                  href={`/diagram/${diagram.id}`}
                  className="group flex flex-col justify-between p-5 rounded-xl bg-slate-900/90 border border-slate-800"
                >
                  <div className="text-sm font-semibold text-slate-100">{diagram.title}</div>
                  <div className="text-xs text-slate-400 mt-2">Private Team Only</div>
                </Link>
              ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Diagram Dialog (using shadcn Input, Label, Textarea, Button, Dialog) */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-lg bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle>Create New Diagram</DialogTitle>
            <DialogDescription>
              Choose a starter architecture template or enter custom Mermaid syntax.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateDiagram} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="diagram-title">Diagram Title</Label>
              <Input
                id="diagram-title"
                required
                placeholder="e.g. Distributed Payment Pipeline"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Architecture Starter Template</Label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(TEMPLATES).map(([key, tpl]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setSelectedTemplate(key);
                      setInitialMermaid(tpl.code);
                    }}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      selectedTemplate === key
                        ? 'bg-blue-600/10 border-blue-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-semibold text-slate-200">{tpl.label}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{tpl.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mermaid-code">Mermaid Code Preview</Label>
              <Textarea
                id="mermaid-code"
                rows={4}
                value={initialMermaid}
                onChange={(e) => setInitialMermaid(e.target.value)}
                className="text-emerald-300 resize-none font-mono"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create & Open Canvas'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
