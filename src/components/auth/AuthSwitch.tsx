import Link from 'next/link';

/** The other door (log in / add your shop), centred under the form's primary button, not in the header. */
export function AuthSwitch({ prompt, label, href }: { prompt: string; label: string; href: string }) {
  return (
    <p className="text-center text-[0.9375rem] text-ink-soft">
      {prompt}{' '}
      <Link
        href={href}
        className="press-text inline-flex min-h-tap items-center px-1 font-semibold text-accent-ink underline-offset-4 decoration-2 hover:underline focus-visible:underline"
      >
        {label}
      </Link>
    </p>
  );
}
