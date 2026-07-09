import {
  FileText,
  FileAudio,
  FileVideo,
  File as FileIcon,
} from "lucide-react";
import type { MessageAttachment } from "@/actions/messages";

export function formatBytes(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
}

export function fileIconFor(a: MessageAttachment) {
  const ct = a.contentType ?? "";
  if (ct.startsWith("video/")) return FileVideo;
  if (ct.startsWith("audio/")) return FileAudio;
  if (ct.includes("pdf")) return FileText;
  return FileIcon;
}
