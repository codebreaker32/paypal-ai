import type { ReactNode } from 'react';

/** Sign-up, login and recovery: one centred column at every width, no photo. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col px-gutter pt-8 pb-section lg:pt-16">
      <div className="mx-auto w-full max-w-(--auth-form-w)">{children}</div>
    </div>
  );
}
