'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Users, Settings as SettingsIcon, Sparkles } from 'lucide-react';
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';

interface NavMainProps {
  workspaceCount?: number;
  diagramCount?: number;
}

export function NavMain({ workspaceCount, diagramCount }: NavMainProps) {
  const pathname = usePathname();

  const isAllFiles = pathname === '/dashboard';
  const isWorkspaces = pathname.startsWith('/dashboard/workspaces');
  const isSettings = pathname.startsWith('/dashboard/settings');

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-2 mb-1">
        Navigation
      </SidebarGroupLabel>
      <SidebarMenu>
        {/* All Files / Diagrams */}
        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            isActive={isAllFiles}
            tooltip="All Files (A)"
          >
            <Link href="/dashboard" className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <LayoutGrid className="size-4 shrink-0" />
                <span className="font-medium text-xs">All Files</span>
              </div>
              <div className="flex items-center gap-1.5">
                {typeof diagramCount === 'number' && diagramCount > 0 && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {diagramCount}
                  </span>
                )}
                <kbd className="hidden sm:inline-block text-[10px] font-mono text-muted-foreground/60">A</kbd>
              </div>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>

        {/* Workspaces & Team */}
        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            isActive={isWorkspaces}
            tooltip="Workspaces & Team"
          >
            <Link href="/dashboard/workspaces" className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Users className="size-4 shrink-0" />
                <span className="font-medium text-xs">Workspaces & Team</span>
              </div>
              {typeof workspaceCount === 'number' && workspaceCount > 1 && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {workspaceCount}
                </span>
              )}
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>

        {/* Settings */}
        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            isActive={isSettings}
            tooltip="Settings"
          >
            <Link href="/dashboard/settings" className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <SettingsIcon className="size-4 shrink-0" />
                <span className="font-medium text-xs">Settings</span>
              </div>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
}
