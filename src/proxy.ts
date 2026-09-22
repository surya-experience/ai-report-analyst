import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Excludes the admin console's pages and APIs: it has no login (see
    // README.md) and reads through the service-role admin client, not the
    // session this middleware refreshes — running it there was adding a
    // full extra Supabase Auth round-trip to every admin page/API request
    // for no benefit, which is why admin navigation felt slow. api/support
    // stays included: it's shared with the member-facing dashboard and
    // does its own auth.getUser() check.
    "/((?!_next/static|_next/image|favicon.ico|admin|api/admin|api/campaigns|api/reports|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
