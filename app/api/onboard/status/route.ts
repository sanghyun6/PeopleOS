// GET /api/onboard/status -> which setup pieces this server has, as booleans only.
// Never returns a key value. Keys are set in .env.local (and on the Convex deployment), not in the browser.
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** The live Cal Hacks deployment: a pack must never be loaded there. */
const PROTECTED_DEPLOYMENTS = ["resolute-horse-290"];

export function GET() {
  const env = process.env;
  const target = `${env.CONVEX_DEPLOYMENT ?? ""} ${env.NEXT_PUBLIC_CONVEX_URL ?? ""}`;
  const deployment = !target.trim()
    ? "none"
    : PROTECTED_DEPLOYMENTS.some((d) => target.includes(d))
      ? "calhacks"
      : /127\.0\.0\.1|localhost|anonymous/.test(target)
        ? "local"
        : "other";
  return NextResponse.json({
    deployment,
    cartesia: !!env.CARTESIA_API_KEY,
    moss: !!(env.MOSS_PROJECT_ID && env.MOSS_PROJECT_KEY),
    bitdeer: !!env.BITDEER_API_KEY,
  });
}
