import { Topbar } from "@/components/layout/topbar";
import { AdminSidebar } from "@/components/admin/sidebar";

// SECURITY: the admin console intentionally has no sign-in or role check
// here, by explicit product decision — see README.md "Admin console has no
// login" for why, and the one-line revert if that decision changes. Every
// admin page and API route under here reads/writes with the Supabase
// service-role client (src/lib/supabase/admin.ts), bypassing RLS, because
// there is no user session for RLS to authorize against.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Topbar />
      <div className="flex flex-1 min-h-0">
        <AdminSidebar role="admin" />
        <main className="flex-1 min-w-0 px-8 py-7">{children}</main>
      </div>
    </>
  );
}
