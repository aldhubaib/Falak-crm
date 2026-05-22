"use client";

import { useState, useRef } from "react";
import { Camera } from "lucide-react";
import { cn } from "@/lib/utils";

interface AvatarUploadProps {
  currentImage?: string | null;
  name: string;
  fallback: string;
  size?: "sm" | "md" | "lg";
  onUpload?: (file: File) => void;
}

const sizeClasses = {
  sm: "w-12 h-12",
  md: "w-16 h-16",
  lg: "w-20 h-20",
};

export function AvatarUpload({
  currentImage,
  name,
  fallback,
  size = "md",
  onUpload,
}: AvatarUploadProps) {
  const [preview, setPreview] = useState<string | null>(currentImage ?? null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    onUpload?.(file);
  };

  return (
    <div className="relative group">
      <input
        ref={inputRef}
        type="file"
        name={name}
        accept="image/*"
        onChange={handleChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          "rounded-full overflow-hidden border-2 border-border hover:border-primary/50 transition-colors relative",
          sizeClasses[size]
        )}
      >
        {preview ? (
          <img src={preview} alt="Avatar" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-primary/15 flex items-center justify-center text-primary font-semibold text-lg">
            {fallback}
          </div>
        )}
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Camera className="w-4 h-4 text-white" />
        </div>
      </button>
    </div>
  );
}
