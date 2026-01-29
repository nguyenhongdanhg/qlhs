import { memo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export const DashboardSkeleton = memo(function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      {/* Stats Cards - Simple skeleton */}
      <div className="grid gap-2 sm:gap-3 grid-cols-2 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-card rounded-xl p-4 shadow-md">
            <Skeleton className="h-10 w-10 rounded-xl mb-2 mx-auto" />
            <Skeleton className="h-6 w-12 mx-auto mb-1" />
            <Skeleton className="h-3 w-16 mx-auto" />
          </div>
        ))}
      </div>

      {/* Quick Actions - Simple skeleton */}
      <div className="grid gap-2 sm:gap-3 grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-card rounded-xl p-4 shadow-md flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="bg-card rounded-xl p-4 shadow-md">
          <Skeleton className="h-4 w-32 mb-3" />
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((j) => (
              <Skeleton key={j} className="h-16 rounded-xl" />
            ))}
          </div>
        </div>
        <div className="bg-card rounded-xl p-4 shadow-md">
          <Skeleton className="h-4 w-32 mb-3" />
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((j) => (
              <Skeleton key={j} className="h-16 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});
