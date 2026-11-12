// Dashboard loading skeleton, drawn inside the app shell: the page title, the filter, then order rows.
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <span role="status" className="sr-only">Loading your orders</span>
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-11 w-full max-w-md" rounded="full" />
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
