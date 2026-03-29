/**
 * SkeletonCard — placeholder for loading project/client list items
 */
export function SkeletonCard() {
  return (
    <div className="card flex items-center gap-5 pointer-events-none">
      <div className="skeleton rounded-full flex-shrink-0" style={{ width: 52, height: 52 }} />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-4 w-2/3 rounded" />
        <div className="skeleton h-3 w-1/2 rounded" />
      </div>
      <div className="space-y-2 flex-shrink-0 text-right">
        <div className="skeleton h-3 w-20 rounded" />
        <div className="skeleton h-3 w-14 rounded" />
      </div>
    </div>
  );
}

export function SkeletonStatCard() {
  return (
    <div className="card flex items-center gap-4 pointer-events-none">
      <div className="skeleton rounded-lg flex-shrink-0" style={{ width: 40, height: 40 }} />
      <div className="space-y-2 flex-1">
        <div className="skeleton h-6 w-10 rounded" />
        <div className="skeleton h-3 w-24 rounded" />
      </div>
    </div>
  );
}

export function SkeletonDetailHeader() {
  return (
    <div className="card mb-5 pointer-events-none">
      <div className="flex items-start gap-5">
        <div className="skeleton rounded-full flex-shrink-0" style={{ width: 64, height: 64 }} />
        <div className="flex-1 space-y-3 pt-1">
          <div className="skeleton h-5 w-1/2 rounded" />
          <div className="skeleton h-3 w-3/4 rounded" />
          <div className="skeleton h-3 w-1/3 rounded" />
        </div>
      </div>
      <div className="mt-5 pt-5 border-t border-white/5">
        <div className="skeleton h-8 w-full rounded-lg" />
      </div>
    </div>
  );
}
