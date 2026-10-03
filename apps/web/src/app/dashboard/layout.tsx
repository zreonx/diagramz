'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Layers,
  FolderKanban,
  Users,
  Settings,
  LogOut,
  Plus,
  ChevronDown,
  Building2,
  FileCode2,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { WorkspaceSummary, ProjectSummary } from '@diagramz/shared';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, checkAuth, logout, isLoading } = useAuthStore();

  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceSummary | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  useEffect(() => {
    checkAuth().then((authenticated) => {
      if (!authenticated) {
        router.push('/login');
      }
    });
  }, [checkAuth, router]);

  // Load workspaces
  useEffect(() => {
    if (!user) return;
    apiClient.get<WorkspaceSummary[]>('/workspaces').then((res) => {
      setWorkspaces(res.data);
      if (res.data.length > 0 && !activeWorkspace) {
        setActiveWorkspace(res.data[0]);
      }
    }).catch(console.error);
  }, [user]);

  // Load projects for active workspace
  useEffect(() => {
    if (!activeWorkspace) return;
    apiClient
      .get<ProjectSummary[]>(`/workspaces/${activeWorkspace.id}/projects`)
      .then((res) => setProjects(res.data))
      .catch(console.error);
  }, [activeWorkspace]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace || !newProjectName.trim()) return;
    setIsCreatingProject(true);
    try {
      const res = await apiClient.post<ProjectSummary>(
        `/workspaces/${activeWorkspace.id}/projects`,
        { name: newProjectName.trim() },
      );
      setProjects([res.data, ...projects]);
      setNewProjectName('');
      setShowNewProjectModal(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsCreatingProject(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400">
        Loading Diagramz...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900/90 flex flex-col flex-shrink-0 select-none">
        {/* Workspace Switcher */}
        <div className="p-3 border-b border-slate-800 relative">
          <button
            onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
            className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 transition-colors"
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center font-bold text-xs text-white">
                {activeWorkspace?.name.charAt(0) || 'W'}
              </div>
              <div className="text-left overflow-hidden">
                <div className="text-xs font-semibold text-slate-100 truncate">
                  {activeWorkspace?.name || 'Select Workspace'}
                </div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                  {activeWorkspace?.role || 'member'}
                </div>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
          </button>

          {/* Switcher Dropdown */}
          {showWorkspaceMenu && (
            <div className="absolute top-full left-3 right-3 mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-1.5 z-50">
              <div className="text-[10px] uppercase font-semibold text-slate-500 px-2 py-1">
                Your Workspaces
              </div>
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => {
                    setActiveWorkspace(ws);
                    setShowWorkspaceMenu(false);
                  }}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left ${
                    activeWorkspace?.id === ws.id
                      ? 'bg-blue-600/20 text-blue-400 font-medium'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span className="truncate">{ws.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-6">
          <div>
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 mb-2">
              <span>Projects</span>
              <button
                onClick={() => setShowNewProjectModal(true)}
                className="hover:text-blue-400 transition-colors p-0.5"
                title="New Project"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-0.5">
              <Link
                href="/dashboard"
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                  pathname === '/dashboard'
                    ? 'bg-blue-600 text-white font-medium shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <FolderKanban className="w-4 h-4" />
                <span>All Diagrams</span>
              </Link>

              {projects.map((proj) => (
                <Link
                  key={proj.id}
                  href={`/dashboard?project=${proj.id}`}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors truncate"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                  <span className="truncate">{proj.name}</span>
                </Link>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 mb-2">
              Workspace Settings
            </div>
            <div className="space-y-0.5">
              <Link
                href="/dashboard/workspaces"
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                  pathname === '/dashboard/workspaces'
                    ? 'bg-blue-600 text-white font-medium'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Members & Roles</span>
              </Link>
            </div>
          </div>
        </div>

        {/* User Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-blue-400 border border-slate-700">
              {user?.name.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-semibold text-slate-200 truncate">{user?.name}</div>
              <div className="text-[10px] text-slate-400 truncate">{user?.email}</div>
            </div>
          </div>
          <button
            onClick={() => logout()}
            className="text-slate-400 hover:text-red-400 p-1.5 rounded hover:bg-slate-800 transition-colors"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">{children}</main>

      {/* New Project Modal */}
      {showNewProjectModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-sm w-full shadow-2xl">
            <h3 className="text-base font-semibold text-slate-100 mb-1">Create Project</h3>
            <p className="text-xs text-slate-400 mb-4">
              Group diagrams within your workspace for team collaboration.
            </p>
            <form onSubmit={handleCreateProject}>
              <div className="mb-4">
                <label className="text-xs text-slate-300 block mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Infrastructure Architecture"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setShowNewProjectModal(false)}>
                  Cancel
                </Button>
                <Button size="sm" type="submit" disabled={isCreatingProject}>
                  {isCreatingProject ? 'Creating...' : 'Create'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
