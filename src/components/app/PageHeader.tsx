import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/icon';

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  back?: { href: string; label: string };
  status?: ReactNode;
  actions?: ReactNode;
}

/** The one header for every working screen: an optional back link, the page's H1, and its actions on the right. */
export function PageHeader({ title, description, back, status, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-1 pb-5 lg:pb-6 print:hidden">
      {back && (
        <Link
          href={back.href}
          aria-label={`Back to ${back.label}`}
          className="press-text -ml-1 inline-flex min-h-tap items-center gap-1.5 self-start px-1 text-sm font-semibold text-ink-soft hover:text-ink"
        >
          <Icon icon={ArrowLeft} size="sm" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 tabIndex={-1} className="type-page outline-none [overflow-wrap:anywhere]">
              {title}
            </h1>
            {status}
          </div>
          {description && <p className="text-ink-soft">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{actions}</div>}
      </div>
    </header>
  );
}
