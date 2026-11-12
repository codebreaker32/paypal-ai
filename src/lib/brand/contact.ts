// Who to contact, on /help: SUPPORT_EMAIL when the deployment sets it, else the repository's issues.
import { REPO_URL } from '@/lib/brand/footer';

export interface Contact {
  kind: 'email' | 'issues';
  href: string;
  label: string;
}

export function contactFor(supportEmail: string | null | undefined): Contact {
  if (supportEmail) return { kind: 'email', href: `mailto:${supportEmail}`, label: supportEmail };
  return { kind: 'issues', href: `${REPO_URL}/issues`, label: 'GitHub Issues' };
}
