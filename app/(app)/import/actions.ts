"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { RECIPE_IMAGE_BUCKET } from "@/lib/constants";

/**
 * Links a reviewed import to the recipe it produced, copies the source photo
 * into the recipe-images bucket as the cover, and marks the import completed.
 */
export async function completeImport(
  importId: string,
  recipeId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You are not signed in." };

  const { data: imp } = await supabase
    .from("imports")
    .select("storage_path, extracted_payload")
    .eq("id", importId)
    .maybeSingle();
  const record = imp as {
    storage_path: string | null;
    extracted_payload: {
      field_provenance?: Record<string, string>;
      ai_review_flags?: { field: string; reason: string }[];
    } | null;
  } | null;
  const sourcePath = record?.storage_path;

  // Record what the AI read vs. reconstructed, so the recipe stays honest about
  // which parts came from the photo. (Values reflect the extraction snapshot;
  // later hand-edits aren't re-tracked in this first version.)
  const payload = record?.extracted_payload;
  await supabase
    .from("recipes")
    .update({
      confidence: "reconstructed",
      field_provenance: payload?.field_provenance ?? {},
      ai_review_flags: payload?.ai_review_flags ?? [],
    })
    .eq("id", recipeId);

  if (sourcePath) {
    const { data: blob } = await supabase.storage
      .from("temp-imports")
      .download(sourcePath);
    if (blob) {
      const ext = sourcePath.includes(".")
        ? sourcePath.split(".").pop()
        : "jpg";
      const destPath = `${user.id}/${recipeId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from(RECIPE_IMAGE_BUCKET)
        .upload(destPath, blob, {
          contentType: blob.type || "image/jpeg",
          upsert: false,
        });
      if (!uploadErr) {
        await supabase.from("recipe_images").insert({
          recipe_id: recipeId,
          user_id: user.id,
          bucket_id: RECIPE_IMAGE_BUCKET,
          storage_path: destPath,
          is_primary: true,
          position: 0,
          image_origin: "original_photo",
        });
        await supabase
          .from("recipes")
          .update({ photo_status: "original_photo" })
          .eq("id", recipeId);
      }
    }
  }

  await supabase
    .from("imports")
    .update({
      status: "completed",
      recipe_id: recipeId,
      completed_at: new Date().toISOString(),
    })
    .eq("id", importId);

  revalidatePath("/library");
  revalidatePath("/inbox");
  revalidatePath("/");
  return {};
}

/** Drop an import from the queue without saving it (e.g. an unreadable photo). */
export async function discardImport(
  importId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: imp } = await supabase
    .from("imports")
    .select("storage_path")
    .eq("id", importId)
    .maybeSingle();
  const path = (imp as { storage_path: string | null } | null)?.storage_path;

  const { error } = await supabase
    .from("imports")
    .update({ status: "discarded" })
    .eq("id", importId);
  if (error) return { error: error.message };

  if (path) {
    await supabase.storage.from("temp-imports").remove([path]);
  }

  revalidatePath("/inbox");
  return {};
}
