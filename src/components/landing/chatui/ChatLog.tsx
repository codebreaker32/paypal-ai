'use client';

import { memo, useState, type ReactNode, type RefObject } from 'react';
import { RotateCcw } from 'lucide-react';
import { m } from 'motion/react';
import { Button } from '@/components/ui/button';
import { EASE_OUT, MOTION_S } from '@/components/motion/tokens';
import { isConversationFull, useConversationScroll, type BuyerConsoleApi } from '@/components/shop/BuyerConsole';
import { collapsedActivityKeys, firstFreshEntry, type Entry } from '@/components/shop/console-state';
import { cn } from '@/lib/utils';

export interface EntryContext {
  /** Arrived during this view (rises in), not restored. */
  fresh: boolean;
  /** An Activity step folded to one line (an older step of the turn). */
  collapsed: boolean;
  /** The entry before this one, so a mockup can group consecutive messages from one side. */
  prev: Entry | undefined;
  next: Entry | undefined;
}

export interface ChatLogProps {
  api: BuyerConsoleApi;
  inputRef?: RefObject<HTMLElement | null>;
  /** The empty conversation: greeting and starters. */
  empty: ReactNode;
  renderEntry: (entry: Entry, ctx: EntryContext) => ReactNode;
  /** Shown while the assistant is thinking and no tool call is running. */
  typing: ReactNode;
  className?: string;
}

/**
 * The console's conversation with the look left to the caller: the same entries, scroll rules (console-scroll.ts),
 * entrances and "Start a new conversation" as `ConsoleConversation`, drawn by each `?chatui=` mockup its own way.
 */
function Log({ api, inputRef, empty, renderEntry, typing, className }: ChatLogProps) {
  const { state, reset } = api;
  const { end, log } = useConversationScroll(state, inputRef);
  const last = state.entries.at(-1);
  const calling = last?.kind === 'activity' && last.calls.some((c) => c.status === 'running');
  const full = isConversationFull(state);
  const [shownAtOpen, setShownAtOpen] = useState(state.entries.length);
  if (shownAtOpen > 0 && state.entries.length === 0) setShownAtOpen(0);
  const freshFrom = firstFreshEntry(state, shownAtOpen);
  const collapsedKeys = collapsedActivityKeys(state.entries);

  if (!state.entries.length) return <>{empty}</>;

  return (
    <div className={cn('flex flex-col', className)}>
      <div ref={log} role="log" aria-label="Conversation" className={cn('flex flex-col', className)}>
        {state.entries.map((entry, i) => {
          const fresh = i >= freshFrom;
          return (
            <m.div
              key={entry.key}
              data-entrance=""
              data-entry={entry.kind}
              initial={fresh ? { opacity: 0, y: 8 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: MOTION_S.base, ease: EASE_OUT }}
            >
              {renderEntry(entry, { fresh, collapsed: collapsedKeys.has(entry.key), prev: state.entries[i - 1], next: state.entries[i + 1] })}
            </m.div>
          );
        })}
      </div>
      {state.busy && !calling && typing}
      {!state.busy && full && (
        <div>
          <Button variant="primary" icon={RotateCcw} onClick={reset}>
            Start a new conversation
          </Button>
        </div>
      )}
      <div ref={end} />
    </div>
  );
}

/** Re-renders only when the conversation changes (not on every keystroke in the message box). */
export const ChatLog = memo(Log, (a, b) => a.api.state === b.api.state && a.empty === b.empty && a.renderEntry === b.renderEntry && a.typing === b.typing && a.className === b.className && a.inputRef === b.inputRef);
