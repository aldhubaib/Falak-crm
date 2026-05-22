"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

const countryCodes = [
  { code: "+966", country: "SA", name: "Saudi Arabia", flag: "🇸🇦" },
  { code: "+971", country: "AE", name: "United Arab Emirates", flag: "🇦🇪" },
  { code: "+965", country: "KW", name: "Kuwait", flag: "🇰🇼" },
  { code: "+973", country: "BH", name: "Bahrain", flag: "🇧🇭" },
  { code: "+974", country: "QA", name: "Qatar", flag: "🇶🇦" },
  { code: "+968", country: "OM", name: "Oman", flag: "🇴🇲" },
  { code: "+20", country: "EG", name: "Egypt", flag: "🇪🇬" },
  { code: "+962", country: "JO", name: "Jordan", flag: "🇯🇴" },
  { code: "+961", country: "LB", name: "Lebanon", flag: "🇱🇧" },
  { code: "+964", country: "IQ", name: "Iraq", flag: "🇮🇶" },
  { code: "+212", country: "MA", name: "Morocco", flag: "🇲🇦" },
  { code: "+216", country: "TN", name: "Tunisia", flag: "🇹🇳" },
  { code: "+1", country: "US", name: "United States", flag: "🇺🇸" },
  { code: "+44", country: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "+49", country: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "+33", country: "FR", name: "France", flag: "🇫🇷" },
  { code: "+91", country: "IN", name: "India", flag: "🇮🇳" },
  { code: "+92", country: "PK", name: "Pakistan", flag: "🇵🇰" },
  { code: "+63", country: "PH", name: "Philippines", flag: "🇵🇭" },
  { code: "+880", country: "BD", name: "Bangladesh", flag: "🇧🇩" },
];

interface PhoneInputProps {
  name: string;
  label?: string;
  value?: string;
  placeholder?: string;
  required?: boolean;
  error?: boolean;
  errorMessage?: string;
  onChange?: (fullNumber: string) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

function parsePhone(value: string) {
  if (!value) return { code: "", number: "" };
  for (const c of countryCodes) {
    if (value.startsWith(c.code)) {
      return { code: c.code, number: value.slice(c.code.length).trim() };
    }
  }
  return { code: "", number: value.replace(/^\+/, "") };
}

export function PhoneInput({
  name,
  label,
  value = "",
  placeholder = "5XXXXXXXX",
  required,
  error,
  errorMessage,
  onChange,
  inputRef,
}: PhoneInputProps) {
  const parsed = parsePhone(value);
  const [selectedCode, setSelectedCode] = useState(parsed.code);
  const [number, setNumber] = useState(parsed.number);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const localInputRef = useRef<HTMLInputElement>(null);
  const ref = inputRef || localInputRef;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fullNumber = `${selectedCode}${number}`;

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^\d]/g, "");
    setNumber(val);
    onChange?.(`${selectedCode}${val}`);
  };

  const handleCodeSelect = (code: string) => {
    setSelectedCode(code);
    setDropdownOpen(false);
    setSearch("");
    onChange?.(`${code}${number}`);
  };

  const filtered = search
    ? countryCodes.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.country.toLowerCase().includes(search.toLowerCase()) ||
          c.code.includes(search)
      )
    : countryCodes;

  return (
    <div>
      {label && (
        <label className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
          <Phone className="w-3 h-3" />
          {label}
          {required && <span className="text-destructive">*</span>}
        </label>
      )}
      <div ref={containerRef} className="relative">
        <div
          className={cn(
            "flex items-center h-10 rounded-lg border transition-colors",
            error ? "border-destructive" : "border-border focus-within:border-ring"
          )}
        >
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-1 px-2.5 h-full border-r border-border text-[12px] text-foreground hover:bg-muted/30 rounded-l-lg transition-colors shrink-0"
          >
            {selectedCode ? (
              <>
                <span className="text-[14px]">
                  {countryCodes.find((c) => c.code === selectedCode)?.flag}
                </span>
                <span className="text-muted-foreground">{selectedCode}</span>
              </>
            ) : (
              <span className="text-muted-foreground/50">Code</span>
            )}
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </button>
          <input
            ref={ref}
            value={number}
            onChange={handleNumberChange}
            placeholder={placeholder}
            className="flex-1 h-full px-3 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none"
          />
        </div>
        <input type="hidden" name={name} value={fullNumber} />

        {dropdownOpen && (
          <div className="absolute top-full left-0 mt-1 w-56 bg-background border border-border rounded-lg shadow-xl z-50 overflow-hidden">
            <div className="p-2 border-b border-border">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                autoFocus
                className="w-full h-8 px-2 rounded bg-muted/30 border-none text-[12px] text-foreground placeholder:text-muted-foreground/50 outline-none"
              />
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filtered.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => handleCodeSelect(c.code)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-muted/30 transition-colors",
                    selectedCode === c.code && "bg-muted/40"
                  )}
                >
                  <span className="text-[14px]">{c.flag}</span>
                  <span className="text-foreground">{c.name}</span>
                  <span className="text-muted-foreground ml-auto">{c.code}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {error && errorMessage && (
        <p className="text-[11px] text-destructive mt-1">{errorMessage}</p>
      )}
    </div>
  );
}
