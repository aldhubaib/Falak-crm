// Field kinds supported by Falak's checklist backend + downstream task renderer.
// (Values map to ChecklistTemplateItem.type strings.)
export const KIND_LABELS: Record<string, string> = {
  text: "Text",
  textarea: "Text Area",
  number: "Number",
  select: "Dropdown",
  yes_no: "Yes / No",
  checkbox: "Checkbox",
  file_upload: "File Upload",
  multi_file: "Multi File Upload",
  link: "Link",
  mention: "Mention",
  copyright: "Copyright",
};

export const KINDS: string[] = [
  "text",
  "textarea",
  "number",
  "select",
  "yes_no",
  "checkbox",
  "file_upload",
  "multi_file",
  "link",
  "mention",
  "copyright",
];

// Kinds that store file uploads (single or multiple) and share the file
// constraint settings (category, formats, aspect ratio).
export function isFileKind(kind: string): boolean {
  return kind === "file_upload" || kind === "multi_file";
}

// File categories for the file kinds (stored in allowedFileTypes).
export const FILE_CATEGORIES = [
  { value: "", label: "Any" },
  { value: "image", label: "Image" },
  { value: "video", label: "Video" },
  { value: "audio", label: "Audio" },
  { value: "document", label: "Document" },
];

export const FORMATS: Record<string, string[]> = {
  audio: [".mp3", ".wav", ".ogg", ".aac", ".m4a", ".flac", ".wma"],
  video: [".mp4", ".mov", ".webm", ".mkv", ".avi"],
  image: [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"],
  document: [".pdf", ".doc", ".docx", ".txt", ".rtf"],
};

export const ASPECTS = ["1:1", "16:9", "9:16", "4:5", "4:3", "3:2"];

// Effort measurement for capacity planning. null/"" = field carries no effort.
// The measured unit is derived from the field itself (audio file → audio
// length, video file → video length, text → word count); the only real choice
// is "don't count it", "count by content", or "count as a fixed cost".
export const EFFORT_UNIT_LABELS: Record<string, string> = {
  words: "per word",
  audio_min: "per audio minute",
  video_min: "per video minute",
  fixed: "flat",
};

// The content-measured unit a field supports, given its type. null = the field
// has nothing measurable, so only a fixed cost makes sense.
export function measuredUnitFor(
  kind: string,
  allowedFileTypes: string | null,
): "words" | "audio_min" | "video_min" | null {
  if (kind === "text" || kind === "textarea") return "words";
  if (isFileKind(kind)) {
    if (allowedFileTypes === "audio") return "audio_min";
    if (allowedFileTypes === "video") return "video_min";
    return null; // image / document / any → fixed only
  }
  return null;
}

export const MEASURED_UNIT_OPTION_LABELS: Record<string, string> = {
  words: "By word count",
  audio_min: "By audio length",
  video_min: "By video length",
};

export type Section = "create" | "delivery";
