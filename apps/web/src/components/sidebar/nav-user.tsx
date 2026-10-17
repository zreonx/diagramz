'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  BadgeCheck,
  Bell,
  ChevronsUpDown,
  LogOut,
  Sun,
  Moon,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
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
import { useTheme } from '@/hooks/use-theme';

interface NavUserProps {
  user: {
    id?: string;
    name?: string;
    email?: string;
    avatarUrl?: string | null;
  } | null;
  onLogout: () => void;
}

export function NavUser({ user, onLogout }: NavUserProps) {
  const { isMobile } = useSidebar();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const userInitial = user?.name ? user.name.substring(0, 2).toUpperCase() : 'DZ';

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user?.avatarUrl || ''} alt={user?.name || ''} />
                <AvatarFallback className="rounded-lg">{userInitial}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{user?.name || 'User'}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {user?.email || ''}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 p-1.5 rounded-xl shadow-lg border border-border/70 bg-popover"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2.5 px-2 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user?.avatarUrl || ''} alt={user?.name || ''} />
                  <AvatarFallback className="rounded-lg">{userInitial}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{user?.name || 'User'}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user?.email || ''}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem className="cursor-pointer" onClick={() => router.push('/dashboard/settings')}>
                <BadgeCheck className="size-4" />
                Account Settings
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onClick={() => router.push('/dashboard/settings/notifications')}>
                <Bell className="size-4" />
                Notifications
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onClick={toggleTheme}>
                {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
                {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive" onClick={onLogout}>
              <LogOut className="size-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
