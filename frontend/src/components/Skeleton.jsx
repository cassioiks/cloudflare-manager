export function SkeletonLine({ className = '' }) {
  return <div className={`animate-pulse bg-gray-200 rounded h-4 ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      <SkeletonLine className="w-1/3 h-6" />
      <div className="space-y-3">
        <SkeletonLine className="w-full" />
        <SkeletonLine className="w-full" />
        <SkeletonLine className="w-2/3" />
      </div>
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 py-3 px-4">
      <SkeletonLine className="w-12" />
      <SkeletonLine className="w-40" />
      <SkeletonLine className="w-32" />
      <SkeletonLine className="w-16" />
      <SkeletonLine className="w-16" />
    </div>
  );
}
