"use client";

// Toolbar rendered inside entity preview panels (companies, contacts, deals).
// Matches the Lovable design: Edit / WhatsApp / Share are always visible.
// Actions without a real handler yet show a "not available" notice on click
// instead of silently doing nothing.

import { useEffect, useState, type ReactNode } from "react";
import { Edit3, Info, MessageCircle, Share2 } from "lucide-react";

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
  const [notice, setNotice] = useState(false);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(false), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  const items: ToolbarItem[] = [
    { key: "edit", label: "Edit", icon: <Edit3 className="h-4 w-4" />, onClick: onEdit },
    { key: "whatsapp", label: "WhatsApp", icon: <MessageCircle className="h-4 w-4" />, onClick: onWhatsapp },
    { key: "share", label: "Share", icon: <Share2 className="h-4 w-4" />, onClick: onShare },
    ...extra,
  ];

  return (
    <>
      <div className="flex items-center gap-1 overflow-x-auto">
        {items.map((it) => (
          <button
            key={it.key}
            type="button"
            onClick={it.onClick ?? (() => setNotice(true))}
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm text-foreground hover:bg-muted/40"
          >
            <span className="text-muted-foreground">{it.icon}</span>
            <span>{it.label}</span>
          </button>
        ))}
      </div>
      {notice && (
        <div className="fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 text-sm text-foreground shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
          This feature is not available yet.
        </div>
      )}
    </>
  );
}
