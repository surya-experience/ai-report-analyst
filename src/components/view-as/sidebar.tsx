"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, BarChart3 } from "lucide-react";

export function ViewAsSidebar({ profileId }: { profileId: string }) {
  const pathname = usePathname();
  const base = `/admin/view-as/${profileId}`;
  const items = [
    { href: base, label: "Dashboard", icon: LayoutDashboard },
    { href: `${base}/reports`, label: "Reports", icon: BarChart3 },
  ];

  return (
    <aside className="w-56 shrink-0 border-r bg-background px-3 py-5 hidden md:block">
      <nav className="space-y-0.5">
        {items.map((item) => {
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
