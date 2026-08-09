import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractRecipeFromImage } from "@/lib/ai/extract";

// Vision extraction can take ~10-20s; give it headroom and keep it on Node
// (Buffer + base64) rather than the Edge runtime.
export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED_MEDIA = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You are not signed in." }, { status: 401 });
  }

  let body: {
    storagePath?: string;
    contentType?: string;
    byteSize?: number;
    originalFilename?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const storagePath = body.storagePath;
  if (!storagePath) {
    return NextResponse.json({ error: "Missing storagePath." }, { status: 400 });
  }

  const { data: created, error: createErr } = await supabase
    .from("imports")
    .insert({
      user_id: user.id,
      import_type: "photo",
      status: "analyzing",
      bucket_id: "temp-imports",
      storage_path: storagePath,
      content_type: body.contentType ?? null,
      byte_size: body.byteSize ?? null,
      original_filename: body.originalFilename ?? null,
    })
    .select("id")
    .single();

  if (createErr || !created) {
    return NextResponse.json(
      { error: createErr?.message ?? "Could not start the import." },
      { status: 500 },
    );
  }
  const importId = (created as { id: string }).id;

  const startedAt = new Date().toISOString();
  try {
    const { data: blob, error: dlErr } = await supabase.storage
      .from("temp-imports")
      .download(storagePath);
    if (dlErr || !blob) {
      throw new Error(dlErr?.message ?? "Could not read the uploaded image.");
    }

    const base64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
    const mediaType = ALLOWED_MEDIA.includes(body.contentType ?? "")
      ? (body.contentType as string)
      : "image/jpeg";

    const { recipe, model, usage } = await extractRecipeFromImage(
      base64,
      mediaType,
    );

    await supabase
      .from("imports")
      .update({ status: "needs_review", extracted_payload: recipe })
      .eq("id", importId);

    await supabase.from("ai_jobs").insert({
      user_id: user.id,
      import_id: importId,
      job_type: "extract_recipe",
      status: "succeeded",
      provider: "anthropic",
      model,
      prompt_tokens: usage.input_tokens,
      completion_tokens: usage.output_tokens,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
    });

    return NextResponse.json({ importId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("imports")
      .update({ status: "failed", error_message: message })
      .eq("id", importId);
    await supabase.from("ai_jobs").insert({
      user_id: user.id,
      import_id: importId,
      job_type: "extract_recipe",
      status: "failed",
      provider: "anthropic",
      error_message: message,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
    });
    return NextResponse.json({ error: message, importId }, { status: 500 });
  }
}
