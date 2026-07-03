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
  "link",
  "mention",
  "copyright",
];

// File categories for the file_upload kind (stored in allowedFileTypes).
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

export type Section = "create" | "delivery";
