"use client";

import { useState, useRef } from "react";
import { type FieldDef } from "@/lib/fields";
import { PhoneInput } from "@/components/ui/phone-input";
import { EmailInput } from "@/components/ui/email-input";
import { COUNTRIES, getCountryFlag } from "@/lib/countries";
import { cn } from "@/lib/utils";
import {
  User, Phone, Mail, MapPin, Building2, Globe, UserPlus, ChevronDown,
} from "lucide-react";

const ICONS: Record<string, React.ReactNode> = {
  User: <User className="w-3 h-3" />,
  Phone: <Phone className="w-3 h-3" />,
  Mail: <Mail className="w-3 h-3" />,
  MapPin: <MapPin className="w-3 h-3" />,
  Building2: <Building2 className="w-3 h-3" />,
  Globe: <Globe className="w-3 h-3" />,
  UserPlus: <UserPlus className="w-3 h-3" />,
};

interface FormFieldProps {
  def: FieldDef;
  value: string;
  error?: string | null;
  onChange: (value: string) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

export function FormField({ def, value, error, onChange, inputRef }: FormFieldProps) {
  const hasError = !!error;
  const icon = def.icon ? ICONS[def.icon] : null;
  const isRequired = def.validation?.required;

  if (def.type === "phone") {
    return (
      <div className={cn(hasError && "shake")}>
        <PhoneInput
          name={def.key}
          label={def.label}
          value={value}
          placeholder={def.placeholder}
          required={isRequired}
          error={hasError}
          errorMessage={error || undefined}
          inputRef={inputRef}
          onChange={onChange}
        />
      </div>
    );
  }

  if (def.type === "email") {
    return (
      <div className={cn(hasError && "shake")}>
        <EmailInput
          name={def.key}
          label={def.label}
          value={value}
          placeholder={def.placeholder}
          required={isRequired}
          error={hasError}
          errorMessage={error || undefined}
          onChange={onChange}
        />
      </div>
    );
  }

  if (def.type === "country") {
    return <CountryFormField def={def} value={value} error={error} onChange={onChange} icon={icon} />;
  }

  // text / arabic
  return (
    <div className={cn(hasError && "shake")}>
      <div
        className={cn(
          "rounded-lg bg-black border px-3 pt-2 pb-1.5 transition-colors focus-within:border-ring",
          hasError ? "border-destructive" : "border-border"
        )}
      >
        <label className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          {icon}
          {def.label}
          {isRequired && <span className="text-destructive">*</span>}
        </label>
        <input
          ref={inputRef}
          name={def.key}
          value={value}
          dir={def.dir}
          placeholder={def.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-8 bg-transparent border-none text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
        />
      </div>
      {hasError && (
        <p className="text-[11px] text-destructive mt-1">{error}</p>
      )}
    </div>
  );
}

function CountryFormField({
  def,
  value,
  error,
  onChange,
  icon,
}: {
  def: FieldDef;
  value: string;
  error?: string | null;
  onChange: (value: string) => void;
  icon: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const hasError = !!error;
  const isRequired = def.validation?.required;
  const flag = getCountryFlag(value);

  const filtered = COUNTRIES.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={cn("relative", hasError && "shake")}>
      <input type="hidden" name={def.key} value={value} />
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          setTimeout(() => searchRef.current?.focus(), 50);
        }}
        className={cn(
          "w-full rounded-lg bg-black border px-3 pt-2 pb-1.5 text-left transition-colors",
          hasError ? "border-destructive" : "border-border",
          open && !hasError && "border-ring"
        )}
      >
        <label className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider pointer-events-none">
          {icon || <MapPin className="w-3 h-3" />}
          {def.label}
          {isRequired && <span className="text-destructive">*</span>}
        </label>
        <div className="flex items-center justify-between h-8">
          <span className={cn("text-[13px] flex items-center gap-2", value ? "text-foreground" : "text-muted-foreground/50")}>
            {flag && <span className="text-[16px]">{flag}</span>}
            {value || def.placeholder || "Select country..."}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        </div>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setSearch(""); }} />
          <div className="absolute z-50 top-full mt-1 w-full rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
            <div className="p-1.5">
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search countries..."
                className="w-full h-8 px-2.5 rounded bg-black text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Escape") { setOpen(false); setSearch(""); }
                  if (e.key === "Enter" && filtered.length > 0) {
                    onChange(filtered[0].name);
                    setOpen(false);
                    setSearch("");
                  }
                }}
              />
            </div>
            <div className="max-h-[200px] overflow-y-auto border-t border-border">
              {filtered.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => {
                    onChange(c.name);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-muted/30 transition-colors",
                    value === c.name && "bg-muted/40"
                  )}
                >
                  <span className="text-[14px]">{c.flag}</span>
                  <span className="text-foreground">{c.name}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="px-3 py-2 text-[11px] text-muted-foreground">No countries found</p>
              )}
            </div>
          </div>
        </>
      )}

      {hasError && (
        <p className="text-[11px] text-destructive mt-1">{error}</p>
      )}
    </div>
  );
}
