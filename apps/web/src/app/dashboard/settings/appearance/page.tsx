'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';
import { Monitor, Moon, Sun, Check } from 'lucide-react';
import { toast } from 'sonner';

const themes = [
  { id: 'light', label: 'Light', icon: Sun, preview: 'bg-white border-gray-200' },
  { id: 'dark', label: 'Dark', icon: Moon, preview: 'bg-gray-950 border-gray-800' },
] as const;

const fontOptions = [
  { id: 'inter', label: 'Inter', sub: 'System default' },
  { id: 'mono', label: 'Mono', sub: 'Monospace variant' },
];

export default function AppearanceSettingsPage() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Appearance</h2>
        <p className="text-sm text-muted-foreground">Customize how Diagramz looks on your device.</p>
      </div>

      {/* Theme Selector */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div>
            <Label className="text-sm font-medium">Theme</Label>
            <p className="text-xs text-muted-foreground mt-0.5">Select the color theme for the interface.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => { setTheme(t.id); toast.success(`Switched to ${t.label} mode`); }}
                className={cn(
                  'relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all cursor-pointer',
                  theme === t.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/40 hover:bg-muted/50',
                )}
              >
                {theme === t.id && (
                  <div className="absolute top-2 right-2 size-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="size-3 text-primary-foreground" />
                  </div>
                )}
                {/* Mini preview */}
                <div className={cn('w-full h-16 rounded-lg border overflow-hidden', t.preview)}>
                  <div className="flex h-full">
                    <div className={cn('w-8 h-full', t.id === 'dark' ? 'bg-gray-900' : 'bg-gray-100')} />
                    <div className="flex-1 p-1.5 space-y-1">
                      <div className={cn('h-1.5 rounded-full w-3/4', t.id === 'dark' ? 'bg-gray-700' : 'bg-gray-200')} />
                      <div className={cn('h-1.5 rounded-full w-1/2', t.id === 'dark' ? 'bg-gray-700' : 'bg-gray-200')} />
                      <div className="h-3 rounded mt-1 bg-primary/40" />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <t.icon className="size-3.5" />
                  {t.label}
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Accent Color */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div>
            <Label className="text-sm font-medium">Accent Color</Label>
            <p className="text-xs text-muted-foreground mt-0.5">Applied to buttons, active states, and highlights.</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {[
              { name: 'Emerald', hex: '#2A835F', tw: 'bg-emerald-700' },
              { name: 'Violet', hex: '#7c3aed', tw: 'bg-violet-600' },
              { name: 'Blue', hex: '#2563eb', tw: 'bg-blue-600' },
              { name: 'Rose', hex: '#e11d48', tw: 'bg-rose-600' },
              { name: 'Amber', hex: '#d97706', tw: 'bg-amber-600' },
            ].map((c) => (
              <button
                key={c.name}
                title={c.name}
                onClick={() => toast.info(`${c.name} accent coming soon`)}
                className={cn(
                  'size-7 rounded-full border-2 transition-transform hover:scale-110',
                  c.tw,
                  c.name === 'Emerald' ? 'border-primary ring-2 ring-primary ring-offset-2 ring-offset-background' : 'border-transparent',
                )}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Font */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div>
            <Label className="text-sm font-medium">Font</Label>
            <p className="text-xs text-muted-foreground mt-0.5">Interface font preference.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {fontOptions.map((f) => (
              <button
                key={f.id}
                onClick={() => toast.info('Font selection coming soon')}
                className={cn(
                  'p-3 rounded-lg border text-left transition-all',
                  f.id === 'inter'
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border hover:bg-muted',
                )}
              >
                <div className="text-sm font-medium">{f.label}</div>
                <div className="text-xs text-muted-foreground">{f.sub}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
