/**
 * One way to add a transaction, reachable from anywhere.
 *
 * The forms (typed, spoken, scanned) live once, in the top bar. Any other control that wants to
 * open one — the phone's bottom bar, an empty state, "Add income" on the Income page, a day on the
 * calendar — asks for it with `requestQuickAdd` instead of mounting a second copy of the form. A
 * preset fills in what the place already knows (the type, the day).
 */
export type QuickAddMode = "type" | "voice" | "scan";

export interface QuickAddPreset {
  type?: "income" | "expense";
  /** "yyyy-MM-dd" */
  date?: string;
}

export interface QuickAddRequest {
  mode: QuickAddMode;
  preset?: QuickAddPreset;
}

export const QUICK_ADD_EVENT = "kaptia:quick-add";

export function requestQuickAdd(mode: QuickAddMode, preset?: QuickAddPreset): void {
  window.dispatchEvent(new CustomEvent<QuickAddRequest>(QUICK_ADD_EVENT, { detail: { mode, preset } }));
}
