'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, LayoutGrid, Sparkles, Clock, Globe, Lock, Trash2, ArrowUpRight } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  const [initialMermaid, setInitialMermaid] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // 1. Fetch workspaces
    apiClient.get<WorkspaceSummary[]>('/workspaces').then(async (wsRes) => {
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
    }).catch((err) => {
      console.error(err);
      setIsLoading(false);
    });
  }, []);

  const handleCreateDiagram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !newTitle.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await apiClient.post(`/projects/${selectedProjectId}/diagrams`, {
        title: newTitle.trim(),
        mermaidCode:
          initialMermaid.trim() ||
          `flowchart TD\n    Client[Client App] --> API[NestJS API Gateway]\n    API --> DB[(PostgreSQL Database)]`,
      });

      toast.success('Diagram created successfully!');
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

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Your Diagrams</h1>
          <p className="text-xs text-slate-400 mt-1">
            Create, collaborate, and design architectures with AI assistance.
          </p>
        </div>

        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-9 px-4 gap-1.5 shadow-md shadow-blue-600/20"
        >
          <Plus className="w-4 h-4" />
          <span>New Diagram</span>
        </Button>
      </div>

      {/* Grid of Diagrams */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-44 rounded-xl bg-slate-900 border border-slate-800 animate-pulse"
            />
          ))}
        </div>
      ) : diagrams.length === 0 ? (
        <div className="border border-dashed border-slate-800 rounded-2xl p-12 text-center bg-slate-900/30">
          <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-3">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-200 mb-1">No diagrams found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-5">
            Get started by launching your first diagram canvas or let AI generate one for you.
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
          {diagrams.map((diagram) => (
            <Link
              key={diagram.id}
              href={`/diagram/${diagram.id}`}
              className="group flex flex-col justify-between p-4 rounded-xl bg-slate-900/90 border border-slate-800/80 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-150"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold text-slate-200 group-hover:text-blue-400 transition-colors truncate">
                    {diagram.title}
                  </div>
                  <button
                    onClick={(e) => handleDeleteDiagram(diagram.id, e)}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-400 p-1 rounded transition-opacity"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <p className="text-[11px] text-slate-400 font-mono line-clamp-3 bg-slate-950 p-2 rounded border border-slate-800/60 mb-3">
                  {diagram.mermaidCode || 'No Mermaid code defined.'}
                </p>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800/60">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {formatDate(diagram.updatedAt)}
                </span>
                <span className="flex items-center gap-1">
                  {diagram.isPublic ? (
                    <span className="flex items-center gap-1 text-emerald-400">
                      <Globe className="w-3 h-3" /> Public
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-slate-500">
                      <Lock className="w-3 h-3" /> Private
                    </span>
                  )}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-semibold text-slate-100 mb-1">Create New Diagram</h3>
            <p className="text-xs text-slate-400 mb-4">
              Enter a title and optionally specify an initial Mermaid architecture.
            </p>

            <form onSubmit={handleCreateDiagram} className="space-y-4">
              <div>
                <label className="text-xs text-slate-300 block mb-1">Diagram Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Payment Gateway Architecture"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">
                  Initial Mermaid Code (Optional)
                </label>
                <textarea
                  rows={4}
                  placeholder="flowchart TD&#10;    A[Client] --> B[Server]"
                  value={initialMermaid}
                  onChange={(e) => setInitialMermaid(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button size="sm" variant="ghost" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button size="sm" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create & Open'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
