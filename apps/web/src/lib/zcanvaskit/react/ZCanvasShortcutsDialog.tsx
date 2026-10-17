'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ZCANVAS_SHORTCUTS } from '../core/shortcuts';
import { Keyboard, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ZCanvasShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CATEGORIES = [
  'All',
  'Tools',
  'Editing',
  'Movement & Selection',
  'Navigation',
  'General',
] as const;

export function ZCanvasShortcutsDialog({
  open,
  onOpenChange,
}: ZCanvasShortcutsDialogProps) {
  const [activeTab, setActiveTab] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const isMac =
    typeof window !== 'undefined' &&
    navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  const filteredShortcuts = ZCANVAS_SHORTCUTS.filter((s) => {
    const matchesTab = activeTab === 'All' || s.category === activeTab;
    const matchesSearch =
      searchQuery.trim() === '' ||
      s.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.keys.some((k) => k.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesTab && matchesSearch;
  });

  // Group by category when displaying
  const activeCategories =
    activeTab === 'All'
      ? (['Tools', 'Editing', 'Movement & Selection', 'Navigation', 'General'] as const)
      : [activeTab as typeof CATEGORIES[number]];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-2xl border border-border bg-card/95 backdrop-blur-2xl text-foreground shadow-2xl">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-border/70 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
                <Keyboard className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
                  <span>Keyboard Shortcuts</span>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono border-border text-muted-foreground bg-muted/40 font-normal"
                  >
                    zcanvaskit
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Full reference guide for fluid canvas navigation and rapid drafting.
                </DialogDescription>
              </div>
            </div>
          </div>

          {/* Search bar & filter pills */}
          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search shortcuts (e.g. duplicate, zoom, V, pan)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-8.5 pl-8 pr-3 bg-background/80 border border-border/80 rounded-xl text-xs placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
            </div>
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveTab(cat)}
                  className={cn(
                    'h-7 px-2.5 text-[11px] font-medium rounded-lg transition-all shrink-0 cursor-pointer select-none',
                    activeTab === cat
                      ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </DialogHeader>

        {/* Content list. Scrolling works the same way as the settings dialog:
            the body is the only flexible row in a fixed-height column, so it
            scrolls inside the dialog instead of growing past it. */}
        <div
          className={cn(
            'flex-1 min-h-0 overflow-y-auto overscroll-contain p-6 space-y-6',
            '[&::-webkit-scrollbar]:w-1.5',
            '[&::-webkit-scrollbar-track]:bg-transparent',
            '[&::-webkit-scrollbar-thumb]:rounded-full',
            '[&::-webkit-scrollbar-thumb]:bg-border/60',
            'hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/30'
          )}
        >
          {filteredShortcuts.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-xs">
              No shortcuts found matching &ldquo;{searchQuery}&rdquo;
            </div>
          ) : (
            activeCategories.map((cat) => {
              const items = filteredShortcuts.filter((s) => s.category === cat);
              if (items.length === 0) return null;

              return (
                <div key={cat} className="space-y-2.5">
                  <div className="flex items-center gap-2 px-1">
                    <span className="size-1.5 rounded-full bg-primary" />
                    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {cat}
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {items.map((shortcut) => (
                      <div
                        key={shortcut.id}
                        className="group flex items-center justify-between p-2.5 rounded-xl bg-surface-secondary/40 hover:bg-muted/60 border border-border/60 transition-all shadow-2xs hover:border-border"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">
                            {shortcut.label}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                            {shortcut.description}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {shortcut.keys.map((k, idx) => {
                            let displayKey = k;
                            if (k === 'Ctrl' && isMac) displayKey = '⌘';
                            if (k === 'Shift' && isMac) displayKey = '⇧';

                            return (
                              <kbd
                                key={idx}
                                className="px-2 py-0.5 min-w-[22px] text-center text-[11px] font-mono font-medium rounded-md bg-background border border-border text-foreground/90 shadow-2xs group-hover:border-primary/40 transition-colors"
                              >
                                {displayKey}
                              </kbd>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info pill */}
        <div className="p-3 px-6 bg-muted/30 border-t border-border/70 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Tip: Press <kbd className="px-1.5 py-0.5 rounded bg-background border border-border font-mono text-[10px]">?</kbd> anywhere to toggle this menu</span>
          <span className="font-mono text-[10px]">{filteredShortcuts.length} shortcuts</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
