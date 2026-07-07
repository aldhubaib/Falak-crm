"use client";

// Phone input with a country-code picker, plus the shared COUNTRIES list used
// by the CountryMultiSelect and the companies table flags. Ported from the
// Lovable design.

import { useMemo, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type Country = {
  code: string; // ISO2
  name: string;
  dial: string; // e.g. +966
  flag: string; // emoji
};

// Compact list — covers common markets. Extend as needed.
export const COUNTRIES: Country[] = [
  { code: "SA", name: "Saudi Arabia", dial: "+966", flag: "🇸🇦" },
  { code: "AE", name: "United Arab Emirates", dial: "+971", flag: "🇦🇪" },
  { code: "KW", name: "Kuwait", dial: "+965", flag: "🇰🇼" },
  { code: "QA", name: "Qatar", dial: "+974", flag: "🇶🇦" },
  { code: "BH", name: "Bahrain", dial: "+973", flag: "🇧🇭" },
  { code: "OM", name: "Oman", dial: "+968", flag: "🇴🇲" },
  { code: "EG", name: "Egypt", dial: "+20", flag: "🇪🇬" },
  { code: "JO", name: "Jordan", dial: "+962", flag: "🇯🇴" },
  { code: "LB", name: "Lebanon", dial: "+961", flag: "🇱🇧" },
  { code: "IQ", name: "Iraq", dial: "+964", flag: "🇮🇶" },
  { code: "SY", name: "Syria", dial: "+963", flag: "🇸🇾" },
  { code: "YE", name: "Yemen", dial: "+967", flag: "🇾🇪" },
  { code: "PS", name: "Palestine", dial: "+970", flag: "🇵🇸" },
  { code: "SD", name: "Sudan", dial: "+249", flag: "🇸🇩" },
  { code: "LY", name: "Libya", dial: "+218", flag: "🇱🇾" },
  { code: "TN", name: "Tunisia", dial: "+216", flag: "🇹🇳" },
  { code: "DZ", name: "Algeria", dial: "+213", flag: "🇩🇿" },
  { code: "MA", name: "Morocco", dial: "+212", flag: "🇲🇦" },
  { code: "TR", name: "Turkey", dial: "+90", flag: "🇹🇷" },
  { code: "GB", name: "United Kingdom", dial: "+44", flag: "🇬🇧" },
  { code: "US", name: "United States", dial: "+1", flag: "🇺🇸" },
  { code: "CA", name: "Canada", dial: "+1", flag: "🇨🇦" },
  { code: "FR", name: "France", dial: "+33", flag: "🇫🇷" },
  { code: "DE", name: "Germany", dial: "+49", flag: "🇩🇪" },
  { code: "ES", name: "Spain", dial: "+34", flag: "🇪🇸" },
  { code: "IT", name: "Italy", dial: "+39", flag: "🇮🇹" },
  { code: "NL", name: "Netherlands", dial: "+31", flag: "🇳🇱" },
  { code: "SE", name: "Sweden", dial: "+46", flag: "🇸🇪" },
  { code: "CH", name: "Switzerland", dial: "+41", flag: "🇨🇭" },
  { code: "IN", name: "India", dial: "+91", flag: "🇮🇳" },
  { code: "PK", name: "Pakistan", dial: "+92", flag: "🇵🇰" },
  { code: "BD", name: "Bangladesh", dial: "+880", flag: "🇧🇩" },
  { code: "ID", name: "Indonesia", dial: "+62", flag: "🇮🇩" },
  { code: "MY", name: "Malaysia", dial: "+60", flag: "🇲🇾" },
  { code: "PH", name: "Philippines", dial: "+63", flag: "🇵🇭" },
  { code: "CN", name: "China", dial: "+86", flag: "🇨🇳" },
  { code: "JP", name: "Japan", dial: "+81", flag: "🇯🇵" },
  { code: "KR", name: "South Korea", dial: "+82", flag: "🇰🇷" },
  { code: "AU", name: "Australia", dial: "+61", flag: "🇦🇺" },
  { code: "NZ", name: "New Zealand", dial: "+64", flag: "🇳🇿" },
  { code: "ZA", name: "South Africa", dial: "+27", flag: "🇿🇦" },
  { code: "NG", name: "Nigeria", dial: "+234", flag: "🇳🇬" },
  { code: "KE", name: "Kenya", dial: "+254", flag: "🇰🇪" },
  { code: "BR", name: "Brazil", dial: "+55", flag: "🇧🇷" },
  { code: "MX", name: "Mexico", dial: "+52", flag: "🇲🇽" },
  { code: "AR", name: "Argentina", dial: "+54", flag: "🇦🇷" },
];

const DEFAULT = COUNTRIES[0];

export function parsePhone(value: string): { country: Country; national: string } {
  const v = (value || "").trim();
  if (v.startsWith("+")) {
    const match = COUNTRIES.slice()
      .sort((a, b) => b.dial.length - a.dial.length)
      .find((c) => v.startsWith(c.dial));
    if (match) return { country: match, national: v.slice(match.dial.length).trimStart() };
  }
  return { country: DEFAULT, national: v };
}

export function PhoneInput({
  value,
  onChange,
  placeholder = "5X XXX XXXX",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const { country, national } = parsePhone(value);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

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

  const setCountry = (c: Country) => {
    onChange(`${c.dial} ${national}`.trimEnd());
    setOpen(false);
    setQuery("");
  };

  const setNational = (n: string) => {
    const clean = n.replace(/^\+?\d*\s*/, (m) => (m.startsWith("+") ? "" : m));
    onChange(`${country.dial} ${clean}`.trimEnd());
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1 rounded-md px-1.5 text-sm text-foreground hover:bg-surface"
            aria-label="Select country code"
          >
            <span className="tabular-nums text-muted-foreground">{country.dial}</span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-0">
          <div className="flex items-center gap-2 border-b border-border/60 px-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search country or code"
              className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <ul className="max-h-64 overflow-auto py-1">
            {filtered.map((c) => {
              const selected = c.code === country.code;
              return (
                <li key={c.code}>
                  <button
                    type="button"
                    onClick={() => setCountry(c)}
                    className={cn(
                      "flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-surface",
                      selected && "bg-surface",
                    )}
                  >
                    <span className="text-base leading-none">{c.flag}</span>
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="tabular-nums text-muted-foreground">{c.dial}</span>
                    {selected && <Check className="h-3.5 w-3.5 text-primary" />}
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
      <Input
        value={national}
        onChange={(e) => setNational(e.target.value)}
        placeholder={placeholder}
        inputMode="tel"
        className="h-9 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
      />
    </div>
  );
}
