"use client";

// Multi-select for operating countries (ISO2 codes), showing flags in the
// trigger and searchable list in the popover. Ported from the Lovable design.

import { useMemo, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { COUNTRIES } from "@/components/phone-input";
import { cn } from "@/lib/utils";

export function CountryMultiSelect({
  value,
  onChange,
  placeholder = "Select countries",
  disabled = false,
}: {
  value: string[]; // ISO2
  onChange: (next: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => COUNTRIES.filter((c) => value.includes(c.code)),
    [value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dial.includes(q) ||
        c.code.toLowerCase().includes(q),
    );
  }, [query]);

  const toggle = (code: string) => {
    onChange(
      value.includes(code) ? value.filter((v) => v !== code) : [...value, code],
    );
  };

  const remove = (code: string) => onChange(value.filter((v) => v !== code));

  const MAX_FLAGS = 6;
  const shownFlags = selected.slice(0, MAX_FLAGS);
  const extra = selected.length - shownFlags.length;

  return (
    <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 bg-transparent text-left text-sm text-foreground outline-none",
            disabled && "cursor-default",
          )}
          aria-label={placeholder}
        >
          {selected.length === 0 ? (
            <span className="truncate text-muted-foreground">
              {disabled ? "—" : placeholder}
            </span>
          ) : (
            <span className="flex min-w-0 items-center gap-1">
              {shownFlags.map((c) => (
                <span key={c.code} aria-label={c.name} className="text-base leading-none">
                  {c.flag}
                </span>
              ))}
              {extra > 0 && (
                <span className="text-xs tabular-nums text-muted-foreground">
                  +{extra}
                </span>
              )}
            </span>
          )}
          {!disabled && (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[--radix-popover-trigger-width] min-w-72 p-0">
        <div className="flex items-center gap-2 border-b border-border/60 px-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search country"
            className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1 border-b border-border/60 px-2 py-2">
            {selected.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => remove(c.code)}
                className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-surface px-2 py-0.5 text-xs hover:border-border"
              >
                <span className="leading-none">{c.flag}</span>
                <span>{c.name}</span>
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
        <ul className="max-h-64 overflow-auto py-1">
          {filtered.map((c) => {
            const on = value.includes(c.code);
            return (
              <li key={c.code}>
                <button
                  type="button"
                  onClick={() => toggle(c.code)}
                  className={cn(
                    "flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-surface",
                    on && "bg-surface",
                  )}
                >
                  <span className="text-base leading-none">{c.flag}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="tabular-nums text-muted-foreground">{c.dial}</span>
                  {on && <Check className="h-3.5 w-3.5 text-primary" />}
                </button>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="px-2 py-3 text-center text-xs text-muted-foreground">
              No match
            </li>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
