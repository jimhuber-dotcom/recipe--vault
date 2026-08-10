"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button, buttonClasses } from "@/components/ui/Button";
import { UploadIcon } from "@/components/nav/icons";
import { cn } from "@/lib/utils";

type ItemStatus =
  | "queued"
  | "preparing"
  | "uploading"
  | "reading"
  | "done"
  | "error";

interface Item {
  key: string;
  name: string;
  status: ItemStatus;
  error?: string;
}

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

const STATUS_LABEL: Record<ItemStatus, string> = {
  queued: "Waiting…",
  preparing: "Preparing…",
  uploading: "Uploading…",
  reading: "Reading…",
  done: "Ready to review",
  error: "Failed",
};

export function ImportUploader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [running, setRunning] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);

  function patch(index: number, next: Partial<Item>) {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, ...next } : it)),
    );
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (files.length === 0) {
      setFatal("Please choose image files.");
      return;
    }

    setFatal(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setFatal("You are not signed in.");
      return;
    }

    setItems(
      files.map((f, i) => ({
        key: `${i}-${f.name}`,
        name: f.name,
        status: "queued" as ItemStatus,
      })),
    );
    setRunning(true);

    // Sequential: one photo at a time keeps us well within API rate limits and
    // gives clear per-photo progress. A batch of 37 takes a few minutes.
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        patch(i, { status: "preparing" });
        const blob = await downscaleToJpeg(file);

        patch(i, { status: "uploading" });
        const path = `${user.id}/${crypto.randomUUID()}.jpg`;
        const { error: uploadErr } = await supabase.storage
          .from("temp-imports")
          .upload(path, blob, { contentType: "image/jpeg", upsert: false });
        if (uploadErr) throw new Error(uploadErr.message);

        patch(i, { status: "reading" });
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
        if (!res.ok) throw new Error(json?.error ?? "Could not read that photo.");
        patch(i, { status: "done" });
      } catch (err) {
        patch(i, {
          status: "error",
          error: err instanceof Error ? err.message : "Failed",
        });
      }
    }

    setRunning(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  const doneCount = items.filter((i) => i.status === "done").length;
  const errorCount = items.filter((i) => i.status === "error").length;
  const showResults = items.length > 0;

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={running}
        className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-surface px-6 py-14 text-center transition-colors hover:border-primary disabled:opacity-70"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-accent">
          <UploadIcon className="h-6 w-6" />
        </span>
        <span className="font-display text-lg text-foreground">
          {running ? "Working…" : "Choose photos"}
        </span>
        <span className="max-w-md text-sm text-foreground-muted">
          Select as many as you like at once — screenshots, photos of cards, or
          cookbook pages. Claude reads each one, then they queue up in your Inbox
          to review and save.
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />

      {fatal ? (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {fatal}
        </p>
      ) : null}

      {showResults ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-foreground-muted">
              {running
                ? `Reading ${doneCount + errorCount + 1} of ${items.length}…`
                : `Done — ${doneCount} ready, ${errorCount} failed.`}
            </p>
            {!running && doneCount > 0 ? (
              <Link
                href="/inbox"
                className={buttonClasses({ variant: "primary", size: "sm" })}
              >
                Review {doneCount} in Inbox
              </Link>
            ) : null}
          </div>

          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {items.map((it) => (
              <li
                key={it.key}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
              >
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {it.name}
                </span>
                <span
                  className={cn(
                    "shrink-0 text-xs font-medium",
                    it.status === "done"
                      ? "text-success"
                      : it.status === "error"
                        ? "text-danger"
                        : "text-foreground-muted",
                  )}
                  title={it.error}
                >
                  {STATUS_LABEL[it.status]}
                </span>
              </li>
            ))}
          </ul>

          {!running ? (
            <div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => inputRef.current?.click()}
              >
                Add more photos
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
