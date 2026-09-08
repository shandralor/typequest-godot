// Undo/redo command stack (copied from world-of-claudecraft src/editor/undo_core.ts). Pure and
// DOM-free: commands are do/undo closures over the document plus the view refreshes the app
// supplies. Capped so a long session cannot grow without bound.

export interface EditorCommand {
  /** Stable machine label (debugging / tests); never rendered raw. */
  label: string;
  undo(): void;
  redo(): void;
}

export const UNDO_STACK_CAP = 200;

export class UndoStack {
  private readonly done: EditorCommand[] = [];
  private readonly undone: EditorCommand[] = [];

  constructor(private readonly cap: number = UNDO_STACK_CAP) {}

  /** Record an ALREADY-applied command (the caller performs the initial edit; `redo` must reproduce it). */
  push(cmd: EditorCommand): void {
    this.done.push(cmd);
    this.undone.length = 0;
    const over = this.done.length - this.cap;
    if (over > 0) this.done.splice(0, over);
  }

  undo(): EditorCommand | null {
    const cmd = this.done.pop();
    if (!cmd) return null;
    cmd.undo();
    this.undone.push(cmd);
    return cmd;
  }

  redo(): EditorCommand | null {
    const cmd = this.undone.pop();
    if (!cmd) return null;
    cmd.redo();
    this.done.push(cmd);
    return cmd;
  }

  get depth(): number {
    return this.done.length;
  }
  get canUndo(): boolean {
    return this.done.length > 0;
  }
  get canRedo(): boolean {
    return this.undone.length > 0;
  }
  clear(): void {
    this.done.length = 0;
    this.undone.length = 0;
  }
}
