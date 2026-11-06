'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import type { SetupView } from '@/lib/catalog/setup';
import { ReadingStep } from './ReadingStep';
import { FailedStep, RetakeStep, type RetakeUpload } from './RetakeStep';
import { ReviewStep } from './ReviewStep';

type FlowView = Exclude<SetupView, { step: 'live' }>;

/**
 * Reading → (retake | failed) → Review on one route. The server decides the step from the database;
 * this component only adds the moments in between (a retry or a retake that is uploading). The page
 * remounts it whenever the server's step changes, so local state never outlives its step.
 */
export function SetupFlow({ view }: { view: FlowView }) {
  const [rerun, setRerun] = useState<null | { upload?: RetakeUpload }>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const router = useRouter();
  const onUploadFailed = useCallback(
    (message: string) => {
      setRerun(null);
      setUploadError(message);
      // If the photos were saved but the reading then failed, the server now shows "try again" with
      // every saved page; a refused upload changes nothing there, so this screen and its error stay.
      router.refresh();
    },
    [router],
  );

  if (rerun) {
    return (
      <ReadingStep
        shopId={view.shopId}
        photoCount={!rerun.upload ? view.photoCount : rerun.upload.files.length + (rerun.upload.mode === 'add' ? view.photoCount : 0)}
        running={false}
        upload={rerun.upload}
        onUploadFailed={onUploadFailed}
      />
    );
  }

  switch (view.step) {
    case 'reading':
      return <ReadingStep shopId={view.shopId} photoCount={view.photoCount} running={view.running} />;
    case 'failed':
      return <FailedStep shopId={view.shopId} photoCount={view.photoCount} message={view.message} onRetry={() => setRerun({})} />;
    case 'unreadable':
      return (
        <RetakeStep
          shopId={view.shopId}
          photoCount={view.photoCount}
          reason={view.reason}
          tip={view.tip}
          error={uploadError}
          onUpload={(upload) => {
            setUploadError(null);
            setRerun({ upload });
          }}
        />
      );
    case 'review':
      return (
        <ReviewStep
          shopId={view.shopId}
          photoCount={view.photoCount}
          shop={view.shop}
          items={view.items}
          skipped={view.skipped}
          warnings={view.warnings}
          nonUsd={view.nonUsd}
          recorded={view.recorded}
        />
      );
  }
}
