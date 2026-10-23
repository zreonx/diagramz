'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import {
  ZCanvas,
  normalizeToZCanvasDocument,
  exportZCanvasToStorage,
  ZCanvasDocument,
  type ZCanvasNode,
  placeDragItem,
  createIdFactory,
  type ZCanvasDragItem,
  beautifyArchitectureLayout,
} from '@/lib/zcanvaskit';
import {
  parseMermaidToEraser,
} from '@/lib/eraser-templates';
import { MermaidEditor } from '../editor/MermaidEditor';
import { AiAssistant } from '../ai/AiAssistant';
import { CanvasHeader } from './CanvasHeader';
import { ComponentLibraryPanel } from './ComponentLibraryPanel';
import { ARCH_ICON_MAP } from './ArchitectureIcons';
import { DocumentEditor } from '../editor/DocumentEditor';
import { CanvasCommandPalette } from './CanvasCommandPalette';
import { useDiagramStore } from '@/stores/diagram.store';
import { DiagramDetail } from '@diagramz/shared';
import { GripVertical, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface DiagramCanvasProps {
  initialDiagram: DiagramDetail;
  workspaceName?: string;
  projectName?: string;
}

export function DiagramCanvas({
  initialDiagram,
  workspaceName,
  projectName,
}: DiagramCanvasProps) {
  const currentDiagram = useDiagramStore((s) => s.currentDiagram);
  const setDiagram = useDiagramStore((s) => s.setDiagram);
  const mermaidCode = useDiagramStore((s) => s.mermaidCode);
  const setMermaidCode = useDiagramStore((s) => s.setMermaidCode);
  const viewMode = useDiagramStore((s) => s.viewMode);
  const setViewMode = useDiagramStore((s) => s.setViewMode);
  const edgeRouting = useDiagramStore((s) => s.edgeRouting);
  const setEdgeRouting = useDiagramStore((s) => s.setEdgeRouting);
  const panelMode = useDiagramStore((s) => s.panelMode);
  const setPanelMode = useDiagramStore((s) => s.setPanelMode);
  const saveDiagram = useDiagramStore((s) => s.saveDiagram);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initializedRef = useRef<string | null>(null);
  const [splitRatio, setSplitRatio] = useState<number>(45);
  const [isDraggingSplitter, setIsDraggingSplitter] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      ) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      } else if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Initialize store once per diagram ID
  React.useEffect(() => {
    if (initializedRef.current !== initialDiagram.id) {
      initializedRef.current = initialDiagram.id;
      if (!currentDiagram || currentDiagram.id !== initialDiagram.id) {
        setDiagram(initialDiagram);
      }
      setZcanvasDoc(normalizeToZCanvasDocument(initialDiagram.canvasData));
    }
  }, [initialDiagram, currentDiagram, setDiagram]);

  const [zcanvasDoc, setZcanvasDoc] = useState<ZCanvasDocument>(() =>
    normalizeToZCanvasDocument(initialDiagram.canvasData)
  );

  // Debounced auto-save
  const triggerAutoSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveDiagram();
    }, 2000);
  }, [saveDiagram]);

  const handleCanvasChange = useCallback(
    (newDoc: ZCanvasDocument) => {
      setZcanvasDoc(newDoc);
      useDiagramStore.getState().setCanvasData(exportZCanvasToStorage(newDoc));
      triggerAutoSave();
    },
    [triggerAutoSave]
  );

  // Splitter drag handling
  const handleSplitterMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingSplitter(true);
  }, []);

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingSplitter || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newRatio = ((e.clientX - rect.left) / rect.width) * 100;
      setSplitRatio(Math.max(20, Math.min(80, newRatio)));
    };

    const handleMouseUp = () => {
      setIsDraggingSplitter(false);
    };

    if (isDraggingSplitter) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingSplitter]);

  /**
   * Inserts a library item at the centre of the view, for a click on a tile.
   *
   * A click hands over exactly the payload a drop would, and it is placed by
   * the same engine function, so both routes produce identical nodes. The old
   * click path had its own copy of every branch — and its own bugs, including
   * a pattern whose connectors read fields the panel never wrote.
   *
   * A click has no pointer position, so the item lands in the middle of what
   * the user can see, which is where a click meant it to go.
   */
  const handleInsertItem = useCallback(
    (item: ZCanvasDragItem) => {
      const vp = zcanvasDoc.viewport || { zoom: 1, panX: 40, panY: 40 };
      // The canvas is roughly 700x400 of visible area at rest; centring on its
      // midpoint keeps a clicked item in view whatever the split is.
      const x = Math.round((-vp.panX + 350) / vp.zoom);
      const y = Math.round((-vp.panY + 200) / vp.zoom);

      const placement = placeDragItem(item, {
        x,
        y,
        existingNodeIds: new Set(zcanvasDoc.nodes.map((node) => node.id)),
        createId: createIdFactory({
          existing: new Set([
            ...zcanvasDoc.nodes.map((node) => node.id),
            ...zcanvasDoc.edges.map((edge) => edge.id),
          ]),
        }),
      });
      if (!placement) return;

      handleCanvasChange({
        ...zcanvasDoc,
        nodes: placement.prepend
          ? [...placement.nodes, ...zcanvasDoc.nodes]
          : [...zcanvasDoc.nodes, ...placement.nodes],
        edges: [...zcanvasDoc.edges, ...placement.edges],
      });
      // Nothing is announced: the item is on the canvas, in the middle of the
      // view the user is looking at.
    },
    [zcanvasDoc, handleCanvasChange]
  );

  // Insert Mermaid into Canvas (supports both Live Mermaid Component and native Diagramz Stencils)
  const handleInsertMermaidToCanvas = useCallback(
    async (
      code: string,
      options?: { mode?: 'mermaid-component' | 'stencils'; svg?: string }
    ) => {
      const mode = options?.mode ?? 'mermaid-component';

      if (mode === 'mermaid-component') {
        let svgContent = options?.svg;
        if (!svgContent) {
          try {
            const id = `mermaid-canvas-${Date.now()}`;
            const res = await mermaid.render(id, code);
            svgContent = res.svg;
          } catch (err: any) {
            toast.error(err?.message || 'Failed to render Mermaid preview');
            return;
          }
        }

        // Measure SVG bounds
        let width = 520;
        let height = 340;
        const viewBoxMatch = svgContent.match(/viewBox=["']\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*["']/i);
        if (viewBoxMatch) {
          const vbW = parseFloat(viewBoxMatch[3]);
          const vbH = parseFloat(viewBoxMatch[4]);
          if (vbW > 0 && vbH > 0) {
            width = Math.min(1000, Math.max(260, Math.round(vbW)));
            height = Math.min(800, Math.max(160, Math.round(vbH)));
          }
        } else {
          const widthMatch = svgContent.match(/width=["']([\d.]+)p?t?x?["']/i);
          const heightMatch = svgContent.match(/height=["']([\d.]+)p?t?x?["']/i);
          if (widthMatch && heightMatch) {
            width = Math.min(1000, Math.max(260, Math.round(parseFloat(widthMatch[1]))));
            height = Math.min(800, Math.max(160, Math.round(parseFloat(heightMatch[1]))));
          }
        }

        // Calculate offset to place beside existing nodes or in viewport
        let targetX = 80;
        let targetY = 80;
        if (zcanvasDoc.nodes.length > 0) {
          const rightmost = Math.max(...zcanvasDoc.nodes.map((n) => (n.x ?? 0) + (n.width ?? 0)));
          targetX = rightmost > 0 ? rightmost + 60 : 80;
        }

        const mermaidNode: ZCanvasNode = {
          id: `mermaid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          type: 'svg',
          x: targetX,
          y: targetY,
          width,
          height,
          title: 'Mermaid Diagram',
          data: {
            isMermaid: true,
            mermaidCode: code,
            svg: svgContent,
            svgMarkup: svgContent,
          },
        };

        handleCanvasChange({
          ...zcanvasDoc,
          nodes: [...zcanvasDoc.nodes, mermaidNode],
        });
        toast.success('Inserted live Mermaid diagram component onto canvas');
        return;
      }

      // Mode: 'stencils' (Convert to Diagramz native architecture stencils & cards)
      const result = parseMermaidToEraser(code);
      if (result.entities.length === 0) {
        toast.info('No structured cards found; inserted as Live Mermaid Component');
        handleInsertMermaidToCanvas(code, { mode: 'mermaid-component', svg: options?.svg });
        return;
      }

      const converted = normalizeToZCanvasDocument(result);
      const beautified = beautifyArchitectureLayout(converted.nodes, converted.edges, {
        minHorizontalGap: 160,
        minVerticalGap: 170,
        containerPadding: 55,
        containerHeaderHeight: 65,
        containerGap: 80,
      });

      // Calculate horizontal offset if canvas already has nodes
      let offsetX = 0;
      if (zcanvasDoc.nodes.length > 0) {
        const rightmost = Math.max(...zcanvasDoc.nodes.map((n) => (n.x ?? 0) + (n.width ?? 0)));
        offsetX = rightmost > 0 ? rightmost + 80 : 0;
      }

      const offsetNodes =
        offsetX > 0
          ? beautified.nodes.map((n) => ({ ...n, x: n.x + offsetX }))
          : beautified.nodes;

      const newIds = new Set(offsetNodes.map((n) => n.id));
      const newEdgeIds = new Set(beautified.edges.map((e) => e.id));

      const remainingNodes = zcanvasDoc.nodes.filter((n) => !newIds.has(n.id));
      const remainingEdges = zcanvasDoc.edges.filter((e) => !newEdgeIds.has(e.id));

      const containers = offsetNodes.filter((n: any) => n.type === 'container' || n.type === 'frame');
      const nonContainers = offsetNodes.filter((n: any) => n.type !== 'container' && n.type !== 'frame');

      handleCanvasChange({
        ...zcanvasDoc,
        nodes: [...containers, ...remainingNodes, ...nonContainers],
        edges: [...remainingEdges, ...beautified.edges],
      });
      toast.success('Converted Mermaid diagram to Diagramz architecture stencils');
    },
    [zcanvasDoc, handleCanvasChange]
  );

  // Insert native Diagramz Canvas Document directly
  const handleInsertNativeCanvasDoc = useCallback(
    (canvasData: any) => {
      if (!canvasData || (!canvasData.nodes?.length && !canvasData.edges?.length)) {
        toast.error('No valid Diagramz architecture data found');
        return;
      }

      const existingNodeIds = new Set(zcanvasDoc.nodes.map((n) => n.id));
      const existingEdgeIds = new Set(zcanvasDoc.edges.map((e) => e.id));

      // Calculate horizontal offset if canvas already has nodes
      let offsetX = 0;
      if (zcanvasDoc.nodes.length > 0) {
        const rightmost = Math.max(...zcanvasDoc.nodes.map((n) => (n.x ?? 0) + (n.width ?? 0)));
        offsetX = rightmost > 0 ? rightmost + 80 : 0;
      }

      // Map IDs to avoid collisions
      const idMap = new Map<string, string>();
      const prefix = `ai_${Date.now().toString(36)}_`;

      const mappedNodes = (canvasData.nodes || []).map((node: any) => {
        const newId = existingNodeIds.has(node.id) ? `${prefix}${node.id}` : node.id;
        idMap.set(node.id, newId);

        let stencilId =
          node.data?.stencilId ||
          node.data?.techLogoId ||
          node.data?.archId ||
          node.stencilId ||
          node.techLogoId ||
          node.archId ||
          (node.icon?.startsWith('tech-') || node.icon?.startsWith('arch-') ? node.icon : undefined);

        const isContainer = node.type === 'container' || node.type === 'frame';
        const isTable = node.type === 'table';
        const isText = node.type === 'text';
        const isShape =
          node.type === 'rectangle' ||
          node.type === 'circle' ||
          node.type === 'diamond' ||
          node.type === 'triangle' ||
          node.type === 'cylinder' ||
          node.type === 'cloud';

        let type = node.type || (stencilId ? 'svg' : 'card');
        let width = node.width ?? 90;
        let height = node.height ?? 90;

        if (isTable) {
          type = 'table';
          width = node.width ?? 260;
          height = node.height ?? (node.fields?.length ? 44 + node.fields.length * 28 + 20 : 180);
        } else if (isContainer) {
          type = node.type === 'frame' ? 'frame' : 'container';
          width = node.width ?? 400;
          height = node.height ?? 300;
        } else if (isText) {
          type = 'text';
          width = node.width ?? 220;
          height = node.height ?? 40;
        } else if (isShape) {
          type = node.type;
          width = node.width ?? 140;
          height = node.height ?? 80;
        } else {
          // Built-in architecture vector stencils or tech logos
          type = 'svg';
          if (!stencilId) {
            stencilId = node.title || node.id || 'arch-server';
          }
          if (width > 120) width = 90;
          if (height > 120) height = 90;
        }

        const data = {
          ...(node.data || {}),
          stencilId: stencilId || node.data?.stencilId,
          techLogoId: node.data?.techLogoId || (stencilId?.startsWith('tech-') ? stencilId : undefined),
          archId: stencilId?.startsWith('arch-') ? stencilId : node.data?.archId,
        };

        return {
          ...node,
          id: newId,
          type,
          width,
          height,
          fields: node.fields || (node as any).columns || [],
          data,
          title: node.title || node.label || '',
          x: node.x ?? 0,
          y: node.y ?? 0,
        };
      });

      const mappedEdges = (canvasData.edges || []).map((edge: any) => {
        const newId = existingEdgeIds.has(edge.id) ? `${prefix}${edge.id}` : edge.id;
        return {
          ...edge,
          id: newId,
          source: idMap.get(edge.source) || edge.source,
          target: idMap.get(edge.target) || edge.target,
        };
      });

      // Apply the architecture layout beautifier to guarantee generous horizontal and vertical spacing,
      // dynamic edge label clearances, container bounds, and optimal connection handles.
      const beautified = beautifyArchitectureLayout(mappedNodes, mappedEdges, {
        minHorizontalGap: 160,
        minVerticalGap: 170,
        containerPadding: 55,
        containerHeaderHeight: 65,
        containerGap: 80,
        baseOffsetX: offsetX > 0 ? offsetX : 40,
      });

      const newIds = new Set(beautified.nodes.map((n) => n.id));
      const newEdgeIds = new Set(beautified.edges.map((e) => e.id));

      const remainingNodes = zcanvasDoc.nodes.filter((n) => !newIds.has(n.id));
      const remainingEdges = zcanvasDoc.edges.filter((e) => !newEdgeIds.has(e.id));

      const containers = beautified.nodes.filter((n: any) => n.type === 'container' || n.type === 'frame');
      const nonContainers = beautified.nodes.filter((n: any) => n.type !== 'container' && n.type !== 'frame');

      handleCanvasChange({
        ...zcanvasDoc,
        nodes: [...containers, ...remainingNodes, ...nonContainers],
        edges: [...remainingEdges, ...beautified.edges],
      });

      toast.success(`Inserted ${beautified.nodes.length} architecture components to canvas!`);
    },
    [zcanvasDoc, handleCanvasChange]
  );

  const handleBeautifyLayout = useCallback(() => {
    if (zcanvasDoc.nodes.length === 0) {
      toast.info('No diagram components on canvas to align');
      return;
    }

    const beautified = beautifyArchitectureLayout(zcanvasDoc.nodes, zcanvasDoc.edges, {
      minHorizontalGap: 160,
      minVerticalGap: 170,
      containerPadding: 55,
      containerHeaderHeight: 65,
      containerGap: 80,
    });

    const containers = beautified.nodes.filter((n: any) => n.type === 'container' || n.type === 'frame');
    const nonContainers = beautified.nodes.filter((n: any) => n.type !== 'container' && n.type !== 'frame');

    handleCanvasChange({
      ...zcanvasDoc,
      nodes: [...containers, ...nonContainers],
      edges: beautified.edges,
    });

    toast.success('Beautified diagram architecture layout!');
  }, [zcanvasDoc, handleCanvasChange]);

  const handleRestoreSnapshot = useCallback(
    (snapshot: {
      canvasData?: unknown;
      mermaidCode?: string;
      documentContent?: string;
      title?: string;
    }) => {
      if (snapshot.canvasData !== undefined) {
        const normalized = normalizeToZCanvasDocument(snapshot.canvasData);
        handleCanvasChange(normalized);
      }
      if (snapshot.mermaidCode !== undefined) {
        setMermaidCode(snapshot.mermaidCode);
      }
      if (snapshot.documentContent !== undefined) {
        useDiagramStore.getState().setDocumentContent(snapshot.documentContent);
      }
      triggerAutoSave();
    },
    [handleCanvasChange, setMermaidCode, triggerAutoSave]
  );

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).diagramzInsertCanvasDoc = handleInsertNativeCanvasDoc;
      (window as any).diagramzSetDoc = handleCanvasChange;
      (window as any).diagramzGetDoc = () => zcanvasDoc;
      (window as any).diagramzBeautify = beautifyArchitectureLayout;
    }
  }, [handleInsertNativeCanvasDoc, handleCanvasChange, zcanvasDoc]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background">
      <CanvasHeader
        title={currentDiagram?.title || initialDiagram.title}
        workspaceName={workspaceName}
        folderName={projectName}
        onBeautifyLayout={handleBeautifyLayout}
        onRestoreSnapshot={handleRestoreSnapshot}
      />

      <div ref={containerRef} className="relative flex-1 flex overflow-hidden">
        {/* Component Library Drawer */}
        {panelMode === 'library' && (
          <ComponentLibraryPanel
            onInsertItem={handleInsertItem}
            onClose={() => setPanelMode('none')}
          />
        )}

        {/* Document Editor (Left side in 'both' or full in 'doc') */}
        {(viewMode === 'doc' || viewMode === 'both') && (
          <div
            style={
              viewMode === 'both'
                ? {
                    flexBasis: `${splitRatio}%`,
                    flexGrow: 0,
                    flexShrink: 0,
                    minWidth: '280px',
                    maxWidth: 'calc(100% - 280px)',
                  }
                : undefined
            }
            className={cn(
              'h-full border-r border-border bg-card/60 flex flex-col z-10 overflow-hidden',
              viewMode === 'doc' && 'w-full flex-1'
            )}
          >
            <DocumentEditor viewLayoutMode={viewMode} />
          </div>
        )}

        {/* Resizer Splitter */}
        {viewMode === 'both' && (
          <div
            onMouseDown={handleSplitterMouseDown}
            className={cn(
              'w-2 hover:w-2.5 bg-border/60 hover:bg-primary/50 transition-all cursor-col-resize flex items-center justify-center group select-none z-30 shrink-0 touch-none',
              isDraggingSplitter && 'bg-primary w-2.5 shadow-sm'
            )}
            title="Drag to resize Document and Canvas view"
          >
            <GripVertical className="w-3.5 h-3.5 text-muted-foreground/60 group-hover:text-foreground" />
          </div>
        )}

        {/* Interactive Infinite Canvas Surface */}
        {(viewMode === 'canvas' || viewMode === 'both') && (
          <div
            style={
              viewMode === 'both'
                ? {
                    flexBasis: `${100 - splitRatio}%`,
                    flexGrow: 1,
                    flexShrink: 1,
                    minWidth: '280px',
                  }
                : undefined
            }
            className={cn(
              'h-full relative overflow-hidden bg-background',
              viewMode === 'canvas' && 'w-full flex-1'
            )}
          >
            {/* Quick left dock: when viewMode === 'canvas', an unobtrusive floating button to open notes */}
            {viewMode === 'canvas' && (
              <button
                type="button"
                onClick={() => setViewMode('both')}
                className="absolute top-4 left-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/80 bg-card/90 backdrop-blur-md shadow-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all cursor-pointer group"
                title="Open Document & Notes Panel"
              >
                <FileText className="w-3.5 h-3.5 text-primary group-hover:scale-110 transition-transform" />
                <span className="hidden sm:inline">Notes</span>
              </button>
            )}

            <ZCanvas
              initialDocument={zcanvasDoc}
              onChange={handleCanvasChange}
              edgeRouting={edgeRouting}
              onEdgeRoutingChange={setEdgeRouting}
              onNodeDoubleClick={(node) => {
                if (node.data?.isMermaid && node.data?.mermaidCode) {
                  setMermaidCode(node.data.mermaidCode);
                  setPanelMode('mermaid');
                  toast.info('Opened Mermaid diagram in editor');
                }
              }}
              // The app's icon vocabulary, which is a product decision the
              // engine has no business owning.
              renderers={{ icons: ARCH_ICON_MAP }}
            />
          </div>
        )}

        {/* Mermaid Editor Drawer */}
        {panelMode === 'mermaid' && (
          <div className="w-96 border-l border-border bg-card h-full z-20">
            <MermaidEditor
              value={mermaidCode}
              onChange={(code) => {
                setMermaidCode(code);
                triggerAutoSave();
              }}
              onInsertToCanvas={handleInsertMermaidToCanvas}
            />
          </div>
        )}

        {/* AI Assistant Drawer */}
        <div className={cn("w-96 border-l border-border bg-card h-full z-20 flex flex-col", panelMode !== 'ai' && 'hidden')}>
          <AiAssistant
            diagramId={currentDiagram?.id || initialDiagram.id}
            currentMermaidCode={mermaidCode}
            onApplyDiagram={(code) => {
              setMermaidCode(code);
              triggerAutoSave();
            }}
            onInsertToCanvas={handleInsertMermaidToCanvas}
            onInsertNativeCanvasDoc={handleInsertNativeCanvasDoc}
            onClose={() => setPanelMode('none')}
          />
        </div>
      </div>

      {/* Global Canvas Command Palette (Ctrl+K or /) */}
      <CanvasCommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onInsertItem={handleInsertItem}
        onBeautifyLayout={handleBeautifyLayout}
        onTogglePanel={(mode) => setPanelMode(panelMode === mode ? 'none' : mode)}
        onSetViewMode={setViewMode}
      />
    </div>
  );
}
