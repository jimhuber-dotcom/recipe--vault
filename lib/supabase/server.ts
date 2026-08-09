import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server Supabase client, bound to the request's cookies. Use inside Server
 * Components, Route Handlers, and Server Actions. Queries made through this
 * client run as the signed-in user, so Row Level Security does the ownership
 * filtering — application code must NOT add its own user_id filters.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // `setAll` was called from a Server Component, where cookies are
            // read-only. Safe to ignore — the middleware refreshes the session.
          }
        },
      },
    },
  );
}
