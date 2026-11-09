'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { afterHistoryMove, isOwnEntry, withOwnMark, withoutOwnMark } from './assistant-history';

/** The browser's own method, not Next's patch (see `setAssistantParam`): our entries have no router state of their own. */
function write(param: string, value: string | null, method: 'pushState' | 'replaceState') {
  const url = new URL(window.location.href);
  if (value === null) url.searchParams.delete(param);
  else url.searchParams.set(param, value);
  const state = method === 'pushState' ? withOwnMark(window.history.state) : withoutOwnMark(window.history.state);
  History.prototype[method].call(window.history, state, '', url);
}

const read = (param: string) => new URL(window.location.href).searchParams.get(param);

/**
 * A modal that belongs to the URL (`?item=<id>`, `?order=1`). Opened by tap it pushes an entry, so Back closes it and
 * its Close is `history.back()`. Loaded straight from a link it has no entry of its own, so Close rewrites the URL. Docked
 * (`docked()` true) it rewrites one entry and history moves don't touch it, as the assistant's dock.
 */
export function useHistoryParam(param: string, docked?: () => boolean) {
  const [value, setValue] = useState<string | null>(null);
  const current = useRef<string | null>(null);
  const ownEntry = useRef(false);
  const goingBack = useRef(false);
  const afterClose = useRef<(() => void) | null>(null);

  const set = useCallback((next: string | null) => {
    current.current = next;
    setValue(next);
  }, []);

  useEffect(() => {
    const inUrl = read(param);
    ownEntry.current = inUrl !== null && isOwnEntry(window.history.state);
    current.current = inUrl;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the URL is only readable after commit
    setValue(inUrl);
  }, [param]);

  useEffect(() => {
    const onPopState = () => {
      const closing = goingBack.current;
      const inUrl = read(param);
      const step = afterHistoryMove({ closing, docked: docked?.() ?? false, inUrl: inUrl !== null, ownMark: isOwnEntry(window.history.state), open: current.current !== null });
      goingBack.current = false;
      ownEntry.current = step.ownEntry;
      const next = step.open ? (inUrl ?? current.current) : null;
      if (next !== current.current) flushSync(() => set(next));
      if (step.fixUrl) write(param, next, 'replaceState');
      if (closing) runAfterClose();
    };
    const runAfterClose = () => {
      const after = afterClose.current;
      afterClose.current = null;
      // After the dialog's `close` event has put focus back on the opener.
      if (after) setTimeout(after, 0);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [param, docked, set]);

  const open = useCallback(
    (next: string, push: boolean) => {
      ownEntry.current = push;
      write(param, next, push ? 'pushState' : 'replaceState');
      set(next);
    },
    [param, set],
  );

  const close = useCallback(
    (after?: () => void) => {
      if (goingBack.current || current.current === null) return;
      afterClose.current = after ?? null;
      if (ownEntry.current) {
        goingBack.current = true;
        window.history.back();
        return;
      }
      write(param, null, 'replaceState');
      flushSync(() => set(null));
      if (after) {
        afterClose.current = null;
        setTimeout(after, 0);
      }
    },
    [param, set],
  );

  /** Off at once, without touching history: for the dock, whose entry is shared with the page. Safe when already closed. */
  const dismiss = useCallback(() => {
    if (current.current === null) return;
    write(param, null, 'replaceState');
    set(null);
  }, [param, set]);

  return { value, open, close, dismiss };
}
