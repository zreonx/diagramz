export interface HistoryEntry<T> {
  state: T;
  description?: string;
  timestamp: number;
}

export class TransactionHistory<T> {
  private undoStack: HistoryEntry<T>[] = [];
  private redoStack: HistoryEntry<T>[] = [];
  private activeTransactionInitial: T | null = null;
  private maxDepth: number;

  constructor(maxDepth = 50) {
    this.maxDepth = maxDepth;
  }

  public beginTransaction(initialState: T): void {
    if (this.activeTransactionInitial === null) {
      this.activeTransactionInitial = JSON.parse(JSON.stringify(initialState));
    }
  }

  public commitTransaction(finalState: T, description?: string): void {
    if (this.activeTransactionInitial !== null) {
      const initial = this.activeTransactionInitial;
      this.activeTransactionInitial = null;

      // Don't record no-ops
      if (JSON.stringify(initial) === JSON.stringify(finalState)) {
        return;
      }

      this.undoStack.push({
        state: initial,
        description,
        timestamp: Date.now(),
      });
      if (this.undoStack.length > this.maxDepth) {
        this.undoStack.shift();
      }
      this.redoStack = [];
    }
  }

  public abortTransaction(): T | null {
    if (this.activeTransactionInitial !== null) {
      const reverted = this.activeTransactionInitial;
      this.activeTransactionInitial = null;
      return reverted;
    }
    return null;
  }

  public isTransactionActive(): boolean {
    return this.activeTransactionInitial !== null;
  }

  public push(currentState: T, description?: string): void {
    this.undoStack.push({
      state: JSON.parse(JSON.stringify(currentState)),
      description,
      timestamp: Date.now(),
    });
    if (this.undoStack.length > this.maxDepth) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  public undo(currentState: T): T | null {
    if (this.undoStack.length === 0) return null;
    const previous = this.undoStack.pop()!;
    this.redoStack.push({
      state: JSON.parse(JSON.stringify(currentState)),
      description: previous.description,
      timestamp: Date.now(),
    });
    return previous.state;
  }

  public redo(currentState: T): T | null {
    if (this.redoStack.length === 0) return null;
    const next = this.redoStack.pop()!;
    this.undoStack.push({
      state: JSON.parse(JSON.stringify(currentState)),
      description: next.description,
      timestamp: Date.now(),
    });
    return next.state;
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
    this.activeTransactionInitial = null;
  }
}
