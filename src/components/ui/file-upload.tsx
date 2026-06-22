"use client";

import { useCallback, useState, useRef } from "react";
import { Upload, X, RotateCw, FileIcon, CheckCircle2, AlertCircle } from "lucide-react";
import { useUpload, type UploadEntry } from "@/hooks/use-upload";

type FileUploadProps = {
  entityType: string;
  entityId: string;
  accept?: string;
  multiple?: boolean;
  maxSizeMB?: number;
  onComplete?: (entry: UploadEntry) => void;
  onError?: (entry: UploadEntry) => void;
};

export function FileUpload({
  entityType,
  entityId,
  accept,
  multiple = true,
  maxSizeMB = 500,
  onComplete,
  onError,
}: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { uploads, addFiles, cancelUpload, retryUpload } = useUpload({
    entityType,
    entityId,
    onComplete,
    onError,
  });

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const maxBytes = maxSizeMB * 1024 * 1024;
      const valid = Array.from(files).filter((f) => f.size <= maxBytes);
      if (valid.length > 0) addFiles(valid);
    },
    [addFiles, maxSizeMB]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 cursor-pointer transition-colors ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-muted-foreground/30 hover:bg-muted/30"
        }`}
      >
        <Upload className={`w-6 h-6 ${dragOver ? "text-primary" : "text-muted-foreground"}`} />
        <div className="text-center">
          <p className="text-[13px] text-foreground font-medium">
            {dragOver ? "Drop files here" : "Drop files or click to upload"}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Up to {maxSizeMB} MB per file
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* Upload progress list */}
      {uploads.length > 0 && (
        <div className="space-y-1.5">
          {uploads.map((entry) => (
            <UploadRow
              key={entry.id}
              entry={entry}
              onCancel={() => cancelUpload(entry.id)}
              onRetry={() => retryUpload(entry.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function UploadRow({
  entry,
  onCancel,
  onRetry,
}: {
  entry: UploadEntry;
  onCancel: () => void;
  onRetry: () => void;
}) {
  const isError = entry.status === "error";
  const isDone = entry.status === "complete";

  return (
    <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-2.5">
      <div className="w-8 h-8 rounded-lg bg-card flex items-center justify-center shrink-0">
        {isDone ? (
          <CheckCircle2 className="w-4 h-4 text-primary" />
        ) : isError ? (
          <AlertCircle className="w-4 h-4 text-destructive" />
        ) : (
          <FileIcon className="w-4 h-4 text-muted-foreground" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[12px] text-foreground truncate">{entry.name}</p>
        <div className="flex items-center gap-2 mt-1">
          {!isDone && !isError && (
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-200"
                style={{ width: `${entry.progress}%` }}
              />
            </div>
          )}
          <span className={`text-[10px] shrink-0 ${isError ? "text-destructive" : "text-muted-foreground"}`}>
            {isError
              ? entry.error || "Failed"
              : isDone
              ? formatBytes(entry.size)
              : `${entry.progress}%`}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {isError && (
          <button
            onClick={onRetry}
            className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        )}
        {!isDone && (
          <button
            onClick={onCancel}
            className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
