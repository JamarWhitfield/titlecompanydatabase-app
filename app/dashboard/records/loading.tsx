export default function Loading() {
  return (
    <div className="max-w-5xl animate-pulse">
      <div className="mb-6">
        <div className="h-7 w-48 rounded bg-gray-200" />
        <div className="mt-2 h-4 w-72 rounded bg-gray-100" />
      </div>
      <div className="mb-4 flex gap-2">
        <div className="h-9 w-56 rounded-lg bg-gray-200" />
        <div className="h-9 w-32 rounded-lg bg-gray-200" />
        <div className="h-9 w-32 rounded-lg bg-gray-200" />
      </div>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
          <div className="h-3 w-64 rounded bg-gray-200" />
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-gray-100 px-4 py-4 last:border-0">
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-48 rounded bg-gray-200" />
              <div className="h-3 w-32 rounded bg-gray-100" />
            </div>
            <div className="h-5 w-16 rounded-full bg-gray-200" />
            <div className="h-5 w-14 rounded-full bg-gray-200" />
            <div className="h-3 w-20 rounded bg-gray-100" />
            <div className="h-7 w-24 rounded bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
