import { cn } from '@/lib/utils';

/** "The assistant is typing": three rising dots, announced once to screen readers. */
export function TypingDots({ className }: { className?: string }) {
  return (
    <p role="status" className={cn('flex items-center text-ink-muted', className)}>
      <span className="home-chat-typing" aria-hidden>
        <span />
        <span />
        <span />
      </span>
      <span className="sr-only">The assistant is typing</span>
    </p>
  );
}

/** A small green dot that breathes; its word for screen readers is left to the caller. */
export function OnlineDot({ className }: { className?: string }) {
  return <span aria-hidden className={cn('home-chat-online', className)} />;
}
