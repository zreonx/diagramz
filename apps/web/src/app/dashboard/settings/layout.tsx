'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  User,
  Palette,
  Bell,
  Shield,
  ChevronRight,
  Settings as SettingsIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

const settingsNav = [
  { href: '/dashboard/settings', label: 'Account', icon: User, desc: 'Manage your profile and preferences' },
  { href: '/dashboard/settings/appearance', label: 'Appearance', icon: Palette, desc: 'Theme, colors, and display options' },
  { href: '/dashboard/settings/notifications', label: 'Notifications', icon: Bell, desc: 'Email and in-app notification preferences' },
  { href: '/dashboard/settings/security', label: 'Security', icon: Shield, desc: 'Password, sessions, and security settings' },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your account settings and workspace preferences.
        </p>
      </div>

      <Separator className="mb-6" />

      <div className="flex flex-col md:flex-row gap-8">
        {/* Settings Sidebar Nav */}
        <aside className="w-full md:w-52 shrink-0">
          <nav className="flex flex-col gap-0.5">
            {settingsNav.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                  )}
                >
                  <item.icon className="size-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
