import type { ReactNode } from 'react';

/** The page title of an account screen, with its one optional line beneath. */
export function AuthHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-2">
      <h1 className="type-display">{title}</h1>
      {children && <p className="type-body text-ink-soft">{children}</p>}
    </div>
  );
}
