import Link from "next/link";

// Root page — redirects authenticated users to /dashboard via middleware.
// Unauthenticated users see this marketing-style landing stub.
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-50 p-8">
      <div className="flex items-center gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-lg font-bold text-white">
          T
        </span>
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">
          Title Network
        </h1>
      </div>
      <p className="max-w-md text-center text-base text-gray-600">
        Secure collaboration for title companies &mdash; manage your records
        privately and share selected records through a trusted network.
      </p>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          Log in
        </Link>
        <Link
          href="/register"
          className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          Register your company
        </Link>
      </div>
    </main>
  );
}
