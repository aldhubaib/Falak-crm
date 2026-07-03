import { redirect } from "next/navigation";

// Invite-only system: there is no public sign-up. Any hit to /sign-up
// (including Clerk invitation links carrying a __clerk_ticket) is forwarded
// to the single login page, preserving the query string.
export default async function SignUpRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string") qs.set(key, value);
  }
  const suffix = qs.toString();
  redirect(`/sign-in${suffix ? `?${suffix}` : ""}`);
}
