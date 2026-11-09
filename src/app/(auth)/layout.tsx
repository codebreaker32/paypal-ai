import type { ReactNode } from 'react';

/** Sign-up, login and recovery: one centred column at every width, no photo. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col px-gutter pt-8 pb-section lg:pt-16">
      <div className="mx-auto w-full max-w-(--auth-form-w)">
        <noscript>
          <p className="mb-6 type-body">Shelfie needs JavaScript for this page. Turn it on and reload.</p>
        </noscript>
        {children}
      </div>
    </div>
  );
}
