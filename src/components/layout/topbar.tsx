import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { AccountMenu } from "./account-menu";
import { SearchBox } from "./search-box";
import { Button } from "@/components/ui/button";
import { Suspense } from "react";

export async function Topbar() {
  const user = await getSessionUser();

  return (
    <header className="sticky top-0 z-40 flex items-center gap-5 border-b bg-background px-6 py-3">
      <Link href="/" className="text-xl font-extrabold tracking-tight shrink-0">
        experience<span className="text-indigo-600">.com</span>
      </Link>
      <Suspense fallback={<div className="w-full max-w-md" />}>
        <SearchBox />
      </Suspense>
      <div className="flex-1" />
      {user ? (
        <AccountMenu email={user.email ?? "Account"} isStaff={user.role !== "member"} />
      ) : (
        <Button asChild size="sm">
          <Link href="/login">Sign in</Link>
        </Button>
      )}
    </header>
  );
}
