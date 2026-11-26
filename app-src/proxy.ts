import { NextResponse, type NextRequest } from "next/server";

/**
 * Serves short links on their own domain. With SHORT_LINK_HOST=skn.to, a request for
 * skn.to/<code> is rewritten to this app's /q/<code>. With the variable unset this does nothing.
 */
export function proxy(req: NextRequest) {
  const shortHost = process.env.SHORT_LINK_HOST?.toLowerCase();
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").toLowerCase().split(":")[0];
  if (shortHost && host === shortHost) {
    const url = req.nextUrl.clone();
    // the bare short domain goes to the marketing site when SITE_URL is set
    if (url.pathname === "/" && process.env.SITE_URL) return NextResponse.redirect(new URL(process.env.SITE_URL));
    // serialized product codes and customer links keep their own paths on the short domain
    if (/^\/(p|o|s|r)\//.test(url.pathname)) return NextResponse.next();
    url.pathname = `/q${url.pathname}`;
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/|api/|favicon).*)"] };
