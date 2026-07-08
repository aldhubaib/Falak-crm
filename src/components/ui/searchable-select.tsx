"use client";

// Drop-in replacement for the shadcn Select, but with a search box at the top
// of the dropdown (ported from the Lovable design). Use this for every
// dropdown in the system instead of Select.

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export type SearchableOption = {
  value: string;
  label: string;
  /** Extra strings to match against when typing. */
  keywords?: string[];
  /** Optional custom node rendered in the list; falls back to `label`. */
  node?: React.ReactNode;
  disabled?: boolean;
};

export interface SearchableSelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  options: SearchableOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
  /** Optional override for the trigger label rendering. */
  renderValue?: (opt: SearchableOption | undefined) => React.ReactNode;
  /** Extra footer node inside the popover (e.g. "Manage industries"). */
  footer?: React.ReactNode;
  align?: "start" | "center" | "end";
  "aria-label"?: string;
  id?: string;
  name?: string;
}

export const SearchableSelect = React.forwardRef<
  HTMLButtonElement,
  SearchableSelectProps
>(function SearchableSelect(
  {
    value,
    onValueChange,
    options,
    placeholder,
    searchPlaceholder = "Search…",
    emptyText = "No results.",
    disabled,
    className,
    contentClassName,
    renderValue,
    footer,
    align = "start",
    id,
    name,
    ...props
  },
  ref,
) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((o) => o.value === value);
  const label = renderValue ? (
    renderValue(selected)
  ) : (
    (selected?.node ?? selected?.label ?? (
      <span className="text-muted-foreground">{placeholder ?? "Select…"}</span>
    ))
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          ref={ref}
          type="button"
          id={id}
          name={name}
          role="combobox"
          aria-expanded={open}
          aria-label={props["aria-label"]}
          disabled={disabled}
          className={cn(
            "flex h-9 w-full cursor-pointer items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
        >
          <span className="min-w-0 truncate text-left">{label}</span>
          <ChevronDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className={cn(
          "w-[var(--radix-popover-trigger-width)] min-w-[var(--radix-popover-trigger-width)] p-0",
          contentClassName,
        )}
      >
        <Command
          filter={(itemValue, search) => {
            // itemValue holds the option value; match on its label + keywords.
            const opt = options.find((o) => o.value === itemValue);
            const hay = [opt?.label ?? "", ...(opt?.keywords ?? [])]
              .join(" ")
              .toLowerCase();
            return hay.includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.value}
                  disabled={opt.disabled}
                  onSelect={(v) => {
                    onValueChange?.(v);
                    setOpen(false);
                  }}
                  className="flex items-center gap-2"
                >
                  <Check
                    className={cn(
                      "h-4 w-4 shrink-0",
                      opt.value === value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {opt.node ?? opt.label}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            {footer}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
});
