import { Skeleton } from "@/components/ui/skeleton";

export function RouteLoading() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading page">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56 max-w-[70vw]" />
        </div>
        <Skeleton className="h-11 w-11 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-24 rounded-2xl" />)}
      </div>
      <Skeleton className="h-52 rounded-2xl" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
