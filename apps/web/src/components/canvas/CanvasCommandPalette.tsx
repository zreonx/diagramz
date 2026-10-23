'use client';

import React from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Wand2,
  Boxes,
  Code2,
  Sparkles,
  Server,
  Database,
  Globe,
  Cpu,
  Layers,
  Table,
  Columns2,
  FileText,
  Palette,
  Square,
  Circle,
  Diamond,
  Cloud,
  Type,
} from 'lucide-react';
import type { ZCanvasDragItem } from '@/lib/zcanvaskit';

interface CanvasCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsertItem: (item: ZCanvasDragItem) => void;
  onBeautifyLayout: () => void;
  onTogglePanel: (mode: 'none' | 'mermaid' | 'ai' | 'library') => void;
  onSetViewMode: (mode: 'both' | 'doc' | 'canvas') => void;
}

export function CanvasCommandPalette({
  open,
  onOpenChange,
  onInsertItem,
  onBeautifyLayout,
  onTogglePanel,
  onSetViewMode,
}: CanvasCommandPaletteProps) {
  const handleSelect = (callback: () => void) => {
    callback();
    onOpenChange(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search stencils & shapes..." />
      <CommandList className="max-h-[360px]">
        <CommandEmpty>No results found.</CommandEmpty>

        {/* ── Actions ── */}
        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={() =>
              handleSelect(() => {
                onBeautifyLayout();
              })
            }
          >
            <Wand2 className="mr-2 h-4 w-4 text-amber-500" />
            <span>Auto-Layout & Beautify Diagram</span>
          </CommandItem>

          <CommandItem
            onSelect={() =>
              handleSelect(() => {
                onTogglePanel('library');
              })
            }
          >
            <Boxes className="mr-2 h-4 w-4 text-blue-500" />
            <span>Open Component Libraries Panel</span>
          </CommandItem>

          <CommandItem
            onSelect={() =>
              handleSelect(() => {
                onTogglePanel('ai');
              })
            }
          >
            <Sparkles className="mr-2 h-4 w-4 text-purple-500" />
            <span>Open AI Architect Assistant</span>
          </CommandItem>

          <CommandItem
            onSelect={() =>
              handleSelect(() => {
                onTogglePanel('mermaid');
              })
            }
          >
            <Code2 className="mr-2 h-4 w-4 text-emerald-500" />
            <span>Open Mermaid Code Editor</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* ── View Modes ── */}
        <CommandGroup heading="View Layout">
          <CommandItem onSelect={() => handleSelect(() => onSetViewMode('canvas'))}>
            <Palette className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Canvas View (Full-Screen Workspace)</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(() => onSetViewMode('both'))}>
            <Columns2 className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Split View (Document Notes + Canvas)</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(() => onSetViewMode('doc'))}>
            <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Document Only View</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* ── Architecture Stencils ── */}
        <CommandGroup heading="Architecture Components">
          <CommandItem
            onSelect={() =>
              handleSelect(() =>
                onInsertItem({
                  kind: 'stencil',
                  stencilId: 'arch-api-gateway',
                })
              )
            }
          >
            <Globe className="mr-2 h-4 w-4 text-indigo-500" />
            <span>API Gateway</span>
          </CommandItem>

          <CommandItem
            onSelect={() =>
              handleSelect(() =>
                onInsertItem({
                  kind: 'stencil',
                  stencilId: 'arch-server',
                })
              )
            }
          >
            <Server className="mr-2 h-4 w-4 text-blue-500" />
            <span>Microservice / Server</span>
          </CommandItem>

          <CommandItem
            onSelect={() =>
              handleSelect(() =>
                onInsertItem({
                  kind: 'stencil',
                  stencilId: 'arch-client',
                })
              )
            }
          >
            <Cpu className="mr-2 h-4 w-4 text-cyan-500" />
            <span>Client Web Application</span>
          </CommandItem>

          <CommandItem
            onSelect={() =>
              handleSelect(() =>
                onInsertItem({
                  kind: 'stencil',
                  stencilId: 'tech-postgresql',
                })
              )
            }
          >
            <Database className="mr-2 h-4 w-4 text-sky-500" />
            <span>PostgreSQL Database</span>
          </CommandItem>

          <CommandItem
            onSelect={() =>
              handleSelect(() =>
                onInsertItem({
                  kind: 'stencil',
                  stencilId: 'tech-redis',
                })
              )
            }
          >
            <Layers className="mr-2 h-4 w-4 text-red-500" />
            <span>Redis Cache</span>
          </CommandItem>

          <CommandItem
            onSelect={() =>
              handleSelect(() =>
                onInsertItem({
                  kind: 'stencil',
                  stencilId: 'tech-kafka',
                })
              )
            }
          >
            <Layers className="mr-2 h-4 w-4 text-orange-500" />
            <span>Kafka Message Broker</span>
          </CommandItem>

          <CommandItem
            onSelect={() =>
              handleSelect(() =>
                onInsertItem({
                  kind: 'tool',
                  tool: 'container',
                  width: 440,
                  height: 320,
                })
              )
            }
          >
            <Square className="mr-2 h-4 w-4 text-emerald-500" />
            <span>VPC / Boundary Container</span>
          </CommandItem>

          <CommandItem
            onSelect={() =>
              handleSelect(() =>
                onInsertItem({
                  kind: 'tool',
                  tool: 'table',
                  width: 260,
                  height: 180,
                })
              )
            }
          >
            <Table className="mr-2 h-4 w-4 text-amber-500" />
            <span>Database Table (ERD)</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* ── Shapes ── */}
        <CommandGroup heading="Basic Shapes">
          <CommandItem
            onSelect={() =>
              handleSelect(() =>
                onInsertItem({
                  kind: 'tool',
                  tool: 'rectangle',
                })
              )
            }
          >
            <Square className="mr-2 h-4 w-4" />
            <span>Rectangle</span>
          </CommandItem>

          <CommandItem
            onSelect={() =>
              handleSelect(() =>
                onInsertItem({
                  kind: 'tool',
                  tool: 'circle',
                })
              )
            }
          >
            <Circle className="mr-2 h-4 w-4" />
            <span>Circle</span>
          </CommandItem>

          <CommandItem
            onSelect={() =>
              handleSelect(() =>
                onInsertItem({
                  kind: 'tool',
                  tool: 'diamond',
                })
              )
            }
          >
            <Diamond className="mr-2 h-4 w-4" />
            <span>Diamond (Decision)</span>
          </CommandItem>

          <CommandItem
            onSelect={() =>
              handleSelect(() =>
                onInsertItem({
                  kind: 'tool',
                  tool: 'cylinder',
                })
              )
            }
          >
            <Database className="mr-2 h-4 w-4" />
            <span>Cylinder (Storage)</span>
          </CommandItem>

          <CommandItem
            onSelect={() =>
              handleSelect(() =>
                onInsertItem({
                  kind: 'tool',
                  tool: 'cloud',
                })
              )
            }
          >
            <Cloud className="mr-2 h-4 w-4" />
            <span>Cloud</span>
          </CommandItem>

          <CommandItem
            onSelect={() =>
              handleSelect(() =>
                onInsertItem({
                  kind: 'tool',
                  tool: 'text',
                })
              )
            }
          >
            <Type className="mr-2 h-4 w-4" />
            <span>Text Block</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
