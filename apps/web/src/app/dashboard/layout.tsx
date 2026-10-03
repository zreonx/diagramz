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
  Command as CommandIcon,
  ChevronsUpDown,
  Check,
  PanelLeft,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    checkAuth().then((authenticated) => {
      if (!authenticated) {
        router.push('/login');
      }
    });
  }, [checkAuth, router]);

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

  useEffect(() => {
    if (!activeWorkspace) return;
    apiClient
      .get<ProjectSummary[]>(`/workspaces/${activeWorkspace.id}/projects`)
      .then((res) => setProjects(res.data))
      .catch(console.error);
  }, [activeWorkspace]);

  // Command Menu keyboard listener
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 animate-pulse flex items-center justify-center text-white">
            <Layers className="w-5 h-5" />
          </div>
          <span className="text-xs font-medium">Loading Diagramz...</span>
        </div>
      </div>
    );
  }

  const activeBreadcrumbTitle =
    pathname === '/dashboard/workspaces' ? 'Team Members' : 'Overview';

  return (
    <SidebarProvider defaultOpen={true}>
      {/* Official shadcn Sidebar */}
      <Sidebar collapsible="icon" className="border-r border-slate-800 bg-slate-950 text-slate-100">
        {/* Workspace Switcher in SidebarHeader */}
        <SidebarHeader className="border-b border-slate-800/80 p-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-slate-900 data-[state=open]:text-white hover:bg-slate-900"
                  >
                    <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
                      <Layers className="size-4" />
                    </div>
                    <div className="grid flex-1 text-left text-xs leading-tight">
                      <span className="truncate font-semibold text-slate-100">
                        {activeWorkspace?.name || 'Workspace'}
                      </span>
                      <span className="truncate text-[10px] text-slate-400 uppercase tracking-wider">
                        {activeWorkspace?.role || 'Team'}
                      </span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-4 text-slate-400" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                  align="start"
                  side="bottom"
                  sideOffset={4}
                >
                  <DropdownMenuLabel className="text-slate-400 text-[10px]">
                    Workspaces
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {workspaces.map((ws) => (
                    <DropdownMenuItem
                      key={ws.id}
                      onClick={() => setActiveWorkspace(ws)}
                      className="gap-2 p-2 text-xs"
                    >
                      <div className="flex size-6 items-center justify-center rounded-sm border border-slate-700 bg-slate-800">
                        <Building2 className="size-3.5 shrink-0" />
                      </div>
                      <span className="flex-1 truncate">{ws.name}</span>
                      {activeWorkspace?.id === ws.id && (
                        <Check className="size-3.5 text-blue-400 ml-auto" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        {/* Sidebar Navigation Content */}
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Platform</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === '/dashboard'} tooltip="Overview">
                    <Link href="/dashboard">
                      <LayoutDashboard />
                      <span>Overview</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === '/dashboard/workspaces'}
                    tooltip="Team Members"
                  >
                    <Link href="/dashboard/workspaces">
                      <Users />
                      <span>Team Members</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Projects Group */}
          <SidebarGroup>
            <SidebarGroupLabel>Projects</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {projects.map((proj) => (
                  <SidebarMenuItem key={proj.id}>
                    <SidebarMenuButton asChild tooltip={proj.name}>
                      <Link href={`/dashboard?project=${proj.id}`}>
                        <FolderKanban />
                        <span className="truncate">{proj.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* Sidebar User Footer */}
        <SidebarFooter className="border-t border-slate-800/80 p-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-slate-900 data-[state=open]:text-white hover:bg-slate-900"
                  >
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage src={user?.avatarUrl || ''} />
                      <AvatarFallback className="rounded-lg">
                        {user?.name?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-xs leading-tight">
                      <span className="truncate font-semibold text-slate-100">{user?.name}</span>
                      <span className="truncate text-[10px] text-slate-400">{user?.email}</span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-4 text-slate-400" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                  side="bottom"
                  align="end"
                  sideOffset={4}
                >
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-xs">
                      <Avatar className="h-8 w-8 rounded-lg">
                        <AvatarImage src={user?.avatarUrl || ''} />
                        <AvatarFallback className="rounded-lg">
                          {user?.name?.charAt(0).toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1 text-left text-xs leading-tight">
                        <span className="truncate font-semibold text-slate-100">{user?.name}</span>
                        <span className="truncate text-[10px] text-slate-400">{user?.email}</span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push('/dashboard/workspaces')}>
                    <Users className="mr-2 size-4" /> Team & Roles
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => logout()}
                    className="text-red-400 focus:text-red-300"
                  >
                    <LogOut className="mr-2 size-4" /> Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      {/* Official shadcn SidebarInset */}
      <SidebarInset className="bg-[#090d16] flex flex-col flex-1 min-w-0">
        {/* Header Bar */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-2 h-4 bg-slate-800" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/dashboard" className="text-slate-400 hover:text-white">
                    {activeWorkspace?.name || 'Workspace'}
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{activeBreadcrumbTitle}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCommandOpen(true)}
              className="flex items-center gap-2 h-8 w-60 rounded-md border border-slate-800 bg-slate-900/60 px-2.5 text-xs text-slate-400 hover:border-slate-700 hover:text-slate-200 transition-colors shadow-sm"
            >
              <Search className="size-3.5" />
              <span className="flex-1 text-left">Search diagrams or commands...</span>
              <kbd className="pointer-events-none inline-flex h-4 select-none items-center gap-0.5 rounded border border-slate-700 bg-slate-800 px-1 font-mono text-[9px] font-medium text-slate-400">
                <span>⌘</span>K
              </kbd>
            </button>

            <div className="hidden sm:flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-blue-950/50 border border-blue-800/40 text-blue-400 font-medium">
              <Sparkles className="size-3" /> AI Active
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-900"
              title="Notifications"
            >
              <Bell className="size-4" />
            </Button>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </SidebarInset>

      {/* Official shadcn CommandDialog */}
      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <CommandInput placeholder="Type a command or search diagrams..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigation">
            <CommandItem
              onSelect={() => {
                router.push('/dashboard');
                setCommandOpen(false);
              }}
            >
              <LayoutDashboard className="mr-2 size-4 text-blue-400" />
              <span>Overview Dashboard</span>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                router.push('/dashboard/workspaces');
                setCommandOpen(false);
              }}
            >
              <Users className="mr-2 size-4 text-emerald-400" />
              <span>Manage Team Members & Roles</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Projects">
            {projects.map((proj) => (
              <CommandItem
                key={proj.id}
                onSelect={() => {
                  router.push(`/dashboard?project=${proj.id}`);
                  setCommandOpen(false);
                }}
              >
                <FolderKanban className="mr-2 size-4 text-slate-400" />
                <span>{proj.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </SidebarProvider>
  );
}
