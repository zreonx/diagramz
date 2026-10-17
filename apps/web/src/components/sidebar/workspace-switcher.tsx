'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ChevronsUpDown, Plus, Command, Check, Settings, Users } from 'lucide-react';
import { WorkspaceSummary } from '@diagramz/shared';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

interface WorkspaceSwitcherProps {
  workspaces: WorkspaceSummary[];
  activeWorkspace: WorkspaceSummary | null;
  onSelectWorkspace: (workspace: WorkspaceSummary) => void;
}

export function WorkspaceSwitcher({
  workspaces,
  activeWorkspace,
  onSelectWorkspace,
}: WorkspaceSwitcherProps) {
  const { isMobile } = useSidebar();
  const router = useRouter();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground cursor-pointer transition-colors"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-semibold text-xs shadow-2xs">
                {activeWorkspace?.name ? (
                  activeWorkspace.name.substring(0, 2).toUpperCase()
                ) : (
                  <Command className="size-4" />
                )}
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold text-foreground">
                  {activeWorkspace?.name || 'Workspace'}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {activeWorkspace?.role === 'owner' ? 'Owner' : 'Member'}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4 text-muted-foreground/70" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-64 p-1.5 rounded-xl shadow-lg border border-border/70 bg-popover text-popover-foreground"
            align="start"
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={6}
          >
            <DropdownMenuLabel className="px-2.5 py-1.5 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70">
              Workspaces
            </DropdownMenuLabel>

            <div className="space-y-0.5">
              {workspaces.map((ws) => {
                const isActive = activeWorkspace?.id === ws.id;
                return (
                  <DropdownMenuItem
                    key={ws.id}
                    onClick={() => onSelectWorkspace(ws)}
                    className={cn(
                      'flex items-center gap-3 px-2.5 py-2 rounded-lg cursor-pointer transition-colors',
                      isActive
                        ? 'bg-accent/80 text-accent-foreground font-medium'
                        : 'hover:bg-muted/70 text-foreground'
                    )}
                  >
                    <div
                      className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-lg border font-semibold text-xs transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground border-primary shadow-2xs'
                          : 'bg-muted/60 text-muted-foreground border-border/60'
                      )}
                    >
                      {ws.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1 leading-tight">
                      <span className="truncate text-sm font-medium">{ws.name}</span>
                      <span className="text-[11px] text-muted-foreground truncate">
                        {ws.role === 'owner' ? 'Owner' : 'Member'}
                      </span>
                    </div>
                    {isActive && (
                      <Check className="size-4 text-primary shrink-0 ml-1.5 stroke-[2.5]" />
                    )}
                  </DropdownMenuItem>
                );
              })}
            </div>

            <DropdownMenuSeparator className="my-1.5 bg-border/50" />

            <div className="space-y-0.5">
              <DropdownMenuItem
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
                onClick={() => router.push('/dashboard/workspaces')}
              >
                <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/40">
                  <Settings className="size-3.5" />
                </div>
                <span className="text-xs font-medium">Workspace Settings</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
                onClick={() => router.push('/dashboard/workspaces')}
              >
                <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/40">
                  <Plus className="size-3.5" />
                </div>
                <span className="text-xs font-medium">Create Workspace</span>
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
