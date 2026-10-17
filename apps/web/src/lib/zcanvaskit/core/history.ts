export interface HistorySnapshot<T> {
  state: T;
  timestamp: number;
}

export class ZCanvasHistory<T> {
  private undoStack: HistorySnapshot<T>[] = [];
  private redoStack: HistorySnapshot<T>[] = [];
  private maxDepth: number;

  constructor(maxDepth = 50) {
    this.maxDepth = maxDepth;
  }

  public push(state: T): void {
    const snapshot: HistorySnapshot<T> = {
      state: JSON.parse(JSON.stringify(state)),
      timestamp: Date.now(),
    };
    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.maxDepth) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  public undo(currentState: T): T | null {
    if (this.undoStack.length === 0) return null;
    const currentSnapshot: HistorySnapshot<T> = {
      state: JSON.parse(JSON.stringify(currentState)),
      timestamp: Date.now(),
    };
    this.redoStack.push(currentSnapshot);
    const prev = this.undoStack.pop();
    return prev ? prev.state : null;
  }

  public redo(currentState: T): T | null {
    if (this.redoStack.length === 0) return null;
    const currentSnapshot: HistorySnapshot<T> = {
      state: JSON.parse(JSON.stringify(currentState)),
      timestamp: Date.now(),
    };
    this.undoStack.push(currentSnapshot);
    const next = this.redoStack.pop();
    return next ? next.state : null;
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
