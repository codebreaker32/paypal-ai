// Dashboard loading skeleton (spec §4). Lives in a route group so it does not wrap /shops/[id]/setup or order detail.
import { Skeleton } from '@/components/ui/Skeleton';

export default function DashboardLoading() {
  return (
    <div aria-busy="true" className="mx-auto flex w-full max-w-page flex-col gap-6 px-gutter pt-4 pb-section lg:pt-8">
      <span role="status" className="sr-only">Loading your orders</span>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-5 w-40" rounded="full" />
      </div>
      <Skeleton className="h-11 w-full max-w-sm" rounded="md" />
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28 w-full" rounded="md" />
        ))}
      </div>
    </div>
  );
}
