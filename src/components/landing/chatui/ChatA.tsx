'use client';

import { useCallback, useMemo, type ReactNode } from 'react';
import { RotateCcw, X } from 'lucide-react';
import { IconButton } from '@/components/ui/icon-button';
import { FieldError } from '@/components/ui/field';
import { ActivityPanel } from '@/components/shop/ActivityPanel';
import { ApprovalCard, ConsoleComposer, isConversationFull } from '@/components/shop/BuyerConsole';
import { RichText } from '@/components/shop/RichText';
import type { Entry } from '@/components/shop/console-state';
import { cn } from '@/lib/utils';
import { BotMark } from '../BotMark';
import { ChatLog, type EntryContext } from './ChatLog';
import { quickReplies } from './order';
import { OnlineDot, TypingDots } from './parts';
import type { ChatVariantProps } from './types';
import './chat-a.css';

/** Which side of the conversation an entry sits on: the buyer's messages, or everything the assistant brings. */
const side = (e: Entry | undefined) => (e ? (e.kind === 'user' ? 'buyer' : 'bot') : null);

/** The assistant's column: the bot avatar on the first entry of a run, an empty slot of the same width after it. */
function BotRow({ first, children }: { first: boolean; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[1.75rem_minmax(0,1fr)] items-start gap-2">
      {first ? <BotMark className="mt-0.5 size-7" /> : <span aria-hidden />}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/**
 * Mockup A (`/?chatui=a`), "Refined compact": today's floating panel, perfected. An awning-scalloped blush header with
 * the bot and its live dot, bubbles with the bot's avatar once per run, quick replies over a pill composer, and the
 * order's PayPal card inside the flow.
 */
export function ChatA(props: ChatVariantProps) {
  const { api, shopName, starters, titleId, titleRef, inputRef, onClose, isDesktop, greeting } = props;
  const { state, send, reset } = api;
  const replies = quickReplies(state);
  const canRestart = !state.busy && state.entries.length > 0 && !isConversationFull(state);

  const empty = useMemo(
    () => (
      <div className="flex flex-col gap-3">
        <BotRow first>
          <p className="chat-a-bot-bubble w-fit text-base leading-6">{greeting}</p>
        </BotRow>
        <ul aria-label="Try asking" className="flex flex-wrap gap-2 pl-9">
          {starters.map((s) => (
            <li key={s} className="max-w-full">
              <button type="button" onClick={() => send(s)} className="chat-a-chip press min-h-tap text-left [--press-local:var(--press-scale-wide)]">
                {s}
              </button>
            </li>
          ))}
        </ul>
      </div>
    ),
    // `send` always does the same thing, however new the api object around it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [greeting, starters],
  );

  const typing = useMemo(
    () => (
      <div className="mt-4 grid grid-cols-[1.75rem_minmax(0,1fr)] items-end gap-2">
        <BotMark className="size-7" />
        <div className="chat-a-bot-bubble w-fit py-3">
          <TypingDots withBot={false} />
        </div>
      </div>
    ),
    [],
  );

  const renderEntry = useCallback(
    (entry: Entry, ctx: EntryContext) => {
      const mine = side(entry);
      const before = side(ctx.prev);
      // One run reads as a group: tight inside it, a clear gap where the speaker changes.
      const gap = before === null ? '' : before === mine ? 'pt-1.5' : 'pt-4';
      const first = before !== mine;
      switch (entry.kind) {
        case 'user':
          return (
            <div className={gap}>
              <p className={cn('chat-a-buyer-bubble ml-auto w-fit max-w-[85%] whitespace-pre-wrap [overflow-wrap:anywhere]', !first && 'rounded-tr-md')}>{entry.text}</p>
            </div>
          );
        case 'assistant':
          return (
            <div className={gap}>
              <BotRow first={first}>
                <div className={cn('chat-a-bot-bubble', !first && 'rounded-tl-md')}>
                  <RichText text={entry.text} className="text-sm leading-6 [overflow-wrap:anywhere]" />
                </div>
              </BotRow>
            </div>
          );
        case 'activity':
          return (
            <div className={gap}>
              <BotRow first={first}>
                <div className="chat-a-activity">
                  <ActivityPanel calls={entry.calls} collapsed={ctx.collapsed} />
                </div>
              </BotRow>
            </div>
          );
        case 'approval':
          return (
            <div className={gap}>
              <BotRow first={first}>
                <div className="chat-a-approval">
                  <ApprovalCard entry={entry} shopName={shopName} fresh={ctx.fresh} />
                </div>
              </BotRow>
            </div>
          );
        case 'error':
          return (
            <div className={gap}>
              <BotRow first={first}>
                <FieldError>{entry.message}</FieldError>
              </BotRow>
            </div>
          );
      }
    },
    [shopName],
  );

  return (
    <div data-chatui-root="a" className="chat-a grid h-full grid-rows-[auto_minmax(0,1fr)_auto] bg-surface">
      {/* A div, not <header>: it would be a landmark inside the dialog. */}
      <div className="chat-a-head relative z-[1] flex items-center gap-3 py-3 pr-2 pl-4">
        <span className="relative shrink-0">
          <BotMark className="size-11" />
          <OnlineDot className="chat-a-online" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 ref={titleRef} id={titleId} tabIndex={-1} className="font-display text-lg leading-6 font-bold tracking-tight outline-none">
            Shelfie assistant
          </h2>
          <p className="text-sm leading-5 text-ink-soft">
            <span className="font-semibold text-ok">Online</span>
            {isDesktop === false ? ` · ordering from ${shopName}, an example shop` : ` · ${shopName}, example shop`}
          </p>
        </div>
        {canRestart && <IconButton icon={RotateCcw} label="Start over" onClick={reset} className="text-ink-soft hover:bg-blush-ring/60" />}
        <IconButton icon={X} label="Close the chat" iconSize="md" onClick={onClose} className="text-ink-soft hover:bg-blush-ring/60" />
      </div>

      <div data-chat-a-scroll="" className="mt-2 overflow-y-auto overscroll-contain px-5 pt-4 pb-4">
        <ChatLog api={api} inputRef={inputRef} empty={empty} typing={typing} renderEntry={renderEntry} className="chat-a-log" />
      </div>

      <div className="flex flex-col gap-2.5 border-t border-line bg-surface px-3 pt-3 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
        {replies.length > 0 && (
          <ul aria-label="Quick replies" className="flex flex-wrap gap-2 px-1">
            {replies.map((r) => (
              <li key={r}>
                <button type="button" onClick={() => send(r)} className="chat-a-chip chat-a-chip-reply press min-h-tap [--press-local:var(--press-scale-wide)]">
                  {r}
                </button>
              </li>
            ))}
          </ul>
        )}
        <ConsoleComposer
          api={api}
          inputRef={inputRef}
          placeholder="Ask or order anything…"
          iconSend
          className="chat-a-composer flex items-end gap-1.5"
          boxClassName="block min-h-11 min-w-0 flex-1 resize-none overscroll-contain rounded-none border-0 bg-transparent px-0 py-2.5 hover:border-0 focus-visible:border-0 focus-visible:outline-none"
        />
        <p className="text-center text-xs leading-4 text-ink-muted">Example shop · sandbox payments, nothing is charged</p>
      </div>
    </div>
  );
}
