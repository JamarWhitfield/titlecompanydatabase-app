import LoginForm from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6">
          <div className="mb-5 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
              T
            </span>
            <span className="text-base font-semibold text-gray-900">
              Title Network
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Sign in
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Secure collaboration for title companies.
          </p>
        </div>
        <LoginForm message={message} />
      </div>
    </main>
  );
}
