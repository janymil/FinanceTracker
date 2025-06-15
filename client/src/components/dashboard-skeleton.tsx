export function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-2"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
        </div>
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
      </div>

      {/* Financial summary skeleton */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="text-center">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 mx-auto mb-2"></div>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-24 mx-auto"></div>
            </div>
          ))}
        </div>
      </div>

      {/* Analytics cards skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-48 bg-white dark:bg-gray-800 rounded-xl shadow-sm border"></div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="h-64 bg-white dark:bg-gray-800 rounded-xl shadow-sm border"></div>

      {/* Content grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="h-96 bg-white dark:bg-gray-800 rounded-xl shadow-sm border"></div>
        <div className="h-96 bg-white dark:bg-gray-800 rounded-xl shadow-sm border"></div>
      </div>
    </div>
  );
}