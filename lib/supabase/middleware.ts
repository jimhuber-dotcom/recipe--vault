import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes reachable without a session. Everything else redirects to /login.
const PUBLIC_PREFIXES = ["/login", "/auth", "/reset-password"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * Refreshes the auth session on every request and enforces the route guard:
 *   - unauthenticated on a protected route  -> redirect to /login
 *   - authenticated hitting /login          -> redirect to the dashboard
 */
export async function updateSession(
  request: NextRequest,
): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and getUser() — it must be the
  // first call so the session cookie is refreshed before any guard decision.
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
