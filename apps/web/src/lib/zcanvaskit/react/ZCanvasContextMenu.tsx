'use client';

import React, { useEffect, useRef } from 'react';
import {
  Copy,
  Scissors,
  Clipboard,
  Trash2,
  Lock,
  Unlock,
  ChevronsUp,
  ChevronUp,
  ChevronDown,
  ChevronsDown,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Maximize2,
  Spline,
  GitCommit,
  ZoomIn,
  ZoomOut,
  Undo2,
  Redo2,
  RotateCw,
  RotateCcw,
  Group,
  Ungroup,
  Layers,
  Type,
  Plus,
  Frame,
  Download,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ZCanvasNode, ZCanvasEdge, ZCanvasDrawingStroke, hasEditableLabel, isGeometricShape } from '../core/schema';
import { allLocked } from '../core/locking';
import { QUARTER_TURN_DEGREES } from '../core/rotation';

export interface ContextMenuPosition {
  x: number;
  y: number;
}

export interface ZCanvasContextMenuProps {
  position: ContextMenuPosition | null;
  onClose: () => void;
  selectedNodes: ZCanvasNode[];
  selectedEdge: ZCanvasEdge | null;
  /** Freehand ink picked on the canvas, which the menu treats as an element. */
  selectedStrokes?: ZCanvasDrawingStroke[];
  canPaste: boolean;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onReorder: (direction: 'front' | 'forward' | 'backward' | 'back') => void;
  onToggleLock: () => void;
  onAlign?: (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
  onSelectAll: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomToFit: () => void;
  onResetZoom: () => void;
  /** Group the selection under one box / release it again. */
  onGroup?: () => void;
  onUngroup?: () => void;
  /** Frame the selection under an artboard / frame. */
  onFrameSelection?: () => void;
  /** Resize and snap frame to fit its enclosed content. */
  onFitFrameToContent?: (nodeId: string) => void;
  /** Export a specific frame. */
  onExportFrame?: (frame: ZCanvasNode, format: 'png' | 'svg') => void;
  /** Undo / redo, offered whatever is under the cursor. */
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onToggleEdgeStyle?: () => void;
  onResetEdgeLabel?: () => void;
  onResetLinePosition?: () => void;
  onResetEdgeAnchors?: () => void;
  onDetachEdge?: () => void;
  onStartEdit?: () => void;
  onAddField?: (nodeId: string) => void;
  onToggleBadge?: (nodeId: string) => void;
  /**
   * Turn the picked shapes by a step, in degrees clockwise. Offered on the
   * single-node and multi-selection sections alike, so a shape can be turned
   * without reaching for its grip.
   */
  onRotate?: (degrees: number) => void;
}

export function ZCanvasContextMenu({
  position,
  onClose,
  selectedNodes,
  selectedEdge,
  selectedStrokes = [],
  canPaste,
  onCopy,
  onCut,
  onPaste,
  onDuplicate,
  onDelete,
  onReorder,
  onToggleLock,
  onAlign,
  onSelectAll,
  onZoomIn,
  onZoomOut,
  onZoomToFit,
  onResetZoom,
  onGroup,
  onUngroup,
  onFrameSelection,
  onFitFrameToContent,
  onExportFrame,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onToggleEdgeStyle,
  onResetEdgeLabel,
  onResetLinePosition,
  onResetEdgeAnchors,
  onDetachEdge,
  onStartEdit,
  onAddField,
  onToggleBadge,
  onRotate,
}: ZCanvasContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (position) {
      window.addEventListener('mousedown', handleGlobalClick);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('mousedown', handleGlobalClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [position, onClose]);

  if (!position) return null;

  // Viewport clamping. The height is a conservative estimate of the tallest
  // section (history + a single node's full action list) so the menu stays on
  // screen; being a little generous only nudges it up sooner.
  const menuWidth = 220;
  const menuHeight = 430;
  const clampedX = Math.min(position.x, window.innerWidth - menuWidth - 10);
  const clampedY = Math.min(position.y, window.innerHeight - menuHeight - 10);

  const isMultiSelect = selectedNodes.length > 1;
  const isSingleNode = selectedNodes.length === 1;
  const isEdgeSelected = selectedEdge !== null;
  // Ink is an element like any other: its context block offers the clipboard and
  // Delete, and its presence means the canvas under the cursor is not empty.
  const isInkSelected = selectedStrokes.length > 0;
  const isEmptyCanvas = selectedNodes.length === 0 && !selectedEdge && !isInkSelected;
  /**
   * Every element the menu's Lock item would act on.
   *
   * The same list the canvas's own handler builds, so the label cannot promise
   * one thing while the command does another: the item reads Unlock exactly
   * when everything picked is already locked, which is the state the toggle
   * turns back.
   */
  const lockTargets = [
    ...selectedNodes,
    ...(selectedEdge ? [selectedEdge] : []),
    ...selectedStrokes,
  ];
  const unlockAll = allLocked(lockTargets);

  /**
   * What to call the lock's target.
   *
   * The item appears once per section the menu is showing, but every instance
   * acts on the whole selection — the canvas has one lock command, not one per
   * kind. A selection that mixes kinds is therefore named for the selection
   * rather than for whichever section the eye happens to be in.
   */
  const lockNoun =
    isMultiSelect || (selectedNodes.length > 0 && (isEdgeSelected || isInkSelected))
      ? 'Selection'
      : isEdgeSelected
      ? 'Connector'
      : isInkSelected
      ? 'Ink'
      : 'Shape';

  /** Lock / Unlock, reading the state of everything the toggle would act on. */
  const lockItem = () => (
    <MenuItem
      icon={
        unlockAll ? (
          <Unlock className="w-3.5 h-3.5 text-emerald-500" />
        ) : (
          <Lock className="w-3.5 h-3.5 text-amber-500" />
        )
      }
      label={`${unlockAll ? 'Unlock' : 'Lock'} ${lockNoun}`}
      shortcut="Ctrl+Shift+L"
      onClick={() => {
        onToggleLock();
        onClose();
      }}
    />
  );

  /**
   * The turn items, offered wherever shapes are picked.
   *
   * Three steps rather than a free angle: the exact turn is what the grip on the
   * shape is for, and a menu is the way to do it without a drag at all — which
   * is also the only way to do it from a keyboard or a trackpad without aiming.
   */
  const rotateItems = () =>
    onRotate && (
      <>
        <MenuDivider />
        <div className="px-2 py-0.5 text-[10px] text-muted-foreground uppercase font-semibold">
          Rotate
        </div>
        <MenuItem
          icon={<RotateCw className="w-3.5 h-3.5" />}
          label="Rotate 90° Clockwise"
          onClick={() => {
            onRotate(QUARTER_TURN_DEGREES);
            onClose();
          }}
        />
        <MenuItem
          icon={<RotateCcw className="w-3.5 h-3.5" />}
          label="Rotate 90° Counter-clockwise"
          onClick={() => {
            onRotate(-QUARTER_TURN_DEGREES);
            onClose();
          }}
        />
        <MenuItem
          icon={<RotateCw className="w-3.5 h-3.5" />}
          label="Rotate 180°"
          onClick={() => {
            onRotate(2 * QUARTER_TURN_DEGREES);
            onClose();
          }}
        />
      </>
    );

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[210px] p-1.5 rounded-xl border border-border bg-card/95 backdrop-blur-2xl shadow-2xl text-foreground text-xs font-medium animate-in fade-in-50 zoom-in-95 duration-100 select-none"
      style={{ left: `${clampedX}px`, top: `${clampedY}px` }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* 0. HISTORY — offered whatever is under the cursor, so it is always one
          click away rather than something the user has to go and find. */}
      <div className="space-y-0.5">
        <MenuItem
          icon={<Undo2 className="w-3.5 h-3.5" />}
          label="Undo"
          shortcut="Ctrl+Z"
          disabled={!canUndo}
          onClick={() => {
            onUndo();
            onClose();
          }}
        />
        <MenuItem
          icon={<Redo2 className="w-3.5 h-3.5" />}
          label="Redo"
          shortcut="Ctrl+Y"
          disabled={!canRedo}
          onClick={() => {
            onRedo();
            onClose();
          }}
        />
      </div>

      {(isSingleNode || isMultiSelect || isEdgeSelected || isInkSelected) && <MenuDivider />}

      {/* 1. SINGLE NODE CONTEXT */}
      {isSingleNode && (
        <div className="space-y-0.5">
          {onStartEdit && (hasEditableLabel(selectedNodes[0]) || isGeometricShape(selectedNodes[0].type)) && (
            <MenuItem
              icon={<Type className="w-3.5 h-3.5 text-primary" />}
              label="Edit Label"
              shortcut="Double-click"
              onClick={() => {
                onStartEdit();
                onClose();
              }}
            />
          )}

          {selectedNodes[0].type === 'table' && onAddField && (
            <MenuItem
              icon={<Plus className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />}
              label="Add Column / Field"
              onClick={() => {
                onAddField(selectedNodes[0].id);
                onClose();
              }}
            />
          )}

          {(selectedNodes[0].type === 'card' || selectedNodes[0].type === 'container') && onToggleBadge && (
            <MenuItem
              icon={selectedNodes[0].badge ? <X className="w-3.5 h-3.5 text-muted-foreground" /> : <Plus className="w-3.5 h-3.5 text-primary" />}
              label={selectedNodes[0].badge ? 'Remove Badge' : 'Add Badge'}
              onClick={() => {
                onToggleBadge(selectedNodes[0].id);
                onClose();
              }}
            />
          )}

          <MenuItem
            icon={<Copy className="w-3.5 h-3.5" />}
            label="Copy"
            shortcut="Ctrl+C"
            onClick={() => {
              onCopy();
              onClose();
            }}
          />
          <MenuItem
            icon={<Scissors className="w-3.5 h-3.5" />}
            label="Cut"
            shortcut="Ctrl+X"
            onClick={() => {
              onCut();
              onClose();
            }}
          />
          <MenuItem
            icon={<Layers className="w-3.5 h-3.5" />}
            label="Duplicate"
            shortcut="Ctrl+D"
            onClick={() => {
              onDuplicate();
              onClose();
            }}
          />

          {(selectedNodes[0].type === 'frame' || selectedNodes[0].type === 'container') && onFitFrameToContent && (
            <MenuItem
              icon={<Maximize2 className="w-3.5 h-3.5 text-primary" />}
              label="Fit Frame to Content"
              shortcut="Shift+F"
              onClick={() => {
                onFitFrameToContent(selectedNodes[0].id);
                onClose();
              }}
            />
          )}

          {selectedNodes[0].type === 'frame' && onExportFrame && (
            <>
              <MenuItem
                icon={<Download className="w-3.5 h-3.5 text-primary" />}
                label="Export Frame (PNG)"
                onClick={() => {
                  onExportFrame(selectedNodes[0], 'png');
                  onClose();
                }}
              />
              <MenuItem
                icon={<Download className="w-3.5 h-3.5 text-primary" />}
                label="Export Frame (SVG)"
                onClick={() => {
                  onExportFrame(selectedNodes[0], 'svg');
                  onClose();
                }}
              />
            </>
          )}

          <MenuDivider />

          {/* Stacking Order */}
          <MenuItem
            icon={<ChevronsUp className="w-3.5 h-3.5" />}
            label="Bring to Front"
            shortcut="]"
            onClick={() => {
              onReorder('front');
              onClose();
            }}
          />
          <MenuItem
            icon={<ChevronUp className="w-3.5 h-3.5" />}
            label="Bring Forward"
            onClick={() => {
              onReorder('forward');
              onClose();
            }}
          />
          <MenuItem
            icon={<ChevronDown className="w-3.5 h-3.5" />}
            label="Send Backward"
            onClick={() => {
              onReorder('backward');
              onClose();
            }}
          />
          <MenuItem
            icon={<ChevronsDown className="w-3.5 h-3.5" />}
            label="Send to Back"
            shortcut="["
            onClick={() => {
              onReorder('back');
              onClose();
            }}
          />

          <MenuDivider />

          {lockItem()}

          {rotateItems()}

          <MenuItem
            icon={<Trash2 className="w-3.5 h-3.5 text-destructive" />}
            label="Delete"
            shortcut="Del"
            variant="destructive"
            onClick={() => {
              onDelete();
              onClose();
            }}
          />
        </div>
      )}

      {/* 2. MULTI-SELECTION CONTEXT */}
      {isMultiSelect && (
        <div className="space-y-0.5">
          <MenuItem
            icon={<Copy className="w-3.5 h-3.5" />}
            label="Copy All"
            shortcut="Ctrl+C"
            onClick={() => {
              onCopy();
              onClose();
            }}
          />
          <MenuItem
            icon={<Scissors className="w-3.5 h-3.5" />}
            label="Cut All"
            shortcut="Ctrl+X"
            onClick={() => {
              onCut();
              onClose();
            }}
          />
          <MenuItem
            icon={<Layers className="w-3.5 h-3.5" />}
            label="Duplicate All"
            shortcut="Ctrl+D"
            onClick={() => {
              onDuplicate();
              onClose();
            }}
          />

          {(onGroup || onUngroup) && (
            <>
              <MenuDivider />

              {onGroup && (
                <MenuItem
                  icon={<Group className="w-3.5 h-3.5 text-primary" />}
                  label="Group Selection"
                  shortcut="Ctrl+G"
                  onClick={() => {
                    onGroup();
                    onClose();
                  }}
                />
              )}
              {onUngroup && (
                <MenuItem
                  icon={<Ungroup className="w-3.5 h-3.5 text-primary" />}
                  label="Ungroup"
                  shortcut="Ctrl+Shift+G"
                  onClick={() => {
                    onUngroup();
                    onClose();
                  }}
                />
              )}
              {onFrameSelection && (
                <MenuItem
                  icon={<Frame className="w-3.5 h-3.5 text-primary" />}
                  label="Frame Selection"
                  shortcut="Ctrl+Alt+F"
                  onClick={() => {
                    onFrameSelection();
                    onClose();
                  }}
                />
              )}
            </>
          )}

          <MenuDivider />

          {/* Alignment */}
          {onAlign && (
            <>
              <div className="px-2 py-0.5 text-[10px] text-muted-foreground uppercase font-semibold">
                Align
              </div>
              <div className="grid grid-cols-3 gap-0.5 px-1 py-1">
                <button
                  onClick={() => {
                    onAlign('left');
                    onClose();
                  }}
                  className="p-1.5 rounded-lg hover:bg-muted text-center flex flex-col items-center justify-center gap-0.5"
                  title="Align Left"
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                  <span className="text-[9px]">Left</span>
                </button>
                <button
                  onClick={() => {
                    onAlign('center');
                    onClose();
                  }}
                  className="p-1.5 rounded-lg hover:bg-muted text-center flex flex-col items-center justify-center gap-0.5"
                  title="Align Center"
                >
                  <AlignCenter className="w-3.5 h-3.5" />
                  <span className="text-[9px]">Center</span>
                </button>
                <button
                  onClick={() => {
                    onAlign('right');
                    onClose();
                  }}
                  className="p-1.5 rounded-lg hover:bg-muted text-center flex flex-col items-center justify-center gap-0.5"
                  title="Align Right"
                >
                  <AlignRight className="w-3.5 h-3.5" />
                  <span className="text-[9px]">Right</span>
                </button>
              </div>
              <MenuDivider />
            </>
          )}

          <MenuItem
            icon={<ChevronsUp className="w-3.5 h-3.5" />}
            label="Bring to Front"
            onClick={() => {
              onReorder('front');
              onClose();
            }}
          />
          <MenuItem
            icon={<ChevronsDown className="w-3.5 h-3.5" />}
            label="Send to Back"
            onClick={() => {
              onReorder('back');
              onClose();
            }}
          />

          <MenuDivider />

          {lockItem()}

          {rotateItems()}

          <MenuItem
            icon={<Trash2 className="w-3.5 h-3.5 text-destructive" />}
            label="Delete Selection"
            shortcut="Del"
            variant="destructive"
            onClick={() => {
              onDelete();
              onClose();
            }}
          />
        </div>
      )}

      {/* 3. CONNECTOR CONTEXT */}
      {isEdgeSelected && (
        <div className="space-y-0.5">
          {onStartEdit && (
            <MenuItem
              icon={<Type className="w-3.5 h-3.5 text-primary" />}
              label="Edit Connection Label"
              onClick={() => {
                onStartEdit();
                onClose();
              }}
            />
          )}

          {onToggleEdgeStyle && (
            <MenuItem
              icon={selectedEdge.style === 'step' ? <Spline className="w-3.5 h-3.5 text-primary" /> : <GitCommit className="w-3.5 h-3.5 text-indigo-500" />}
              label={selectedEdge.style === 'step' ? 'Switch to Bezier Curve' : 'Switch to Orthogonal Step'}
              onClick={() => {
                onToggleEdgeStyle();
                onClose();
              }}
            />
          )}

          {onResetEdgeLabel && selectedEdge.labelOffset && (selectedEdge.labelOffset.x !== 0 || selectedEdge.labelOffset.y !== 0) && (
            <MenuItem
              icon={<RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />}
              label="Reset Label to Center"
              onClick={() => {
                onResetEdgeLabel();
                onClose();
              }}
            />
          )}

          {onResetLinePosition && Boolean(selectedEdge.stepOffset && selectedEdge.stepOffset !== 0) && (
            <MenuItem
              icon={<RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />}
              label="Reset Line Position"
              onClick={() => {
                onResetLinePosition();
                onClose();
              }}
            />
          )}

          {onResetEdgeAnchors && Boolean((selectedEdge.sourceOffset && selectedEdge.sourceOffset !== 0) || (selectedEdge.targetOffset && selectedEdge.targetOffset !== 0)) && (
            <MenuItem
              icon={<RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />}
              label="Reset Anchors to Center"
              onClick={() => {
                onResetEdgeAnchors();
                onClose();
              }}
            />
          )}

          {onDetachEdge && Boolean(selectedEdge.source || selectedEdge.target) && (
            <MenuItem
              icon={<Maximize2 className="w-3.5 h-3.5 text-muted-foreground" />}
              label="Detach Line (Move Freely)"
              onClick={() => {
                onDetachEdge();
                onClose();
              }}
            />
          )}

          <MenuDivider />

          {lockItem()}

          <MenuItem
            icon={<Trash2 className="w-3.5 h-3.5 text-destructive" />}
            label="Delete Connector"
            shortcut="Del"
            variant="destructive"
            onClick={() => {
              onDelete();
              onClose();
            }}
          />
        </div>
      )}

      {/* 4. INK CONTEXT — a freehand stroke picked with the select tool. */}
      {isInkSelected && (
        <div className="space-y-0.5">
          <div className="px-2 py-0.5 text-[10px] text-muted-foreground uppercase font-semibold">
            {selectedStrokes.length === 1 ? 'Ink' : `${selectedStrokes.length} Strokes`}
          </div>

          <MenuItem
            icon={<Copy className="w-3.5 h-3.5" />}
            label="Copy Ink"
            shortcut="Ctrl+C"
            onClick={() => {
              onCopy();
              onClose();
            }}
          />
          <MenuItem
            icon={<Scissors className="w-3.5 h-3.5" />}
            label="Cut Ink"
            shortcut="Ctrl+X"
            onClick={() => {
              onCut();
              onClose();
            }}
          />
          <MenuItem
            icon={<Layers className="w-3.5 h-3.5" />}
            label="Duplicate Ink"
            shortcut="Ctrl+D"
            onClick={() => {
              onDuplicate();
              onClose();
            }}
          />

          <MenuDivider />

          {lockItem()}

          <MenuItem
            icon={<Trash2 className="w-3.5 h-3.5 text-destructive" />}
            label="Delete Ink"
            shortcut="Del"
            variant="destructive"
            onClick={() => {
              onDelete();
              onClose();
            }}
          />
        </div>
      )}

      {/* 5. EMPTY CANVAS CONTEXT */}
      {isEmptyCanvas && (
        <div className="space-y-0.5">
          <MenuItem
            icon={<Clipboard className="w-3.5 h-3.5 text-primary" />}
            label="Paste"
            shortcut="Ctrl+V"
            disabled={!canPaste}
            onClick={() => {
              if (canPaste) {
                onPaste();
                onClose();
              }
            }}
          />

          <MenuItem
            icon={<Layers className="w-3.5 h-3.5" />}
            label="Select All"
            shortcut="Ctrl+A"
            onClick={() => {
              onSelectAll();
              onClose();
            }}
          />

          <MenuDivider />

          <MenuItem
            icon={<ZoomIn className="w-3.5 h-3.5" />}
            label="Zoom In"
            shortcut="Ctrl++"
            onClick={() => {
              onZoomIn();
              onClose();
            }}
          />
          <MenuItem
            icon={<ZoomOut className="w-3.5 h-3.5" />}
            label="Zoom Out"
            shortcut="Ctrl+-"
            onClick={() => {
              onZoomOut();
              onClose();
            }}
          />
          <MenuItem
            icon={<Maximize2 className="w-3.5 h-3.5" />}
            label="Zoom to Fit"
            shortcut="Shift+1"
            onClick={() => {
              onZoomToFit();
              onClose();
            }}
          />
          <MenuItem
            icon={<RotateCcw className="w-3.5 h-3.5" />}
            label="Reset Zoom to 100%"
            shortcut="Shift+0"
            onClick={() => {
              onResetZoom();
              onClose();
            }}
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  shortcut,
  variant,
  disabled = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  variant?: 'destructive';
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors',
        disabled
          ? 'opacity-40 cursor-not-allowed'
          : variant === 'destructive'
          ? 'hover:bg-destructive/10 text-destructive'
          : 'hover:bg-muted/80 text-foreground'
      )}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span>{label}</span>
      </div>
      {shortcut && (
        <span className="text-[10px] text-muted-foreground font-mono ml-3">{shortcut}</span>
      )}
    </button>
  );
}

function MenuDivider() {
  return <div className="h-px bg-border/60 my-1 -mx-0.5" />;
}
