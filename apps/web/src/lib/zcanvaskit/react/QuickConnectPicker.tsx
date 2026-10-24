'use client';

import React, { useEffect } from 'react';
import { Square, Diamond, Table2, Layers, Circle, Type, Copy, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ZCanvasNodeType, ZCanvasPoint } from '../core/schema';

export interface QuickConnectOption {
  id: string;
  type: ZCanvasNodeType;
  label: string;
  shortcut: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

export const QUICK_CONNECT_OPTIONS: QuickConnectOption[] = [
  {
    id: 'clone',
    type: 'card',
    label: 'Clone Source',
    shortcut: '1',
    icon: Copy,
    description: 'Duplicate source shape with same styling',
  },
  {
    id: 'rectangle',
    type: 'rectangle',
    label: 'Step',
    shortcut: '2',
    icon: Square,
    description: 'Process step or action block',
  },
  {
    id: 'diamond',
    type: 'diamond',
    label: 'Decision',
    shortcut: '3',
    icon: Diamond,
    description: 'Branch or decision logic',
  },
  {
    id: 'card',
    type: 'card',
    label: 'Service Card',
    shortcut: '4',
    icon: Layers,
    description: 'Microservice, API, or worker',
  },
  {
    id: 'table',
    type: 'table',
    label: 'Database Table',
    shortcut: '5',
    icon: Table2,
    description: 'ERD entity with column schema',
  },
  {
    id: 'circle',
    type: 'circle',
    label: 'State / Event',
    shortcut: '6',
    icon: Circle,
    description: 'Start/end state or event trigger',
  },
  {
    id: 'text',
    type: 'text',
    label: 'Text Note',
    shortcut: '7',
    icon: Type,
    description: 'Freeform text annotation',
  },
];

interface QuickConnectPickerProps {
  position: ZCanvasPoint;
  zoom: number;
  onSelect: (option: QuickConnectOption) => void;
  onClose: () => void;
}

export function QuickConnectPicker({
  position,
  zoom,
  onSelect,
  onClose,
}: QuickConnectPickerProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      const option = QUICK_CONNECT_OPTIONS.find((opt) => opt.shortcut === e.key);
      if (option) {
        e.preventDefault();
        onSelect(option);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSelect, onClose]);

  return (
    <div
      data-testid="quick-connect-picker"
      role="dialog"
      aria-label="Quick Connect Shape Picker"
      className="absolute z-50 pointer-events-auto -translate-x-1/2 -translate-y-1/2 animate-in fade-in-50 zoom-in-95 duration-150"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: `translate(-50%, -50%) scale(${1 / Math.min(Math.max(zoom, 0.6), 1.4)})`,
        transformOrigin: 'center center',
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="w-56 p-2 rounded-2xl border border-border/80 bg-card/95 backdrop-blur-2xl shadow-2xl space-y-1.5 select-none">
        <div className="flex items-center justify-between px-1.5 pb-1 border-b border-border/50">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Connect to
          </span>
          <button
            type="button"
            onClick={onClose}
            className="w-4 h-4 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            title="Cancel (Esc)"
          >
            <X className="w-3 h-3" />
          </button>
        </div>

        <div className="space-y-0.5">
          {QUICK_CONNECT_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onSelect(opt)}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-primary/10 text-foreground hover:text-primary transition-colors text-left group cursor-pointer"
                title={opt.description}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-md bg-muted/60 flex items-center justify-center group-hover:bg-primary/15 transition-colors shrink-0">
                    <Icon className="w-3.5 h-3.5 text-foreground/80 group-hover:text-primary transition-colors" />
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-medium leading-none">{opt.label}</div>
                  </div>
                </div>
                <kbd className="px-1.5 py-0.5 text-[9px] font-mono text-muted-foreground bg-muted/50 rounded border border-border/60 group-hover:border-primary/40 group-hover:text-primary">
                  {opt.shortcut}
                </kbd>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
