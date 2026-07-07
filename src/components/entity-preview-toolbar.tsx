"use client";

// Toolbar rendered inside entity preview panels (companies, contacts, deals).
// Only actions with a handler are shown; the row scrolls on narrow screens.

import type { ReactNode } from "react";
import { Edit3, MessageCircle, Share2 } from "lucide-react";

type ToolbarItem = {
  key: string;
  label: string;
  icon: ReactNode;
  onClick?: () => void;
};

export function EntityPreviewToolbar({
  onEdit,
  onWhatsapp,
  onShare,
  extra = [],
}: {
  onEdit?: () => void;
  onWhatsapp?: () => void;
  onShare?: () => void;
  extra?: ToolbarItem[];
}) {
  const items: ToolbarItem[] = [
    { key: "edit", label: "Edit", icon: <Edit3 className="h-4 w-4" />, onClick: onEdit },
    { key: "whatsapp", label: "WhatsApp", icon: <MessageCircle className="h-4 w-4" />, onClick: onWhatsapp },
    { key: "share", label: "Share", icon: <Share2 className="h-4 w-4" />, onClick: onShare },
    ...extra,
  ].filter((it) => it.onClick);

  if (items.length === 0) return null;

  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          onClick={it.onClick}
          className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm text-foreground hover:bg-muted/40"
        >
          <span className="text-muted-foreground">{it.icon}</span>
          <span>{it.label}</span>
        </button>
      ))}
    </div>
  );
}
