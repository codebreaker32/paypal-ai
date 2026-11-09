import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Icon } from '@/components/ui/icon';

export const BANNER_ACTION = 'press-text inline-flex min-h-tap items-center font-semibold whitespace-nowrap text-warn underline decoration-2 underline-offset-4';

/** The one banner look: the shell's banner slot and the list of shops. */
export function Banner({ icon, action, children }: { icon: LucideIcon; action?: ReactNode; children: ReactNode }) {
  return (
    <div role="status" data-shell-banner="" className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-(--card-radius) bg-warn-soft px-4 py-3 text-warn print:hidden">
      <div className="flex min-w-0 flex-1 basis-64 items-start gap-3">
        <Icon icon={icon} className="mt-0.5" />
        <p>{children}</p>
      </div>
      {action}
    </div>
  );
}
