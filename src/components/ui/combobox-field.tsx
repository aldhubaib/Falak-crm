"use client";

import { useState, useRef } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ComboboxFieldProps {
  label: string;
  icon?: React.ReactNode;
  value: string;
  options: { id: string; label: string }[];
  placeholder?: string;
  onSelect: (value: string) => void | Promise<void>;
  onCreate: (value: string) => void | Promise<void>;
  onDelete?: (id: string) => void | Promise<void>;
  name?: string;
  required?: boolean;
  error?: boolean;
}

export function ComboboxField({
  label,
  icon,
  value,
  options,
  placeholder,
  onSelect,
  onCreate,
  onDelete,
  name,
  required,
  error,
}: ComboboxFieldProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = options.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );
  const hasExactMatch = options.some(
    (opt) => opt.label.toLowerCase() === search.toLowerCase()
  );

  return (
    <div className="relative">
      <label className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
        {icon}
        {label}
        {required && <span className="text-destructive">*</span>}
      </label>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className={cn(
          "w-full h-10 px-3 rounded-lg bg-transparent border text-[13px] text-left flex items-center justify-between transition-colors",
          value ? "text-foreground" : "text-muted-foreground/50",
          error ? "border-destructive" : "border-border",
          open && !error && "border-ring"
        )}
      >
        <span className="truncate">{value || placeholder || "Select..."}</span>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 w-full rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
          <div className="p-1.5">
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search or type to add..."
              className="w-full h-8 px-2.5 rounded bg-transparent text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
              onKeyDown={async (e) => {
                if (e.key === "Enter" && search && !hasExactMatch) {
                  e.preventDefault();
                  await onCreate(search);
                  onSelect(search);
                  setSearch("");
                  setOpen(false);
                }
                if (e.key === "Escape") setOpen(false);
              }}
            />
          </div>
          <div className="max-h-[200px] overflow-y-auto border-t border-border">
            {filtered.length === 0 && !search && (
              <p className="px-3 py-2 text-[11px] text-muted-foreground">No options yet</p>
            )}
            {filtered.map((opt) => (
              <div
                key={opt.id}
                className="flex items-center justify-between px-3 py-1.5 hover:bg-muted/50 cursor-pointer group"
              >
                <button
                  type="button"
                  className="flex-1 text-left text-[12px] text-foreground"
                  onClick={() => {
                    onSelect(opt.label);
                    setSearch("");
                    setOpen(false);
                  }}
                >
                  {opt.label}
                </button>
                {onDelete && (
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      await onDelete(opt.id);
                    }}
                    className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
            {search && !hasExactMatch && (
              <button
                type="button"
                className="w-full px-3 py-2 flex items-center gap-1.5 text-[12px] text-primary hover:bg-muted/50 border-t border-border"
                onClick={async () => {
                  await onCreate(search);
                  onSelect(search);
                  setSearch("");
                  setOpen(false);
                }}
              >
                <Plus className="w-3 h-3" />
                Add &quot;{search}&quot;
              </button>
            )}
          </div>
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  );
}
