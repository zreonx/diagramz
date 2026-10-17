'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  ChevronDown,
  Building2,
  Bell,
  Sparkles,
  ChevronsUpDown,
  Check,
  Sun,
  Moon,
  Layers,
  Search,
  FolderKanban,
  HelpCircle,
  ChevronRight,
  Plus,
  Palette,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { WorkspaceSummary, ProjectSummary } from '@diagramz/shared';
import { WorkspaceFileTree } from '@/components/workspace/WorkspaceFileTree';
import { WorkspaceSwitcher } from '@/components/sidebar/workspace-switcher';
import { NavUser } from '@/components/sidebar/nav-user';
import { NavMain } from '@/components/sidebar/nav-main';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';

function getBreadcrumb(pathname: string) {
  const map: Record<string, string[]> = {
    '/dashboard': ['Workspace', 'Overview'],
    '/dashboard/workspaces': ['Workspace', 'Team & Members'],
    '/dashboard/settings': ['Workspace', 'Settings'],
    '/dashboard/settings/account': ['Settings', 'Account'],
    '/dashboard/settings/appearance': ['Settings', 'Appearance'],
    '/dashboard/settings/notifications': ['Settings', 'Notifications'],
  };
  return map[pathname] || ['Workspace', 'Page'];
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, checkAuth, logout, isLoading } = useAuthStore();
  const { theme, toggleTheme } = useTheme();

  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceSummary | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    checkAuth().then((authenticated) => {
      if (!authenticated) router.push('/login');
    });
  }, [checkAuth, router]);

  useEffect(() => {
    if (!user) return;
    apiClient
      .get<WorkspaceSummary[]>('/workspaces')
      .then((res) => {
        setWorkspaces(res.data);
        if (res.data.length > 0) {
          const savedId = typeof window !== 'undefined' ? localStorage.getItem('diagramz_active_workspace') : null;
          const found = savedId ? res.data.find((w) => w.id === savedId) : null;
          setActiveWorkspace(found || res.data[0]);
        }
      })
      .catch(console.error);
  }, [user]);

  const handleSelectWorkspace = (ws: WorkspaceSummary) => {
    setActiveWorkspace(ws);
    if (typeof window !== 'undefined') {
      localStorage.setItem('diagramz_active_workspace', ws.id);
    }
  };

  useEffect(() => {
    if (!activeWorkspace) return;
    apiClient
      .get<ProjectSummary[]>(`/workspaces/${activeWorkspace.id}/projects`)
      .then((res) => setProjects(res.data))
      .catch(console.error);
  }, [activeWorkspace]);

  const mainScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      const scrollEl = mainScrollRef.current;
      if (!scrollEl) return;

      // If wheel event originated inside the main scroll element, let standard scroll happen
      if (scrollEl.contains(e.target as Node)) {
        return;
      }

      // Check if target is inside an element that can actually scroll vertically
      let el = e.target as HTMLElement | null;
      let canTargetScroll = false;

      while (el && el !== document.body && el !== document.documentElement) {
        const style = window.getComputedStyle(el);
        if (['auto', 'scroll'].includes(style.overflowY) && el.scrollHeight > el.clientHeight) {
          const atTop = el.scrollTop <= 0 && e.deltaY < 0;
          const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1 && e.deltaY > 0;
          if (!atTop && !atBottom) {
            canTargetScroll = true;
            break;
          }
        }
        el = el.parentElement;
      }

      if (!canTargetScroll) {
        scrollEl.scrollTop += e.deltaY;
        if (e.deltaX) {
          scrollEl.scrollLeft += e.deltaX;
        }
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: true });
    return () => {
      window.removeEventListener('wheel', handleWheel);
    };
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg animate-pulse">
            <Layers className="w-5 h-5" />
          </div>
          <span className="text-xs text-muted-foreground font-medium">Loading Diagramz...</span>
        </div>
      </div>
    );
  }

  const breadcrumbs = getBreadcrumb(pathname);
  const userInitial = user?.name?.charAt(0).toUpperCase() || 'U';

  return (
    <SidebarProvider defaultOpen={true}>
      {/* ─── Sidebar ─── */}
      <Sidebar collapsible="icon">
        {/* Workspace Switcher */}
        <SidebarHeader>
          <WorkspaceSwitcher
            workspaces={workspaces}
            activeWorkspace={activeWorkspace}
            onSelectWorkspace={handleSelectWorkspace}
          />
        </SidebarHeader>

        {/* Nav Content */}
        <SidebarContent>
          <NavMain workspaceCount={workspaces.length} />

          {/* Files & Folders Tree */}
          {activeWorkspace && (
            <SidebarGroup className="group-data-[collapsible=icon]:hidden flex-1 min-h-0 pt-0 px-2">
              <WorkspaceFileTree
                workspaceId={activeWorkspace.id}
                className="flex-1 min-h-0 bg-transparent"
              />
            </SidebarGroup>
          )}
        </SidebarContent>

        {/* User Footer */}
        <SidebarFooter>
          <NavUser user={user} onLogout={logout} />
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      {/* ─── Main Content Inset ─── */}
      <SidebarInset className="bg-background flex flex-col flex-1 min-w-0 h-svh max-h-svh overflow-hidden">
        <div
          ref={mainScrollRef}
          className="flex-1 flex flex-col eraser-doc-scroll overflow-y-auto min-h-0"
        >
          {/* Top Header for subpages (Settings, Workspaces) */}
          {pathname !== '/dashboard' && (
            <header className="flex h-13 shrink-0 items-center justify-between gap-2 border-b border-border/50 bg-background/80 backdrop-blur-md px-4 sticky top-0 z-20">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors rounded-lg size-8" />
                <Separator orientation="vertical" className="mr-1 h-3.5 bg-border/60" />
                <Breadcrumb>
                  <BreadcrumbList className="text-xs">
                    <BreadcrumbItem>
                      <BreadcrumbLink href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
                        {breadcrumbs[0]}
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator>
                      <ChevronRight className="size-3 text-muted-foreground/60" />
                    </BreadcrumbSeparator>
                    <BreadcrumbItem>
                      <BreadcrumbPage className="text-foreground font-medium">
                        {breadcrumbs[1]}
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>

              {/* Right Actions */}
              <div className="flex items-center gap-1.5">
                {/* Search trigger */}
                <button
                  onClick={() => setCommandOpen(true)}
                  className="flex items-center gap-2 h-8 w-48 sm:w-56 rounded-lg border border-border/60 bg-muted/40 px-2.5 text-xs text-muted-foreground hover:bg-muted/70 hover:text-foreground hover:border-border transition-all shadow-2xs group cursor-pointer"
                >
                  <Search className="size-3.5 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
                  <span className="flex-1 text-left text-xs">Search or jump to...</span>
                  <kbd className="pointer-events-none hidden sm:inline-flex h-4.5 select-none items-center gap-0.5 rounded border border-border/60 bg-background/80 px-1 font-mono text-[9px] font-medium text-muted-foreground">
                    ⌘K
                  </kbd>
                </button>

                {/* AI badge */}
                <div className="hidden md:flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary font-medium tracking-tight">
                  <Sparkles className="size-3" />
                  AI Architect
                </div>

                {/* Theme toggle */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70"
                  onClick={toggleTheme}
                  title="Toggle theme"
                >
                  {theme === 'dark' ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
                </Button>

                {/* Notifications */}
                <NotificationCenter />
              </div>
            </header>
          )}

          {/* Page Content */}
          {children}
        </div>
      </SidebarInset>

      {/* ─── Command Palette ─── */}
      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigation">
            <CommandItem onSelect={() => { router.push('/dashboard'); setCommandOpen(false); }}>
              <LayoutDashboard className="mr-2 size-4 text-muted-foreground" />
              <span>Overview Dashboard</span>
            </CommandItem>
            <CommandItem onSelect={() => { router.push('/dashboard/workspaces'); setCommandOpen(false); }}>
              <Users className="mr-2 size-4 text-muted-foreground" />
              <span>Team & Roles</span>
            </CommandItem>
            <CommandItem onSelect={() => { router.push('/dashboard/settings'); setCommandOpen(false); }}>
              <Settings className="mr-2 size-4 text-muted-foreground" />
              <span>Settings</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Projects">
            {projects.map((proj) => (
              <CommandItem
                key={proj.id}
                onSelect={() => { router.push(`/dashboard?project=${proj.id}`); setCommandOpen(false); }}
              >
                <FolderKanban className="mr-2 size-4 text-muted-foreground" />
                <span>{proj.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </SidebarProvider>
  );
}
