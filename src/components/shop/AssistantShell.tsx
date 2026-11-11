'use client';

import type { ReactNode, RefObject } from 'react';
import { X } from 'lucide-react';
import { LogoMark } from '@/components/brand/Logo';
import { IconButton } from '@/components/ui/icon-button';
import { ConsoleActions, ConsoleComposer, ConsoleConversation, type BuyerConsoleApi } from './BuyerConsole';
import './assistant-shell.css';

export interface AssistantShellProps {
  api: BuyerConsoleApi;
  title: string;
  /** The heading's id, so the dock or sheet around it can be named by it. */
  titleId: string;
  titleRef?: RefObject<HTMLHeadingElement | null>;
  shopName: string;
  starters: string[];
  inputRef?: RefObject<HTMLTextAreaElement | null>;
  /** False for a shop that isn't taking orders: the console greets with questions only. */
  takesOrders: boolean;
  onClose: () => void;
  /** The line under the title; the shop page's is "Shelfie assistant · powered by Claude" (one name, as on home). */
  subtitle?: string;
  /** The picture beside the title; the shop page's is the Shelfie mark. */
  mark?: ReactNode;
  /** Replaces the console's opening line (see `ConsoleConversation`). */
  greeting?: ReactNode;
  closeLabel?: string;
}

/**
 * The assistant's one layout, for all three forms (dock, side sheet, bottom sheet): a header, a scroller that keeps its
 * content at the bottom, and a footer that never moves. The conversation is the only part that scrolls.
 */
export function AssistantShell({
  api,
  title,
  titleId,
  titleRef,
  shopName,
  starters,
  inputRef,
  takesOrders,
  onClose,
  subtitle,
  mark,
  greeting,
  closeLabel = 'Close the assistant',
}: AssistantShellProps) {
  return (
    <div className="grid h-full grid-rows-[auto_minmax(0,1fr)_auto]">
      {/* A div, not <header>: it would be a landmark inside the dialog. */}
      <div data-assistant-header="" className="flex h-(--assistant-header-h) items-center gap-3 border-b border-line px-5">
        {mark ?? <LogoMark className="size-8 max-[22.5rem]:hidden" />}
        <div className="min-w-0 flex-1">
          <h2 ref={titleRef} id={titleId} tabIndex={-1} className="type-heading truncate outline-none">
            {title}
          </h2>
          <p data-assistant-subtitle="" className="type-meta truncate text-ink-muted">
            {subtitle ?? 'Shelfie assistant · powered by Claude'}
          </p>
        </div>
        <IconButton icon={X} label={closeLabel} iconSize="md" onClick={onClose} className="-mr-2" />
      </div>

      <div className="overflow-y-auto overscroll-contain px-5 py-4 [scrollbar-gutter:stable]">
        <div data-assistant-log="" className="flex min-h-full flex-col justify-end">
          <ConsoleConversation api={api} shopName={shopName} starters={starters} takesOrders={takesOrders} inputRef={inputRef} greeting={greeting} />
        </div>
      </div>

      <div data-assistant-footer="" className="flex flex-col gap-3 border-t border-line bg-surface px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <ConsoleActions api={api} />
        <ConsoleComposer api={api} inputRef={inputRef} />
      </div>
    </div>
  );
}
