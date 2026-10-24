'use client';

import React from 'react';
import {
  MousePointer,
  Hand,
  Square,
  Circle,
  Triangle,
  Diamond,
  Type,
  Pencil,
  Minus,
  ArrowRight,
  Eraser,
  Undo2,
  Redo2,
  Download,
  Keyboard,
  GripVertical,
  Sliders,
  MoreHorizontal,
  Frame,
  ChevronDown,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { ZCanvasTool, ZCanvasEdgeRouting } from '../core/schema';
import { writeDragItem, type ZCanvasToolName } from '../stencils';
import { FRAME_PRESETS, type ZCanvasFramePreset } from '../core/boundaries';

export interface ZCanvasToolbarProps {
  activeTool: ZCanvasTool;
  onSelectTool: (tool: ZCanvasTool) => void;
  onPlaceFramePreset?: (preset: ZCanvasFramePreset) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onExportSvg?: () => void;
  onExportPng?: () => void;
  onOpenShortcuts?: () => void;
  onOpenSettings?: () => void;
  edgeRouting?: ZCanvasEdgeRouting;
  onToggleEdgeRouting?: (routing: ZCanvasEdgeRouting) => void;
}

export function ZCanvasToolbar({
  activeTool,
  onSelectTool,
  onPlaceFramePreset,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  onExportSvg,
  onExportPng,
  onOpenShortcuts,
  onOpenSettings,
  edgeRouting = 'bezier',
  onToggleEdgeRouting,
}: ZCanvasToolbarProps) {
  const toolbarRef = React.useRef<HTMLDivElement>(null);
  const [position, setPosition] = React.useState<{ x?: number; y?: number }>({});
  const [isDraggingToolbar, setIsDraggingToolbar] = React.useState(false);
  const dragStartRef = React.useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
  });

  const handleGripMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!toolbarRef.current) return;
    const rect = toolbarRef.current.getBoundingClientRect();
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: rect.left,
      startY: rect.top,
    };
    setIsDraggingToolbar(true);
  };

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingToolbar) return;
      e.stopPropagation();
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;
      setPosition({
        x: Math.max(10, Math.min(window.innerWidth - 300, dragStartRef.current.startX + dx)),
        y: Math.max(10, Math.min(window.innerHeight - 80, dragStartRef.current.startY + dy)),
      });
    };
    const handleMouseUp = (e: MouseEvent) => {
      e.stopPropagation();
      setIsDraggingToolbar(false);
    };
    if (isDraggingToolbar) {
      window.addEventListener('mousemove', handleMouseMove, true);
      window.addEventListener('mouseup', handleMouseUp, true);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove, true);
      window.removeEventListener('mouseup', handleMouseUp, true);
    };
  }, [isDraggingToolbar]);

  /**
   * Starts a drag carrying a tool.
   *
   * The payload is written through the engine's one writer, so the canvas's
   * `dragover` guard recognises it without either side naming a mimetype.
   */
  const handleDragStartItem = (e: React.DragEvent, itemType: ZCanvasToolName) => {
    writeDragItem(e.dataTransfer, { kind: 'tool', tool: itemType });
  };

  const isCustomPos = position.x !== undefined && position.y !== undefined;

  return (
    <div
      ref={toolbarRef}
      style={isCustomPos ? { left: `${position.x}px`, top: `${position.y}px`, transform: 'none' } : undefined}
      // A press on the toolbar is not a press on the canvas, so the press and
      // the click stay here. The release does not: it belongs to the drag that
      // is already in flight, and a drag let go over the toolbar is over. The
      // toolbar floats above the canvas, so swallowing the release is what used
      // to leave a dragged component stuck to the pointer until the next click.
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      className={cn(
        'absolute z-30 max-w-[calc(100%-1.5rem)] overflow-x-auto no-scrollbar flex items-center gap-1.5 p-1.5 bg-card/95 backdrop-blur-md border border-border shadow-xl rounded-2xl transition-shadow duration-150 select-none text-foreground',
        !isCustomPos && 'top-4 left-1/2 -translate-x-1/2',
        isDraggingToolbar && 'shadow-primary/20 ring-1 ring-primary/50'
      )}
    >
      {/* Draggable Grip Handle (Reposition Toolbar) */}
      <div
        onMouseDown={handleGripMouseDown}
        className="cursor-grab active:cursor-grabbing p-1.5 rounded-lg text-foreground/70 hover:text-foreground hover:bg-muted transition-colors flex items-center justify-center shrink-0"
        title="Drag to reposition toolbar anywhere"
      >
        <GripVertical className="w-4 h-4 text-foreground/80 dark:text-muted-foreground" />
      </div>

      {/* Primary Selection & Canvas Navigation */}
      <div className="flex items-center gap-1 pr-1.5 border-r border-border">
        <Button
          variant={activeTool === 'select' ? 'default' : 'ghost'}
          size="sm"
          className={cn(
            'h-9 w-9 p-0 rounded-xl transition-all cursor-pointer',
            activeTool === 'select'
              ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
              : 'text-foreground hover:text-foreground hover:bg-muted'
          )}
          onClick={() => onSelectTool('select')}
          title="Select & Marquee Box Select (V)"
        >
          <MousePointer className="w-4 h-4" />
        </Button>

        <Button
          variant={activeTool === 'hand' ? 'default' : 'ghost'}
          size="sm"
          className={cn(
            'h-9 w-9 p-0 rounded-xl transition-all cursor-pointer',
            activeTool === 'hand'
              ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
              : 'text-foreground hover:text-foreground hover:bg-muted'
          )}
          onClick={() => onSelectTool('hand')}
          title="Hand / Pan Canvas (H)"
        >
          <Hand className={cn('w-4 h-4', activeTool === 'hand' ? 'text-primary-foreground' : 'text-foreground')} />
        </Button>

        {/* Frame / Artboard Tool with Presets */}
        <DropdownMenu>
          <div className="flex items-center">
            <Button
              variant={activeTool === 'frame' ? 'default' : 'ghost'}
              size="sm"
              draggable
              onDragStart={(e) => handleDragStartItem(e, 'frame')}
              className={cn(
                'h-9 w-9 p-0 rounded-xl transition-all cursor-pointer',
                activeTool === 'frame'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-foreground/90 hover:text-foreground hover:bg-muted'
              )}
              onClick={() => onSelectTool('frame')}
              title="Frame Tool (F) - Drag to draw or click for presets"
            >
              <Frame className="w-4 h-4" />
            </Button>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-3.5 p-0 -ml-1 text-muted-foreground hover:text-foreground hover:bg-muted/70 rounded-r-lg"
                title="Frame Presets (Desktop, Mobile, 16:9, A4)"
              >
                <ChevronDown className="w-2.5 h-2.5" />
              </Button>
            </DropdownMenuTrigger>
          </div>
          <DropdownMenuContent align="start" className="w-56">
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Frame Presets
            </div>
            {FRAME_PRESETS.map((preset) => (
              <DropdownMenuItem
                key={preset.id}
                onSelect={() => {
                  if (onPlaceFramePreset) {
                    onPlaceFramePreset(preset);
                  } else {
                    onSelectTool('frame');
                  }
                }}
                className="cursor-pointer justify-between text-xs"
              >
                <span>{preset.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Shapes & TLDraw Style Freehand Inks (Click or Drag & Drop onto Canvas) */}
      <div className="flex items-center gap-1 pr-1.5 border-r border-border">
        <Button
          variant={activeTool === 'rectangle' ? 'default' : 'ghost'}
          size="sm"
          draggable
          onDragStart={(e) => handleDragStartItem(e, 'rectangle')}
          className={cn(
            'h-9 w-9 p-0 rounded-xl transition-all cursor-pointer',
            activeTool === 'rectangle'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-foreground/90 hover:text-foreground hover:bg-muted'
          )}
          onClick={() => onSelectTool('rectangle')}
          title="Rectangle Tool (R) - Click to draw or Drag & Drop onto canvas"
        >
          <Square className="w-4 h-4" />
        </Button>

        <Button
          variant={activeTool === 'circle' ? 'default' : 'ghost'}
          size="sm"
          draggable
          onDragStart={(e) => handleDragStartItem(e, 'circle')}
          className={cn(
            'h-9 w-9 p-0 rounded-xl transition-all cursor-pointer',
            activeTool === 'circle'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-foreground/90 hover:text-foreground hover:bg-muted'
          )}
          onClick={() => onSelectTool('circle')}
          title="Circle / Ellipse Tool (O) - Click to draw or Drag & Drop onto canvas"
        >
          <Circle className="w-4 h-4" />
        </Button>

        <Button
          variant={activeTool === 'diamond' ? 'default' : 'ghost'}
          size="sm"
          draggable
          onDragStart={(e) => handleDragStartItem(e, 'diamond')}
          className={cn(
            'h-9 w-9 p-0 rounded-xl transition-all cursor-pointer',
            activeTool === 'diamond'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-foreground/90 hover:text-foreground hover:bg-muted'
          )}
          onClick={() => onSelectTool('diamond')}
          title="Decision Diamond Tool (D) - Click to draw or Drag & Drop onto canvas"
        >
          <Diamond className="w-4 h-4" />
        </Button>

        <Button
          variant={activeTool === 'triangle' ? 'default' : 'ghost'}
          size="sm"
          draggable
          onDragStart={(e) => handleDragStartItem(e, 'triangle')}
          className={cn(
            'h-9 w-9 p-0 rounded-xl transition-all cursor-pointer',
            activeTool === 'triangle'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-foreground/90 hover:text-foreground hover:bg-muted'
          )}
          onClick={() => onSelectTool('triangle')}
          title="Triangle Tool - Click to draw or Drag & Drop onto canvas"
        >
          <Triangle className="w-4 h-4" />
        </Button>

        <Button
          variant={activeTool === 'text' ? 'default' : 'ghost'}
          size="sm"
          draggable
          onDragStart={(e) => handleDragStartItem(e, 'text')}
          className={cn(
            'h-9 w-9 p-0 rounded-xl transition-all cursor-pointer',
            activeTool === 'text'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-foreground/90 hover:text-foreground hover:bg-muted'
          )}
          onClick={() => onSelectTool('text')}
          title="Floating Text Tool (T) - Click to draw or Drag & Drop onto canvas"
        >
          <Type className="w-4 h-4" />
        </Button>

        <Button
          variant={activeTool === 'line' ? 'default' : 'ghost'}
          size="sm"
          className={cn(
            'h-9 w-9 p-0 rounded-xl transition-all cursor-pointer',
            activeTool === 'line'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-foreground/90 hover:text-foreground hover:bg-muted'
          )}
          onClick={() => onSelectTool('line')}
          title="Line Tool (L) - Click and drag to draw a straight line"
        >
          <Minus className="w-4 h-4" />
        </Button>

        <Button
          variant={activeTool === 'arrow' ? 'default' : 'ghost'}
          size="sm"
          className={cn(
            'h-9 w-9 p-0 rounded-xl transition-all cursor-pointer',
            activeTool === 'arrow'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-foreground/90 hover:text-foreground hover:bg-muted'
          )}
          onClick={() => onSelectTool('arrow')}
          title="Arrow Tool (A) - Click and drag to draw a directional arrow"
        >
          <ArrowRight className="w-4 h-4" />
        </Button>

        <Button
          variant={activeTool === 'pen' ? 'default' : 'ghost'}
          size="sm"
          className={cn(
            'h-9 w-9 p-0 rounded-xl transition-all cursor-pointer',
            activeTool === 'pen'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-foreground/90 hover:text-foreground hover:bg-muted'
          )}
          onClick={() => onSelectTool('pen')}
          title="Freehand Ink Drawing (P - TLDraw style)"
        >
          <Pencil className="w-4 h-4" />
        </Button>

        <Button
          variant={activeTool === 'eraser' ? 'default' : 'ghost'}
          size="sm"
          className={cn(
            'h-9 w-9 p-0 rounded-xl transition-all cursor-pointer',
            activeTool === 'eraser'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-foreground/90 hover:text-foreground hover:bg-muted'
          )}
          onClick={() => onSelectTool('eraser')}
          title="Eraser Tool (E) - Click or drag to erase strokes & shapes"
        >
          <Eraser className="w-4 h-4" />
        </Button>
      </div>

      {/* Overflow: history, exports, canvas settings and the shortcut reference
          live behind one menu rather than as a row of buttons, so the toolbar
          stays about drawing tools. */}
      {(canUndo || canRedo || onExportSvg || onExportPng || onOpenSettings || onOpenShortcuts || onToggleEdgeRouting) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              data-testid="canvas-toolbar-more-menu"
              className="h-9 w-9 p-0 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/70 cursor-pointer"
              title="More actions"
              aria-label="More actions"
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuItem disabled={!canUndo} onSelect={onUndo}>
              <Undo2 className="w-3.5 h-3.5" />
              Undo
              <ShortcutHint>Ctrl+Z</ShortcutHint>
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!canRedo} onSelect={onRedo}>
              <Redo2 className="w-3.5 h-3.5" />
              Redo
              <ShortcutHint>Ctrl+Y</ShortcutHint>
            </DropdownMenuItem>

            {onToggleEdgeRouting && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
                  Line Connector Style
                </DropdownMenuLabel>
                <DropdownMenuItem
                  data-testid="menu-toggle-curved"
                  onSelect={() => onToggleEdgeRouting('bezier')}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-3.5 h-3.5 text-primary"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                    >
                      <path d="M4 19C4 11 11 4 20 4" />
                      <circle cx="4" cy="19" r="2.5" fill="currentColor" stroke="none" />
                      <circle cx="20" cy="4" r="2.5" fill="currentColor" stroke="none" />
                    </svg>
                    <span>Curved (Bezier)</span>
                  </div>
                  {edgeRouting === 'bezier' && <Check className="w-3.5 h-3.5 text-primary" />}
                </DropdownMenuItem>

                <DropdownMenuItem
                  data-testid="menu-toggle-step"
                  onSelect={() => onToggleEdgeRouting('step')}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-3.5 h-3.5 text-primary"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M4 19V11H20V5" />
                      <circle cx="4" cy="19" r="2.5" fill="currentColor" stroke="none" />
                      <circle cx="20" cy="5" r="2.5" fill="currentColor" stroke="none" />
                    </svg>
                    <span>Orthogonal (Step)</span>
                  </div>
                  {edgeRouting === 'step' && <Check className="w-3.5 h-3.5 text-primary" />}
                </DropdownMenuItem>

                <DropdownMenuItem
                  data-testid="menu-toggle-straight"
                  onSelect={() => onToggleEdgeRouting('straight')}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Minus className="w-3.5 h-3.5 text-primary" />
                    <span>Straight (Direct)</span>
                  </div>
                  {edgeRouting === 'straight' && <Check className="w-3.5 h-3.5 text-primary" />}
                </DropdownMenuItem>
              </>
            )}

            <DropdownMenuSeparator />

            {onExportSvg && (
              <DropdownMenuItem onSelect={onExportSvg}>
                <Download className="w-3.5 h-3.5 text-primary" />
                Export as SVG
              </DropdownMenuItem>
            )}
            {onExportPng && (
              <DropdownMenuItem onSelect={onExportPng}>
                <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Export as PNG
              </DropdownMenuItem>
            )}

            {(onExportSvg || onExportPng) && (onOpenSettings || onOpenShortcuts) && (
              <DropdownMenuSeparator />
            )}

            {onOpenSettings && (
              <DropdownMenuItem onSelect={onOpenSettings}>
                <Sliders className="w-3.5 h-3.5 text-primary" />
                Canvas Settings
              </DropdownMenuItem>
            )}
            {onOpenShortcuts && (
              <DropdownMenuItem onSelect={onOpenShortcuts}>
                <Keyboard className="w-3.5 h-3.5" />
                Keyboard Shortcuts
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

/** Right-aligned keyboard hint inside an overflow-menu item. */
function ShortcutHint({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-auto pl-3 text-[10px] font-mono text-muted-foreground">{children}</span>
  );
}
