import { redirect } from "next/navigation";

// The admin Reports page is this app's default landing page — the public
// profile directory (search/claim flow) still lives at /directory.
export default function Home(): never {
  redirect("/admin/reports");
}
