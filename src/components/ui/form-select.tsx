"use client";

import { useState, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface FormSelectOption {
  value: string;
  label: string;
}

interface FormSelectProps {
  name: string;
  label?: string;
  value?: string;
  options: FormSelectOption[];
  placeholder?: string;
  required?: boolean;
  onChange?: (value: string) => void;
}

export function FormSelect({
  name,
  label,
  value: controlledValue,
  options,
  placeholder,
  required,
  onChange,
}: FormSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [internalValue, setInternalValue] = useState(controlledValue || "");
  const searchRef = useRef<HTMLInputElement>(null);

  const currentValue = controlledValue !== undefined ? controlledValue : internalValue;
  const displayLabel = options.find((o) => o.value === currentValue)?.label;

  const filtered = options.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (val: string) => {
    if (controlledValue === undefined) setInternalValue(val);
    onChange?.(val);
    setOpen(false);
    setSearch("");
  };

  return (
    <div className="relative">
      <input type="hidden" name={name} value={currentValue} />
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          setTimeout(() => searchRef.current?.focus(), 50);
        }}
        className={cn(
          "w-full rounded-lg bg-black border px-3 pt-2 pb-1.5 text-left transition-colors",
          open ? "border-ring" : "border-border"
        )}
      >
        {label && (
          <span className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            {label}
            {required && <span className="text-destructive">*</span>}
          </span>
        )}
        <div className="flex items-center justify-between h-8">
          <span className={cn("text-[13px]", currentValue ? "text-foreground" : "text-muted-foreground/50")}>
            {displayLabel || placeholder || "Select..."}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        </div>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setSearch(""); }} />
          <div className="absolute z-50 top-full mt-1 w-full rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
            {options.length > 5 && (
              <div className="p-1.5">
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="w-full h-8 px-2.5 rounded bg-black text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === "Escape") { setOpen(false); setSearch(""); }
                    if (e.key === "Enter" && filtered.length > 0) handleSelect(filtered[0].value);
                  }}
                />
              </div>
            )}
            <div className={cn("max-h-[200px] overflow-y-auto", options.length > 5 && "border-t border-border")}>
              {placeholder && (
                <button
                  type="button"
                  onClick={() => handleSelect("")}
                  className={cn(
                    "w-full px-3 py-2 text-left text-[12px] text-muted-foreground/50 hover:bg-muted/30 transition-colors",
                    !currentValue && "bg-muted/40"
                  )}
                >
                  {placeholder}
                </button>
              )}
              {filtered.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  className={cn(
                    "w-full px-3 py-2 text-left text-[12px] text-foreground hover:bg-muted/30 transition-colors",
                    currentValue === opt.value && "bg-muted/40"
                  )}
                >
                  {opt.label}
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="px-3 py-2 text-[11px] text-muted-foreground">No results</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
