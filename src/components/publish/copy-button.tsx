import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

/** Small icon button that copies `text` and flashes a checkmark. */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={`Copy ${label}`}
      title={`Copy ${label}`}
      onClick={(e) => {
        e.stopPropagation();
        void navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-full transition-colors",
        copied
          ? "text-success"
          : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
      )}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  );
}
