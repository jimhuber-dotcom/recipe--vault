"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  attachRecipeImage,
  setPrimaryImage,
  deleteRecipeImage,
} from "@/app/(app)/recipes/actions";
import { RECIPE_IMAGE_BUCKET } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface ImageItem {
  id: string;
  storagePath: string;
  isPrimary: boolean;
  url: string | null;
}

export function RecipeImageManager({
  recipeId,
  initialImages,
}: {
  recipeId: string;
  initialImages: ImageItem[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("You are not signed in.");
      setUploading(false);
      return;
    }

    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          setError("Only image files can be uploaded.");
          break;
        }
        const ext = file.name.includes(".")
          ? file.name.split(".").pop()
          : "jpg";
        const path = `${user.id}/${recipeId}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from(RECIPE_IMAGE_BUCKET)
          .upload(path, file, { contentType: file.type, upsert: false });
        if (uploadErr) {
          setError(uploadErr.message);
          break;
        }

        const res = await attachRecipeImage(recipeId, path, {
          contentType: file.type || null,
          byteSize: file.size,
        });
        if (res.error) {
          setError(res.error);
          break;
        }
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    }
  }

  function onSetPrimary(imageId: string) {
    startTransition(async () => {
      await setPrimaryImage(recipeId, imageId);
      router.refresh();
    });
  }

  function onDelete(imageId: string, storagePath: string) {
    startTransition(async () => {
      await deleteRecipeImage(recipeId, imageId, storagePath);
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-foreground">Photos</h2>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? "Uploading…" : "+ Add photos"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {error ? (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {initialImages.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {initialImages.map((img) => (
            <div key={img.id} className="w-36">
              <div
                className={cn(
                  "overflow-hidden rounded-xl border-2",
                  img.isPrimary ? "border-accent" : "border-border",
                )}
              >
                {img.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={img.url}
                    alt=""
                    className="h-28 w-full object-cover"
                  />
                ) : (
                  <div className="h-28 w-full bg-surface-muted" />
                )}
              </div>
              <div className="mt-1 flex items-center justify-between text-xs">
                {img.isPrimary ? (
                  <span className="font-medium text-accent">Cover</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSetPrimary(img.id)}
                    disabled={pending}
                    className="text-foreground-muted hover:text-foreground"
                  >
                    Set cover
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onDelete(img.id, img.storagePath)}
                  disabled={pending}
                  className="text-foreground-muted hover:text-danger"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-foreground-muted">
          No photos yet. The first one you add becomes the cover image.
        </p>
      )}
    </section>
  );
}
