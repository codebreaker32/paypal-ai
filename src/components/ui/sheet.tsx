'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './icon-button';
import { cn } from '@/lib/utils';

export interface SheetProps {
  open: boolean;
  /** Called on Esc, the close button, or a tap on the backdrop. */
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  /** Actions pinned to the bottom, e.g. a primary Button. */
  footer?: ReactNode;
  className?: string;
}

/**
 * Bottom sheet on phones, centred dialog from 640 px up. Built on the native modal <dialog>:
 * the page behind is inert (focus stays inside), Esc closes it, and focus returns to the opener.
 */
export function Sheet({ open, onClose, title, description, children, footer, className }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleClose = () => opener.current?.focus();
    const handleCancel = (e: Event) => {
      // Let the parent own the open state: close through onClose so state and DOM stay in step.
      e.preventDefault();
      onCloseRef.current();
    };
    dialog.addEventListener('close', handleClose);
    dialog.addEventListener('cancel', handleCancel);
    return () => {
      dialog.removeEventListener('close', handleClose);
      dialog.removeEventListener('cancel', handleCancel);
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={cn(
        'fixed inset-x-0 bottom-0 top-auto m-0 w-full max-w-full max-h-[90dvh] p-0',
        'rounded-t-(--sheet-radius) bg-(--sheet-bg) text-ink shadow-(--sheet-shadow)',
        'sm:inset-0 sm:m-auto sm:h-fit sm:max-w-(--sheet-max-w) sm:rounded-(--sheet-radius)',
        'open:animate-rise-in',
        className,
      )}
    >
      <div className="flex max-h-[90dvh] flex-col pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-start gap-3 px-5 pt-5 sm:px-6 sm:pt-6">
          <div className="flex-1 pt-1.5">
            <h2 id={titleId} className="type-heading">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-ink-soft">
                {description}
              </p>
            )}
          </div>
          <IconButton icon={X} label="Close" iconSize="md" onClick={onClose} className="-mr-2" />
        </div>
        <div className="overflow-y-auto px-5 py-4 sm:px-6">{children}</div>
        {footer && <div className="border-t border-line px-5 py-4 sm:px-6">{footer}</div>}
      </div>
    </dialog>
  );
}
