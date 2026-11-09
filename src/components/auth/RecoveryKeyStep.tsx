'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { markRecoverySaved } from '@/lib/client/auth';
import { RECOVERY_FILE_NAME, keyGroups, recoveryFileText } from '@/lib/client/recovery-file';

const DOWNLOADED_MS = 2000;

function downloadText(text: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface RecoveryKeyStepProps {
  recoveryKey: string;
  email: string;
  /** Where Continue goes. */
  next: string;
  appUrl: string;
}

/** Shown once, after sign-up, recovery or a new key. The key lives only in this component's props: never fetched again. */
export function RecoveryKeyStep({ recoveryKey, email, next, appUrl }: RecoveryKeyStepProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  const noted = useRef(false);
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => heading.current?.focus(), []);

  useEffect(() => {
    if (!downloaded) return;
    const t = setTimeout(() => setDownloaded(false), DOWNLOADED_MS);
    return () => clearTimeout(t);
  }, [downloaded]);

  /** Any of the three counts as saved; the banner elsewhere goes away. Once is enough, and a failure can try again. */
  const noteSaved = () => {
    if (noted.current) return;
    noted.current = true;
    markRecoverySaved().catch(() => {
      noted.current = false;
    });
  };

  const onDownload = () => {
    downloadText(recoveryFileText({ email, recoveryKey, appUrl }), RECOVERY_FILE_NAME);
    setDownloaded(true);
    noteSaved();
  };

  const onPrint = () => {
    noteSaved();
    window.print();
  };

  return (
    <div data-print-alone="" className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h1 ref={heading} tabIndex={-1} className="type-display outline-none">
          Save your recovery key
        </h1>
        <p className="type-body text-ink-soft">
          Shelfie doesn’t send email yet, so this is the only way back in if you forget your password. We can’t show it again.
        </p>
        <p className="type-body [overflow-wrap:anywhere]">
          You’ll log in with <span className="font-semibold">{email}</span>.
        </p>
      </div>

      <div className="rounded-lg bg-surface-sunken p-4">
        <span data-testid="recovery-key" className="sr-only">
          {recoveryKey}
        </span>
        <div aria-hidden="true" className="grid grid-cols-2 justify-items-center gap-x-4 gap-y-1.5 font-mono text-xl font-semibold sm:grid-cols-4">
          {keyGroups(recoveryKey).map((group) => (
            <span key={group}>{group}</span>
          ))}
        </div>
      </div>

      <p className="hidden type-body print:block">To reset your password, go to {appUrl.replace(/\/+$/, '')}/recover and enter this key.</p>

      <div className="grid grid-cols-2 gap-2 print:hidden">
        <Button variant="primary" icon={Download} status={downloaded ? 'success' : 'idle'} successLabel="Downloaded" onClick={onDownload}>
          Download
        </Button>
        <Button variant="secondary" onClick={() => window.location.replace(next)}>
          Continue
        </Button>
        <CopyButton text={recoveryKey} what="Recovery key" label="Copy" ghost onCopied={noteSaved} className="w-full" />
        <Button variant="ghost" icon={Printer} onClick={onPrint}>
          Print
        </Button>
      </div>
    </div>
  );
}
