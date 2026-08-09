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
    .select("storage_path")
    .eq("id", importId)
    .maybeSingle();
  const sourcePath = (imp as { storage_path: string | null } | null)?.storage_path;

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
