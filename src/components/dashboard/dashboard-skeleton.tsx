import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <>
      <div className="border-b border-border/60">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-4 py-2.5 sm:px-6">
          <Skeleton className="h-9 w-28 rounded-full" />
          <Skeleton className="h-9 w-24 rounded-full" />
          <Skeleton className="ml-auto size-9 rounded-full" />
        </div>
      </div>

      <main className="mx-auto w-full max-w-3xl px-4 sm:px-6">
        <section className="pt-9 sm:pt-12">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <Skeleton className="h-3 w-36" />
              <Skeleton className="mt-3 h-11 w-52" />
            </div>
            <Skeleton className="size-10 rounded-full" />
          </div>
          <div className="mt-8 grid gap-2.5 sm:grid-cols-[1fr_auto]">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full sm:w-36" />
          </div>
          <Skeleton className="mt-3 h-[74px] w-full rounded-2xl" />
        </section>

        <div className="mt-10 space-y-7 border-t border-border/70 pt-6">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="flex gap-4">
              <div className="flex-1 space-y-2.5">
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-full max-w-md" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="size-10 shrink-0 rounded-full" />
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
