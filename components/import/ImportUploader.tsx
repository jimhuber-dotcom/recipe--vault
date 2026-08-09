"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { UploadIcon } from "@/components/nav/icons";

// Downscale to a modest JPEG before upload: keeps us under Claude's per-image
// size limit and cuts token cost, and the same file becomes the recipe cover.
async function downscaleToJpeg(file: File, maxEdge = 1568): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = document.createElement("img");
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not read that image."));
      img.src = url;
    });
    const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not process that image.");
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Could not process that image."))),
        "image/jpeg",
        0.85,
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function ImportUploader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<
    "idle" | "preparing" | "uploading" | "reading"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  const busy = status !== "idle";

  async function handleFile(file: File) {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("You are not signed in.");
        return;
      }

      setStatus("preparing");
      const blob = await downscaleToJpeg(file);

      setStatus("uploading");
      const path = `${user.id}/${crypto.randomUUID()}.jpg`;
      const { error: uploadErr } = await supabase.storage
        .from("temp-imports")
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (uploadErr) {
        setError(uploadErr.message);
        setStatus("idle");
        return;
      }

      setStatus("reading");
      const res = await fetch("/api/import/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          storagePath: path,
          contentType: "image/jpeg",
          byteSize: blob.size,
          originalFilename: file.name,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Could not read that photo.");
        setStatus("idle");
        return;
      }
      router.push(`/import/${json.importId}/review`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("idle");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const label =
    status === "preparing"
      ? "Preparing…"
      : status === "uploading"
        ? "Uploading…"
        : status === "reading"
          ? "Reading the recipe…"
          : "Choose a photo";

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-surface px-6 py-16 text-center transition-colors hover:border-primary disabled:opacity-70"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-accent">
          <UploadIcon className="h-6 w-6" />
        </span>
        <span className="font-display text-lg text-foreground">{label}</span>
        <span className="max-w-sm text-sm text-foreground-muted">
          {busy
            ? "Hang tight — this takes a few seconds."
            : "A screenshot, a photo of a card, or a cookbook page. Claude reads it and pre-fills the recipe for you to review."}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      {error ? (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {status === "idle" && !error ? (
        <div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => inputRef.current?.click()}
          >
            Pick a different photo
          </Button>
        </div>
      ) : null}
    </div>
  );
}
