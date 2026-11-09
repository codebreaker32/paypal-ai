import Link from 'next/link';
import { FieldError } from '@/components/ui/field';
import type { AuthProblem } from '@/lib/client/auth-copy';

/** An error sentence, with its links. */
export function AuthProblemText({ problem }: { problem: AuthProblem }) {
  return (
    <>
      {problem.message.map((bit, i) =>
        typeof bit === 'string' ? (
          <span key={i}>{bit}</span>
        ) : (
          <Link key={i} href={bit.href} className="press-text font-semibold underline underline-offset-2">
            {bit.text}
          </Link>
        ),
      )}
    </>
  );
}

/** A problem that belongs to no one field: said above the submit button. */
export function FormProblem({ problem }: { problem: AuthProblem | null }) {
  if (problem?.field !== 'form') return null;
  return (
    <FieldError>
      <AuthProblemText problem={problem} />
    </FieldError>
  );
}
