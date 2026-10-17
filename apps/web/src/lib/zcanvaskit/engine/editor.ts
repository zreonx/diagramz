import { ZCanvasDocumentSchema } from '../core/schema';
import type {
  ZCanvasDocument,
  ZCanvasNode,
  ZCanvasEdge,
  ZCanvasDrawingStroke,
  ZCanvasViewport,
  ZCanvasTool,
} from '../core/schema';
import { ZCanvasHistory } from '../core/history';

export type ZCanvasEvent =
  | { type: 'change'; document: ZCanvasDocument }
  | { type: 'selection:change'; selectedNodeIds: string[]; selectedEdgeId: string | null }
  | { type: 'tool:change'; tool: ZCanvasTool }
  | { type: 'viewport:change'; viewport: ZCanvasViewport };

export type ZCanvasEventListener = (event: ZCanvasEvent) => void;

export class ZCanvasEditor {
  private document: ZCanvasDocument;
  private history: ZCanvasHistory<ZCanvasDocument>;
  private activeTool: ZCanvasTool = 'select';
  private selectedNodeIds: string[] = [];
  private selectedEdgeId: string | null = null;
  private listeners: Set<ZCanvasEventListener> = new Set();

  constructor(initialDocument?: unknown) {
    this.document = this.parseDocument(initialDocument);
    this.history = new ZCanvasHistory<ZCanvasDocument>(50);
  }

  public parseDocument(raw: unknown): ZCanvasDocument {
    const parsed = ZCanvasDocumentSchema.safeParse(raw);
    if (parsed.success) {
      return parsed.data;
    }
    return {
      version: 1,
      nodes: [],
      edges: [],
      strokes: [],
      viewport: { zoom: 1, panX: 40, panY: 40 },
    };
  }

  public getDocument(): ZCanvasDocument {
    return this.document;
  }

  public getSelectedNodeIds(): string[] {
    return this.selectedNodeIds;
  }

  public getSelectedEdgeId(): string | null {
    return this.selectedEdgeId;
  }

  public getActiveTool(): ZCanvasTool {
    return this.activeTool;
  }

  public setTool(tool: ZCanvasTool): void {
    this.activeTool = tool;
    this.emit({ type: 'tool:change', tool });
  }

  public selectNodes(ids: string[]): void {
    this.selectedNodeIds = ids;
    this.selectedEdgeId = null;
    this.emit({ type: 'selection:change', selectedNodeIds: ids, selectedEdgeId: null });
  }

  public selectEdge(id: string | null): void {
    this.selectedEdgeId = id;
    if (id !== null) {
      this.selectedNodeIds = [];
    }
    this.emit({
      type: 'selection:change',
      selectedNodeIds: this.selectedNodeIds,
      selectedEdgeId: id,
    });
  }

  public updateViewport(viewport: ZCanvasViewport): void {
    this.document.viewport = viewport;
    this.emit({ type: 'viewport:change', viewport });
  }

  public commit(
    newDoc: {
      nodes?: ZCanvasNode[];
      edges?: ZCanvasEdge[];
      strokes?: ZCanvasDrawingStroke[];
      viewport?: ZCanvasViewport;
    },
    recordHistory = true
  ): void {
    if (recordHistory) {
      this.history.push(this.document);
    }

    this.document = {
      version: 1,
      nodes: newDoc.nodes ?? this.document.nodes,
      edges: newDoc.edges ?? this.document.edges,
      strokes: newDoc.strokes ?? this.document.strokes,
      viewport: newDoc.viewport ?? this.document.viewport,
    };

    this.emit({ type: 'change', document: this.document });
  }

  public undo(): boolean {
    const prev = this.history.undo(this.document);
    if (prev) {
      this.document = prev;
      this.emit({ type: 'change', document: this.document });
      return true;
    }
    return false;
  }

  public redo(): boolean {
    const next = this.history.redo(this.document);
    if (next) {
      this.document = next;
      this.emit({ type: 'change', document: this.document });
      return true;
    }
    return false;
  }

  public canUndo(): boolean {
    return this.history.canUndo();
  }

  public canRedo(): boolean {
    return this.history.canRedo();
  }

  public subscribe(listener: ZCanvasEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: ZCanvasEvent): void {
    this.listeners.forEach((fn) => fn(event));
  }

  public dispose(): void {
    this.listeners.clear();
    this.history.clear();
  }
}
