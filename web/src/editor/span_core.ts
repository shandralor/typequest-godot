// Contiguous-span bookkeeping for undo over appended batches (copied from world-of-claudecraft).
// A batch APPENDS contiguously, so undo removes the whole span with one splice; if anything
// shifted, fall back to per-item identity removal so undo never deletes the wrong entries.

export function appendSpan<T>(arr: T[], items: readonly T[]): number {
  const start = arr.length;
  arr.push(...items);
  return start;
}

export function removeSpan<T>(arr: T[], start: number, items: readonly T[]): void {
  if (items.length === 0) return;
  let contiguous = start >= 0 && start + items.length <= arr.length;
  if (contiguous) {
    for (let i = 0; i < items.length; i++) {
      if (arr[start + i] !== items[i]) {
        contiguous = false;
        break;
      }
    }
  }
  if (contiguous) {
    arr.splice(start, items.length);
    return;
  }
  for (const item of items) {
    const i = arr.indexOf(item);
    if (i >= 0) arr.splice(i, 1);
  }
}
