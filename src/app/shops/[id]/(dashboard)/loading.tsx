// Dashboard loading skeleton (spec §4). Lives in a route group so it does not wrap /shops/[id]/setup or order detail.
// Shaped like the shell it stands in for: the shop's mark and name, the tabs, the filter, then rows with a thumbnail.
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <div aria-busy="true" className="mx-auto flex w-full max-w-wide flex-col gap-6 px-gutter pt-6 pb-section lg:pt-8">
      <span role="status" className="sr-only">Loading your orders</span>
      <div className="flex items-center gap-4">
        <Skeleton className="hidden size-14 shrink-0 sm:block" rounded="md" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-9 w-64 max-w-full" />
          <Skeleton className="h-4 w-44" rounded="full" />
        </div>
      </div>
      <div className="flex gap-7 border-b border-line pb-3">
        {['w-16', 'w-12', 'w-12', 'w-16'].map((w, i) => (
          <Skeleton key={i} className={`h-5 ${w}`} />
        ))}
      </div>
      <Skeleton className="h-13 w-full max-w-md" rounded="full" />
      <div className="flex flex-col divide-y divide-line overflow-hidden rounded-(--card-radius) shadow-(--card-shadow)">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-start gap-4 px-4 py-4 sm:px-5">
            <Skeleton className="size-14 shrink-0" rounded="md" />
            <div className="flex min-w-0 flex-1 flex-col gap-2 pt-1">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-48 max-w-full" />
              <Skeleton className="h-4 w-full max-w-sm" />
            </div>
            <Skeleton className="mt-1 h-4 w-14 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
