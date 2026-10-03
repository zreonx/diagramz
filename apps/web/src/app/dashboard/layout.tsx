'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Layers,
  LayoutDashboard,
  FolderKanban,
  Users,
  Settings,
  LogOut,
  Plus,
  ChevronDown,
  Building2,
  Search,
  Bell,
  Sparkles,
  Command,
  FileText,
  Activity,
  User,
  ShieldCheck,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
    apiClient
      .get<WorkspaceSummary[]>('/workspaces')
      .then((res) => {
        setWorkspaces(res.data);
        if (res.data.length > 0 && !activeWorkspace) {
          setActiveWorkspace(res.data[0]);
        }
      })
      .catch(console.error);
  }, [user]);

  // Load projects for active workspace
  useEffect(() => {
    if (!activeWorkspace) return;
    apiClient
      .get<ProjectSummary[]>(`/workspaces/${activeWorkspace.id}/projects`)
      .then((res) => setProjects(res.data))
      .catch(console.error);
  }, [activeWorkspace]);

  // Keyboard shortcut Ctrl+K / Cmd+K for command menu
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 animate-pulse" />
          <span className="text-xs font-medium">Loading Diagramz Dashboard...</span>
        </div>
      </div>
    );
  }

  const navItems = [
    {
      title: 'General',
      items: [
        {
          label: 'Overview',
          href: '/dashboard',
          icon: LayoutDashboard,
          active: pathname === '/dashboard',
        },
        {
          label: 'Team Members',
          href: '/dashboard/workspaces',
          icon: Users,
          active: pathname === '/dashboard/workspaces',
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen flex bg-[#0a0e17] text-slate-100 antialiased">
      {/* Sidebar (shadcn-admin style) */}
      <aside className="w-64 border-r border-slate-800/80 bg-slate-950 flex flex-col flex-shrink-0 select-none">
        {/* Team/Workspace Switcher Header */}
        <div className="h-16 px-4 border-b border-slate-800/80 flex items-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-900 border border-slate-800 transition-colors text-left outline-none">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-xs text-white shadow-md shadow-blue-500/20">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div className="overflow-hidden">
                    <div className="text-xs font-semibold text-slate-100 truncate">
                      {activeWorkspace?.name || 'Workspace'}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate uppercase tracking-wider">
                      {activeWorkspace?.role || 'Team'}
                    </div>
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 ml-1" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Your Workspaces</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {workspaces.map((ws) => (
                <DropdownMenuItem
                  key={ws.id}
                  onClick={() => setActiveWorkspace(ws)}
                  className="flex items-center gap-2 text-xs"
                >
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span className="truncate flex-1">{ws.name}</span>
                  {activeWorkspace?.id === ws.id && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Navigation Categories */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {navItems.map((group, idx) => (
            <div key={idx}>
              <div className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider px-2.5 mb-2">
                {group.title}
              </div>
              <div className="space-y-1">
                {group.items.map((item, itemIdx) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={itemIdx}
                      href={item.href}
                      className={`flex items-center gap-3 px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${
                        item.active
                          ? 'bg-slate-800 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${item.active ? 'text-blue-400' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Projects Group */}
          <div>
            <div className="flex items-center justify-between text-[10px] uppercase font-semibold text-slate-500 tracking-wider px-2.5 mb-2">
              <span>Projects</span>
            </div>
            <div className="space-y-1">
              {projects.length === 0 ? (
                <div className="px-2.5 py-1 text-[11px] text-slate-500 italic">No projects</div>
              ) : (
                projects.map((proj) => (
                  <Link
                    key={proj.id}
                    href={`/dashboard?project=${proj.id}`}
                    className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-colors truncate"
                  >
                    <FolderKanban className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                    <span className="truncate">{proj.name}</span>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        {/* User Footer (shadcn-admin style) */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-900 transition-colors text-left outline-none">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.avatarUrl || ''} />
                    <AvatarFallback>{user?.name.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
                  </Avatar>
                  <div className="overflow-hidden">
                    <div className="text-xs font-semibold text-slate-200 truncate">{user?.name}</div>
                    <div className="text-[10px] text-slate-400 truncate">{user?.email}</div>
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 ml-1" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 mb-2">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/dashboard/workspaces')}>
                <Users className="w-4 h-4 mr-2" /> Team Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => logout()} className="text-red-400 focus:text-red-300">
                <LogOut className="w-4 h-4 mr-2" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar (shadcn-admin style) */}
        <header className="h-16 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur px-8 flex items-center justify-between select-none z-10">
          {/* Quick Search Bar (Command menu trigger) */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 h-9 w-64 rounded-md border border-slate-800 bg-slate-900/60 px-3 text-xs text-slate-400 hover:border-slate-700 hover:text-slate-200 transition-colors shadow-sm"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="flex-1 text-left">Search diagrams or code...</span>
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-slate-700 bg-slate-800 px-1.5 font-mono text-[10px] font-medium text-slate-400">
                <span className="text-xs">⌘</span>K
              </kbd>
            </button>
          </div>

          {/* Right Header Icons */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs px-2.5 py-1 rounded-full bg-blue-950/50 border border-blue-800/40 text-blue-400 font-medium">
              <Sparkles className="w-3.5 h-3.5" /> AI Engine Active
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="text-slate-400 hover:text-white hover:bg-slate-900"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>

      {/* Command Search Dialog */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="p-0 overflow-hidden max-w-xl bg-slate-900 border-slate-800">
          <div className="flex items-center border-b border-slate-800 px-3">
            <Search className="w-4 h-4 text-slate-400 mr-2" />
            <input
              type="text"
              placeholder="Type a command or search diagrams..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-12 w-full bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none"
            />
          </div>
          <div className="p-4 space-y-2 text-xs">
            <div className="text-[10px] uppercase font-semibold text-slate-500">Quick Navigation</div>
            <button
              onClick={() => {
                router.push('/dashboard');
                setSearchOpen(false);
              }}
              className="w-full flex items-center gap-2.5 p-2 rounded hover:bg-slate-800 text-left text-slate-300"
            >
              <LayoutDashboard className="w-4 h-4 text-blue-400" />
              <span>Go to Overview Dashboard</span>
            </button>
            <button
              onClick={() => {
                router.push('/dashboard/workspaces');
                setSearchOpen(false);
              }}
              className="w-full flex items-center gap-2.5 p-2 rounded hover:bg-slate-800 text-left text-slate-300"
            >
              <Users className="w-4 h-4 text-emerald-400" />
              <span>Manage Team Members & Roles</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
