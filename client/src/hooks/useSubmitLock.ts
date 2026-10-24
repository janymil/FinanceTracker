import { useCallback, useRef } from 'react';

/**
 * A ref-based submit lock for money forms.
 *
 * Why not React state: two clicks in the same tick run before the component re-renders,
 * so an `isPending` check is still false on the second click. That is exactly how
 * "Add expense" created **two** transactions — found by the E2E double-click test.
 *
 * The lock is released when the mutation settles (per-call `onSettled`), with a timer as
 * a safety net so a lost callback can never leave the form permanently blocked.
 */
export function useSubmitLock() {
  const locked = useRef(false);

  return useCallback((task: (release: () => void) => void) => {
    if (locked.current) return;
    locked.current = true;

    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      locked.current = false;
    };

    const timer = setTimeout(release, 15_000);
    const finish = () => {
      clearTimeout(timer);
      release();
    };

    try {
      task(finish);
    } catch {
      finish();
    }
  }, []);
}
