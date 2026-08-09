import { createClient } from "@/lib/supabase/server";
import { RECIPE_IMAGE_BUCKET } from "@/lib/constants";

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

/**
 * The recipe-images bucket is private, so <img> tags need a short-lived signed
 * URL rather than a public URL. These helpers run server-side.
 */
export async function signImagePath(path: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from(RECIPE_IMAGE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}

export async function signImagePaths(
  paths: string[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (paths.length === 0) return result;
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from(RECIPE_IMAGE_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  (data ?? []).forEach((entry) => {
    if (entry.path && entry.signedUrl) result.set(entry.path, entry.signedUrl);
  });
  return result;
}
