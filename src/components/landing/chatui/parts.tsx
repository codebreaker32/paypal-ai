import { BotMark } from '../BotMark';
import { cn } from '@/lib/utils';

/** "The assistant is typing": the bot and three rising dots, announced once to screen readers. */
export function TypingDots({ className, withBot = true }: { className?: string; withBot?: boolean }) {
  return (
    <p role="status" className={cn('flex items-center gap-2.5 text-ink-muted', className)}>
      {withBot && <BotMark className="size-7" />}
      <span className="chatui-dots" aria-hidden>
        <span />
        <span />
        <span />
      </span>
      <span className="sr-only">The assistant is typing</span>
    </p>
  );
}

/** A small green dot that breathes, with its word for screen readers left to the caller. */
export function OnlineDot({ className }: { className?: string }) {
  return <span aria-hidden className={cn('chatui-online', className)} />;
}
