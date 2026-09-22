import Link from "next/link";
import type { Profile } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { completenessOf } from "@/lib/profile-fields";

const STATUS_STYLE: Record<Profile["status"], string> = {
  unclaimed: "bg-stone-100 text-stone-600",
  claimed: "bg-emerald-100 text-emerald-700",
  pro: "bg-amber-100 text-amber-700",
};
const STATUS_LABEL: Record<Profile["status"], string> = {
  unclaimed: "Unclaimed",
  claimed: "Claimed",
  pro: "Pro",
};

export function ProfileCard({ profile }: { profile: Profile }) {
  const initials = profile.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");

  return (
    <Link
      href={`/p/${profile.id}`}
      className="flex items-center gap-3.5 rounded-xl border bg-card p-4 hover:border-indigo-300 hover:shadow-sm transition-all"
    >
      <div className="h-11 w-11 shrink-0 rounded-lg bg-muted flex items-center justify-center font-bold text-muted-foreground">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-sm truncate">{profile.name}</p>
          <Badge className={STATUS_STYLE[profile.status]} variant="secondary">
            {STATUS_LABEL[profile.status]}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {profile.profession}
          {profile.org ? ` · ${profile.org}` : ""}
        </p>
        <p className="text-xs text-muted-foreground truncate">{profile.location}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs font-semibold">{completenessOf(profile)}%</p>
        <p className="text-[10px] text-muted-foreground">complete</p>
      </div>
    </Link>
  );
}
