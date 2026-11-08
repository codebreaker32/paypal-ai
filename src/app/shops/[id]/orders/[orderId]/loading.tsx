// Order detail's loading skeleton, shaped like the page: the list beside it on desktop, then the header and the two
// columns of sections. layout.tsx has already decided this is the owner's order.
import { Skeleton } from '@/components/ui/skeleton';

export default function OrderDetailLoading() {
  return (
    <div aria-busy="true" className="mx-auto grid w-full max-w-wide items-start gap-8 px-gutter pt-4 pb-section lg:grid-cols-[21rem_minmax(0,1fr)] lg:pt-8">
      <span role="status" className="sr-only">
        Loading this order
      </span>
      <div className="hidden flex-col gap-0.5 border-r border-line pr-3 lg:flex">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5">
            <Skeleton className="size-10 shrink-0" rounded="md" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-3 w-32 max-w-full" />
            </div>
          </div>
        ))}
      </div>
      <div className="flex min-w-0 flex-col gap-6">
        <Skeleton className="mt-3 h-4 w-16" />
        <div className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
          <div className="flex min-w-0 flex-col gap-3">
            <Skeleton className="h-9 w-56 max-w-full" />
            <Skeleton className="h-4 w-44" />
          </div>
          <Skeleton className="h-9 w-24 sm:shrink-0" />
        </div>
        <div className="flex flex-col gap-5 lg:grid lg:grid-cols-12 lg:items-start lg:gap-6">
          <div className="flex flex-col gap-3 border-t border-line pt-5 lg:col-span-7">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-full max-w-sm" />
            <Skeleton className="h-4 w-full max-w-xs" />
          </div>
          <div className="flex flex-col gap-3 border-t border-line pt-5 lg:col-span-5">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-full max-w-64" />
            <Skeleton className="h-11 w-full" rounded="full" />
          </div>
        </div>
      </div>
    </div>
  );
}
