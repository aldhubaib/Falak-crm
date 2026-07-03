"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Trash2, ArrowLeftRight, Loader2 } from "lucide-react";
import { PageContainer } from "@/components/page-container";
import { useActionHandler } from "@/hooks/use-action";
import {
  addLoginPhoto,
  removeLoginPhoto,
  setLoginPhotoColumn,
  type LoginPhotoDTO,
} from "@/actions/login-photos";

type Column = "a" | "b";

export function LoginSettingsClient({ photos }: { photos: LoginPhotoDTO[] }) {
  const router = useRouter();
  const { run } = useActionHandler({ onSuccess: () => router.refresh() });

  const colA = photos.filter((p) => p.column === "a");
  const colB = photos.filter((p) => p.column === "b");

  return (
    <PageContainer className="mx-auto max-w-3xl">
      <p className="text-sm text-muted-foreground">
        Add photos to the two scrolling columns shown on the sign-in page. The
        left column scrolls up, the right column scrolls down.
      </p>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <PhotoColumn
          label="Left column (scrolls up)"
          column="a"
          photos={colA}
          run={run}
        />
        <PhotoColumn
          label="Right column (scrolls down)"
          column="b"
          photos={colB}
          run={run}
        />
      </div>
    </PageContainer>
  );
}

function PhotoColumn({
  label,
  column,
  photos,
  run,
}: {
  label: string;
  column: Column;
  photos: LoginPhotoDTO[];
  run: <T>(name: string, fn: () => Promise<T>) => Promise<T | null>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const onPick = () => inputRef.current?.click();

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        const fd = new FormData();
        fd.set("file", file);
        fd.set("column", column);
        await run("addLoginPhoto", () => addLoginPhoto(fd));
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <section className="space-y-field-gap">
      <div className="flex items-center justify-between px-1">
        <div className="text-tiny font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </div>
        <button
          type="button"
          onClick={onPick}
          disabled={uploading}
          aria-label="Add photos"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/60 bg-surface text-foreground transition-colors hover:border-border disabled:opacity-60"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ImagePlus className="h-4 w-4" />
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
      </div>

      {photos.length === 0 ? (
        <button
          type="button"
          onClick={onPick}
          disabled={uploading}
          className="grid w-full place-items-center rounded-card border border-dashed border-border/60 bg-surface p-8 text-sm text-muted-foreground transition-colors hover:border-border disabled:opacity-60"
        >
          <div className="flex flex-col items-center gap-2">
            {uploading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <ImagePlus className="h-6 w-6" />
            )}
            <span>{uploading ? "Uploading…" : "Add photos"}</span>
          </div>
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {photos.map((p) => (
            <PhotoTile key={p.id} photo={p} run={run} />
          ))}
        </div>
      )}
    </section>
  );
}

function PhotoTile({
  photo,
  run,
}: {
  photo: LoginPhotoDTO;
  run: <T>(name: string, fn: () => Promise<T>) => Promise<T | null>;
}) {
  const other: Column = photo.column === "a" ? "b" : "a";
  return (
    <div className="group relative aspect-[4/3] w-full overflow-hidden rounded-card border border-border/60 bg-surface">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.url} alt="" className="h-full w-full object-cover" />
      <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={() =>
            run("setLoginPhotoColumn", () =>
              setLoginPhotoColumn(photo.id, other),
            )
          }
          aria-label={`Move to column ${other.toUpperCase()}`}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/90 text-black hover:bg-white"
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => run("removeLoginPhoto", () => removeLoginPhoto(photo.id))}
          aria-label="Remove photo"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/90 text-black hover:bg-white"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
