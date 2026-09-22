import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { Topbar } from "@/components/layout/topbar";
import { AdminSidebar } from "@/components/admin/sidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "admin" && user.role !== "support") redirect("/dashboard");

  return (
    <>
      <Topbar />
      <div className="flex flex-1 min-h-0">
        <AdminSidebar role={user.role} />
        <main className="flex-1 min-w-0 px-8 py-7">{children}</main>
      </div>
    </>
  );
}
