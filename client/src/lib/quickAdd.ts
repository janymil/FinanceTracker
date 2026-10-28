/**
 * One way to add a transaction, reachable from anywhere.
 *
 * The forms (typed, spoken, scanned) live once, in the top bar. Any other control that wants to
 * open one — the phone's bottom bar, an empty state — asks for it with `requestQuickAdd` instead of
 * mounting a second copy of the form.
 */
export type QuickAddMode = "type" | "voice" | "scan";

export const QUICK_ADD_EVENT = "kaptia:quick-add";

export function requestQuickAdd(mode: QuickAddMode): void {
  window.dispatchEvent(new CustomEvent<QuickAddMode>(QUICK_ADD_EVENT, { detail: mode }));
}
