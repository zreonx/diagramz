import type {
  ZCanvasDocument,
  ZCanvasNode,
  ZCanvasEdge,
  ZCanvasDrawingStroke,
  ZCanvasBox,
  ZCanvasHandlePosition,
} from '../schema';
import { applyLock, nextLockState } from '../locking';

export interface CommandContext {
  document: ZCanvasDocument;
  selectedNodeIds: string[];
  selectedEdgeId: string | null;
  /** The connectors picked, where the surface tracks more than one. */
  selectedEdgeIds?: string[];
  /** The ink picked. */
  selectedStrokeIds?: string[];
  commit(
    update: {
      nodes?: ZCanvasNode[];
      edges?: ZCanvasEdge[];
      strokes?: ZCanvasDrawingStroke[];
    },
    actionLabel?: string
  ): void;
  select(nodeIds: string[], edgeId?: string | null): void;
}

export interface EditorCommand<TContext extends CommandContext = CommandContext> {
  id: string;
  label: string;
  canExecute(context: TContext): boolean;
  execute(context: TContext): void;
}

// 1. Create Shape Command
export class CreateNodeCommand implements EditorCommand {
  id = 'node:create';
  label = 'Create Shape';
  private node: ZCanvasNode;

  constructor(node: ZCanvasNode) {
    this.node = node;
  }

  canExecute(): boolean {
    return !!this.node.id;
  }

  execute(ctx: CommandContext): void {
    const updated = [...ctx.document.nodes, this.node];
    ctx.commit({ nodes: updated }, `Created ${this.node.type}`);
    ctx.select([this.node.id]);
  }
}

// 2. Delete Selected Command
export class DeleteSelectedCommand implements EditorCommand {
  id = 'selection:delete';
  label = 'Delete Selection';

  canExecute(ctx: CommandContext): boolean {
    return ctx.selectedNodeIds.length > 0 || ctx.selectedEdgeId !== null;
  }

  execute(ctx: CommandContext): void {
    if (ctx.selectedNodeIds.length > 0) {
      const toDelete = new Set(ctx.selectedNodeIds);
      const newNodes = ctx.document.nodes.filter((n) => !toDelete.has(n.id));
      const newEdges = ctx.document.edges.filter(
        (e) => !toDelete.has(e.source) && !toDelete.has(e.target)
      );
      ctx.commit({ nodes: newNodes, edges: newEdges }, 'Deleted Selected Shapes');
      ctx.select([]);
    } else if (ctx.selectedEdgeId) {
      const newEdges = ctx.document.edges.filter((e) => e.id !== ctx.selectedEdgeId);
      ctx.commit({ edges: newEdges }, 'Deleted Connector');
      ctx.select([], null);
    }
  }
}

// 3. Stacking Order Commands (Bring Forward, Send Backward, Bring to Front, Send to Back)
export type StackingDirection = 'front' | 'forward' | 'backward' | 'back';

export class ReorderNodesCommand implements EditorCommand {
  id: string;
  label: string;
  private direction: StackingDirection;

  constructor(direction: StackingDirection) {
    this.direction = direction;
    this.id = `node:reorder:${direction}`;
    this.label =
      direction === 'front'
        ? 'Bring to Front'
        : direction === 'forward'
        ? 'Bring Forward'
        : direction === 'backward'
        ? 'Send Backward'
        : 'Send to Back';
  }

  canExecute(ctx: CommandContext): boolean {
    return ctx.selectedNodeIds.length > 0;
  }

  execute(ctx: CommandContext): void {
    const nodes = [...ctx.document.nodes];
    const selected = new Set(ctx.selectedNodeIds);

    if (this.direction === 'front') {
      const unselected = nodes.filter((n) => !selected.has(n.id));
      const moving = nodes.filter((n) => selected.has(n.id));
      ctx.commit({ nodes: [...unselected, ...moving] }, 'Brought to Front');
    } else if (this.direction === 'back') {
      const unselected = nodes.filter((n) => !selected.has(n.id));
      const moving = nodes.filter((n) => selected.has(n.id));
      ctx.commit({ nodes: [...moving, ...unselected] }, 'Sent to Back');
    } else if (this.direction === 'forward') {
      for (let i = nodes.length - 2; i >= 0; i--) {
        if (selected.has(nodes[i].id) && !selected.has(nodes[i + 1].id)) {
          const temp = nodes[i];
          nodes[i] = nodes[i + 1];
          nodes[i + 1] = temp;
        }
      }
      ctx.commit({ nodes }, 'Brought Forward');
    } else if (this.direction === 'backward') {
      for (let i = 1; i < nodes.length; i++) {
        if (selected.has(nodes[i].id) && !selected.has(nodes[i - 1].id)) {
          const temp = nodes[i];
          nodes[i] = nodes[i - 1];
          nodes[i - 1] = temp;
        }
      }
      ctx.commit({ nodes }, 'Sent Backward');
    }
  }
}

// 4. Lock / Unlock Selection Command
export class ToggleLockCommand implements EditorCommand {
  id = 'element:toggle-lock';
  label = 'Lock / Unlock';

  canExecute(ctx: CommandContext): boolean {
    return this.selection(ctx).length > 0;
  }

  execute(ctx: CommandContext): void {
    const selected = new Set(this.selection(ctx));
    // The rule is decided over the whole selection at once — see `nextLockState`
    // — so a selection that mixes locked and unlocked elements resolves in one
    // direction instead of splitting into a state nothing on screen explains.
    const elements = [...ctx.document.nodes, ...ctx.document.edges, ...ctx.document.strokes].filter(
      (element) => selected.has(element.id)
    );
    const locked = nextLockState(elements);

    ctx.commit(
      {
        nodes: ctx.document.nodes.map((n) => (selected.has(n.id) ? applyLock(n, locked) : n)),
        edges: ctx.document.edges.map((e) => (selected.has(e.id) ? applyLock(e, locked) : e)),
        strokes: ctx.document.strokes.map((s) => (selected.has(s.id) ? applyLock(s, locked) : s)),
      },
      locked ? 'Locked Selection' : 'Unlocked Selection'
    );
  }

  /** Every id the surface has picked, across all three kinds. */
  private selection(ctx: CommandContext): string[] {
    const edgeIds = ctx.selectedEdgeIds ?? (ctx.selectedEdgeId ? [ctx.selectedEdgeId] : []);
    return [...ctx.selectedNodeIds, ...edgeIds, ...(ctx.selectedStrokeIds ?? [])];
  }
}

// 5. Align Nodes Command
export type AlignmentDirection = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';

export class AlignNodesCommand implements EditorCommand {
  id: string;
  label: string;
  private alignment: AlignmentDirection;

  constructor(alignment: AlignmentDirection) {
    this.alignment = alignment;
    this.id = `node:align:${alignment}`;
    this.label = `Align ${alignment.charAt(0).toUpperCase() + alignment.slice(1)}`;
  }

  canExecute(ctx: CommandContext): boolean {
    return ctx.selectedNodeIds.length >= 2;
  }

  execute(ctx: CommandContext): void {
    const selected = ctx.document.nodes.filter((n) =>
      ctx.selectedNodeIds.includes(n.id)
    );
    if (selected.length < 2) return;

    let targetVal = 0;
    if (this.alignment === 'left') targetVal = Math.min(...selected.map((n) => n.x));
    else if (this.alignment === 'center') {
      const minX = Math.min(...selected.map((n) => n.x));
      const maxX = Math.max(...selected.map((n) => n.x + n.width));
      targetVal = (minX + maxX) / 2;
    } else if (this.alignment === 'right') {
      targetVal = Math.max(...selected.map((n) => n.x + n.width));
    } else if (this.alignment === 'top') {
      targetVal = Math.min(...selected.map((n) => n.y));
    } else if (this.alignment === 'middle') {
      const minY = Math.min(...selected.map((n) => n.y));
      const maxY = Math.max(...selected.map((n) => n.y + n.height));
      targetVal = (minY + maxY) / 2;
    } else if (this.alignment === 'bottom') {
      targetVal = Math.max(...selected.map((n) => n.y + n.height));
    }

    const newNodes = ctx.document.nodes.map((n) => {
      if (!ctx.selectedNodeIds.includes(n.id)) return n;
      if (this.alignment === 'left') return { ...n, x: targetVal };
      if (this.alignment === 'center') return { ...n, x: Math.round(targetVal - n.width / 2) };
      if (this.alignment === 'right') return { ...n, x: targetVal - n.width };
      if (this.alignment === 'top') return { ...n, y: targetVal };
      if (this.alignment === 'middle') return { ...n, y: Math.round(targetVal - n.height / 2) };
      if (this.alignment === 'bottom') return { ...n, y: targetVal - n.height };
      return n;
    });

    ctx.commit({ nodes: newNodes }, `Aligned ${this.alignment}`);
  }
}

// 6. Distribute Nodes Command
export class DistributeNodesCommand implements EditorCommand {
  id: string;
  label: string;
  private direction: 'horizontal' | 'vertical';

  constructor(direction: 'horizontal' | 'vertical') {
    this.direction = direction;
    this.id = `node:distribute:${direction}`;
    this.label = `Distribute ${direction === 'horizontal' ? 'Horizontally' : 'Vertically'}`;
  }

  canExecute(ctx: CommandContext): boolean {
    return ctx.selectedNodeIds.length >= 3;
  }

  execute(ctx: CommandContext): void {
    const selected = ctx.document.nodes.filter((n) =>
      ctx.selectedNodeIds.includes(n.id)
    );
    if (selected.length < 3) return;

    if (this.direction === 'horizontal') {
      const sorted = [...selected].sort((a, b) => a.x - b.x);
      const minX = sorted[0].x;
      const maxX = sorted[sorted.length - 1].x;
      const totalSpacing = maxX - minX;
      const step = totalSpacing / (sorted.length - 1);
      const newMap = new Map<string, number>();
      sorted.forEach((n, idx) => {
        newMap.set(n.id, Math.round(minX + step * idx));
      });
      const newNodes = ctx.document.nodes.map((n) =>
        newMap.has(n.id) ? { ...n, x: newMap.get(n.id)! } : n
      );
      ctx.commit({ nodes: newNodes }, 'Distributed Horizontally');
    } else {
      const sorted = [...selected].sort((a, b) => a.y - b.y);
      const minY = sorted[0].y;
      const maxY = sorted[sorted.length - 1].y;
      const totalSpacing = maxY - minY;
      const step = totalSpacing / (sorted.length - 1);
      const newMap = new Map<string, number>();
      sorted.forEach((n, idx) => {
        newMap.set(n.id, Math.round(minY + step * idx));
      });
      const newNodes = ctx.document.nodes.map((n) =>
        newMap.has(n.id) ? { ...n, y: newMap.get(n.id)! } : n
      );
      ctx.commit({ nodes: newNodes }, 'Distributed Vertically');
    }
  }
}
