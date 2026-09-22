import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// SECURITY: no auth check — this is an admin-only read preview of a
// member's dashboard (see /admin/view-as), not a real sign-in. "Log out"
// just returns to the admin console; see README.md "Admin console has no
// login" for why the whole admin surface works this way.
export function ViewAsTopbar({ profileName }: { profileName: string }) {
  const initial = profileName.trim().charAt(0).toUpperCase() || "?";

  return (
    <header className="sticky top-0 z-40 flex items-center gap-5 border-b bg-background px-6 py-3">
      <Link href="/" className="text-xl font-extrabold tracking-tight shrink-0">
        experience<span className="text-indigo-600">.com</span>
      </Link>

      <div className="flex-1" />

      <div className="flex items-center gap-2.5">
        <Avatar className="h-8 w-8 border-2 border-amber-500">
          <AvatarFallback className="text-xs font-semibold">{initial}</AvatarFallback>
        </Avatar>
        <span className="text-sm text-muted-foreground hidden sm:inline">
          Viewing as <span className="font-semibold text-foreground">{profileName}</span>
        </span>
        <Button asChild size="sm" variant="outline">
          <Link href="/admin/profiles">Log out</Link>
        </Button>
      </div>
    </header>
  );
}
