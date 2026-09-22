"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Users, Megaphone, MessageCircleQuestion, BarChart3 } from "lucide-react";
import type { AppRole } from "@/types/database";

const ITEMS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, roles: ["admin", "support"] },
  { href: "/admin/profiles", label: "Profiles", icon: Users, roles: ["admin", "support"] },
  { href: "/admin/campaigns", label: "Campaigns", icon: Megaphone, roles: ["admin"] },
  { href: "/admin/support", label: "Support", icon: MessageCircleQuestion, roles: ["admin", "support"] },
  { href: "/admin/reports", label: "Reports", icon: BarChart3, roles: ["admin", "support"] },
] as const;

export function AdminSidebar({ role }: { role: AppRole }) {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r bg-background px-3 py-5 hidden md:block">
      <nav className="space-y-0.5">
        {ITEMS.filter((i) => (i.roles as readonly string[]).includes(role)).map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium border-l-2 border-transparent",
                active
                  ? "bg-indigo-50 text-indigo-700 border-indigo-600"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
