import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function DashboardSkeleton() {
  return (
    <div className="content-wrapper animate-fade-in">
      {/* School Banner Skeleton */}
      <Card className="mb-4 sm:mb-6 overflow-hidden border-0 shadow-lg">
        <div className="bg-gradient-to-r from-primary via-primary/90 to-accent">
          <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:p-6 gap-3 sm:gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <Skeleton className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-white/20" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-40 bg-white/20" />
                <Skeleton className="h-4 w-32 bg-white/20" />
              </div>
            </div>
            <Skeleton className="h-16 w-24 rounded-xl bg-white/10" />
          </CardContent>
        </div>
      </Card>

      {/* Stats Cards Skeleton */}
      <div className="grid gap-2 sm:gap-3 grid-cols-2 md:grid-cols-4 mb-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border-0 shadow-md overflow-hidden">
            <CardContent className="p-3 sm:p-4 flex flex-col items-center text-center">
              <Skeleton className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl mb-2" />
              <Skeleton className="h-6 w-12 mb-1" />
              <Skeleton className="h-3 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions Skeleton */}
      <div className="grid gap-2 sm:gap-3 grid-cols-2 lg:grid-cols-4 mb-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border-0 shadow-md">
            <CardContent className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4">
              <Skeleton className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl shrink-0" />
              <Skeleton className="h-4 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Today Progress Skeleton */}
      <Card className="mb-4 border-0 shadow-md">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-7 rounded-lg" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-6 w-10 rounded-full" />
          </div>
          <div className="grid gap-4 grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Skeleton className="h-3.5 w-3.5 rounded" />
                  <Skeleton className="h-3 w-14" />
                </div>
                <div className="flex flex-wrap gap-1">
                  <Skeleton className="h-5 w-10 rounded-full" />
                  <Skeleton className="h-5 w-10 rounded-full" />
                  <Skeleton className="h-5 w-10 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Bottom Grid Skeleton */}
      <div className="grid gap-3 lg:grid-cols-2">
        {[1, 2].map((i) => (
          <Card key={i} className="border-0 shadow-md">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-3">
                <Skeleton className="h-7 w-7 rounded-lg" />
                <Skeleton className="h-4 w-32" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="text-center p-3 rounded-xl bg-muted/30">
                    <Skeleton className="h-3 w-10 mx-auto mb-1" />
                    <Skeleton className="h-6 w-8 mx-auto" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Grade Stats Skeleton */}
      <Card className="mt-4 border-0 shadow-md">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="h-7 w-7 rounded-lg" />
            <Skeleton className="h-4 w-36" />
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="text-center p-2 sm:p-3 rounded-xl bg-muted/30">
                <Skeleton className="h-3 w-12 mx-auto mb-1" />
                <Skeleton className="h-5 w-6 mx-auto mb-1" />
                <Skeleton className="h-2.5 w-14 mx-auto" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
