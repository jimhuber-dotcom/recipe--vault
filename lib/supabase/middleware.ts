import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

// Routes reachable without a session. Everything else redirects to /login.
const PUBLIC_PREFIXES = ["/login", "/auth", "/reset-password"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

function configError(message: string): NextResponse {
  return new NextResponse(message, {
    status: 500,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

/**
 * Refreshes the auth session on every request and enforces the route guard:
 *   - unauthenticated on a protected route  -> redirect to /login
 *   - authenticated hitting /login          -> redirect to the dashboard
 *
 * If the deployment is misconfigured (missing/invalid Supabase env vars) we
 * return a readable message rather than letting the middleware crash with an
 * opaque MIDDLEWARE_INVOCATION_FAILED.
 */
export async function updateSession(
  request: NextRequest,
): Promise<NextResponse> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    const missing = !supabaseUrl
      ? "NEXT_PUBLIC_SUPABASE_URL"
      : "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";
    return configError(
      `Configuration error: ${missing} is not set for this deployment. ` +
        `Add it in Vercel → Settings → Environment Variables, then redeploy.`,
    );
  }

  let supabaseResponse = NextResponse.next({ request });
  let user: User | null = null;

  try {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    });

    // Must be the first call after createServerClient so the session cookie is
    // refreshed before any guard decision.
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch (err) {
    return configError(
      `Supabase auth check failed: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  const { pathname } = request.nextUrl;

  if (user && pathname === "/login") {
    return redirectPreservingCookies(request, "/", supabaseResponse);
  }

  if (!user && !isPublicPath(pathname)) {
    const target = request.nextUrl.clone();
    target.pathname = "/login";
    target.search = "";
    target.searchParams.set("redirectTo", pathname);
    return copyCookies(NextResponse.redirect(target), supabaseResponse);
  }

  return supabaseResponse;
}

function redirectPreservingCookies(
  request: NextRequest,
  pathname: string,
  source: NextResponse,
): NextResponse {
  const target = request.nextUrl.clone();
  target.pathname = pathname;
  target.search = "";
  return copyCookies(NextResponse.redirect(target), source);
}

// Carry any refreshed auth cookies onto the redirect response so the session
// isn't dropped on the way through the guard.
function copyCookies(to: NextResponse, from: NextResponse): NextResponse {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie));
  return to;
}
