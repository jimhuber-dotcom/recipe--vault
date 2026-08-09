/**
 * Client-safe constants. Must NOT import anything server-only (no next/headers,
 * no server Supabase client) — this module is imported by client components.
 */
export const RECIPE_IMAGE_BUCKET = "recipe-images";
