import { PanelList } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';

export default function ShopsLoading() {
  return (
    <div aria-busy="true">
      <span role="status" className="sr-only">
        Loading your shops
      </span>
      <div className="flex items-center justify-between gap-4 pb-5 lg:pb-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-11 w-32" rounded="md" />
      </div>
      <PanelList>
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex min-h-22 items-center gap-4 px-(--row-pad-x) py-3">
            <Skeleton className="size-14 shrink-0" rounded="md" />
            <span className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-5 w-48 max-w-full" />
              <Skeleton className="h-3.5 w-20" />
            </span>
          </li>
        ))}
      </PanelList>
    </div>
  );
}
