"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";
import { ProjectAvatar } from "@/components/project-avatar";
import { uploadProjectThumbnail } from "@/actions/projects";
import { useErrorStore } from "@/lib/error-store";

// Circular project photo shown in the header. Tap to upload/replace the image.
export function ProjectPhotoButton({
  projectId,
  name,
  thumbnailId,
  size = 36,
}: {
  projectId: string;
  name: string;
  thumbnailId: string | null;
  size?: number;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!thumbnailId) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/files/${thumbnailId}/download-url`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.url) setUrl(data.url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [thumbnailId]);

  const onPick = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      pushError("Only image files are allowed");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("projectId", projectId);
      fd.set("file", file);
      await uploadProjectThumbnail(fd);
      router.refresh();
    } catch {
      pushError("Failed to upload photo");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        aria-label="Change project photo"
        className="group relative shrink-0 rounded-full"
        style={{ width: size, height: size }}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={name}
            className="rounded-full object-cover"
            style={{ width: size, height: size }}
          />
        ) : (
          <ProjectAvatar name={name} size={size} />
        )}
        {uploading ? (
          <span className="absolute inset-0 grid place-items-center rounded-full bg-black/50">
            <Loader2 className="size-4 animate-spin text-white" />
          </span>
        ) : (
          <span className="absolute inset-0 grid place-items-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
            <Camera className="size-4 text-white" />
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />
    </>
  );
}

function pushError(message: string) {
  useErrorStore.getState().push({
    id: crypto.randomUUID(),
    message,
    code: "PROJECT_PHOTO_ERROR",
    severity: "error",
    timestamp: new Date().toISOString(),
    url: typeof window !== "undefined" ? window.location.href : "",
    action: "Upload project photo",
  });
}
