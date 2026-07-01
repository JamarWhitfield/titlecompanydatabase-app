import RegisterForm from "./RegisterForm";
import { createClient } from "@/lib/supabase/server";

type InviteInfo = {
  token: string;
  email: string;
  companyName: string;
  role: "admin" | "member";
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite: token } = await searchParams;

  let invite: InviteInfo | null = null;
  let inviteError = false;

  if (token) {
    const supabase = await createClient();
    // Public SECURITY DEFINER reader — returns nothing for an invalid or
    // expired token, exposing only the single matching invitation.
    const { data } = await supabase.rpc("get_invitation_by_token", {
      invite_token: token,
    });
    const row = data?.[0];
    if (row) {
      invite = {
        token,
        email: row.email,
        companyName: row.company_name,
        role: row.role,
      };
    } else {
      inviteError = true;
    }
  }

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
            {invite ? "Join your team" : "Register your company"}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {invite ? (
              <>
                You&apos;ve been invited to join{" "}
                <span className="font-medium text-gray-700">
                  {invite.companyName}
                </span>
                .
              </>
            ) : (
              "Secure collaboration for title companies."
            )}
          </p>
        </div>

        {inviteError && (
          <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
            This invitation link is invalid or has expired. You can still
            register your own company below.
          </p>
        )}

        <RegisterForm invite={invite} />
      </div>
    </main>
  );
}
