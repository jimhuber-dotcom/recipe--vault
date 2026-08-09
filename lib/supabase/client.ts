import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client. Reads only the public URL + publishable key, both of
 * which are safe to ship to the client. Never import the service role key here.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
