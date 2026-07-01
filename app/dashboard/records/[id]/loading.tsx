export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl animate-pulse">
      <div className="h-4 w-32 rounded bg-gray-100" />
      <div className="mt-3 flex items-center gap-2">
        <div className="h-7 w-64 rounded bg-gray-200" />
        <div className="h-5 w-16 rounded-full bg-gray-200" />
        <div className="h-5 w-16 rounded-full bg-gray-200" />
      </div>
      <div className="mt-2 h-4 w-40 rounded bg-gray-100" />

      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
        <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-3 w-24 rounded bg-gray-100" />
              <div className="h-4 w-36 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 space-y-2">
        <div className="h-4 w-28 rounded bg-gray-100" />
        {[...Array(2)].map((_, i) => (
          <div
            key={i}
            className="h-12 rounded-lg border border-gray-200 bg-white"
          />
        ))}
      </div>
    </div>
  );
}
