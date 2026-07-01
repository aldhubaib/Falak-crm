"use client";

import { useState, useRef } from "react";
import { type FieldDef } from "@/lib/fields";
import { PhoneInput } from "@/components/ui/phone-input";
import { EmailInput } from "@/components/ui/email-input";
import { COUNTRIES, getCountryFlag } from "@/lib/countries";
import { cn } from "@/lib/utils";
import {
  User, Phone, Mail, MapPin, Building2, Globe, UserPlus, ChevronDown, Layers, DollarSign, Handshake,
} from "lucide-react";

const ICONS: Record<string, React.ReactNode> = {
  User: <User className="w-icon-sm h-icon-sm" />,
  Phone: <Phone className="w-icon-sm h-icon-sm" />,
  Mail: <Mail className="w-icon-sm h-icon-sm" />,
  MapPin: <MapPin className="w-icon-sm h-icon-sm" />,
  Building2: <Building2 className="w-icon-sm h-icon-sm" />,
  Globe: <Globe className="w-icon-sm h-icon-sm" />,
  UserPlus: <UserPlus className="w-icon-sm h-icon-sm" />,
  Layers: <Layers className="w-icon-sm h-icon-sm" />,
  DollarSign: <DollarSign className="w-icon-sm h-icon-sm" />,
  Handshake: <Handshake className="w-icon-sm h-icon-sm" />,
};

interface FormFieldProps {
  def: FieldDef;
  value: string;
  error?: string | null;
  onChange: (value: string) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  suffix?: string;
}

export function FormField({ def, value, error, onChange, inputRef, suffix }: FormFieldProps) {
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

  const displaySuffix = suffix || def.suffix;

  // text / arabic / textarea — all use auto-expanding textarea
  return (
    <div className={cn(hasError && "shake")}>
      <div
        className={cn(
          "rounded-lg bg-black border px-3 pt-2 pb-1.5 transition-colors focus-within:border-ring",
          hasError ? "border-destructive" : "border-border"
        )}
      >
        <label className="flex items-center gap-1.5 text-label font-medium text-muted-foreground uppercase tracking-wider">
          {icon}
          {def.label}
          {isRequired && <span className="text-destructive">*</span>}
        </label>
        <div className="flex items-center gap-2">
          <textarea
            ref={(el) => {
              if (inputRef) (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = el as unknown as HTMLInputElement;
              if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; }
            }}
            name={def.key}
            value={value}
            dir={def.dir}
            placeholder={def.placeholder}
            onChange={(e) => {
              onChange(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            rows={1}
            className="flex-1 min-h-[2rem] py-1 bg-transparent border-none text-body text-foreground placeholder:text-muted-foreground/50 focus:outline-none resize-none overflow-hidden"
          />
          {displaySuffix && (
            <span className="text-sub text-muted-foreground font-medium shrink-0">{displaySuffix}</span>
          )}
        </div>
      </div>
      {hasError && (
        <p className="text-sub text-destructive mt-1">{error}</p>
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
        <label className="flex items-center gap-1.5 text-label font-medium text-muted-foreground uppercase tracking-wider pointer-events-none">
          {icon || <MapPin className="w-icon-sm h-icon-sm" />}
          {def.label}
          {isRequired && <span className="text-destructive">*</span>}
        </label>
        <div className="flex items-center justify-between h-input">
          <span className={cn("text-body flex items-center gap-2", value ? "text-foreground" : "text-muted-foreground/50")}>
            {flag && <span className="text-[16px]">{flag}</span>}
            {value || def.placeholder || "Select country..."}
          </span>
          <ChevronDown className="w-icon-sm h-icon-sm text-muted-foreground shrink-0" />
        </div>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setSearch(""); }} />
          <div className="absolute z-50 top-full mt-1 w-full rounded-lg border border-border bg-black shadow-lg overflow-hidden">
            <div className="p-1.5">
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search countries..."
                className="w-full h-input px-2.5 rounded bg-black text-sub text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
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
                    "w-full flex items-center gap-2 px-3 min-h-touch text-left text-sub hover:bg-muted/30 transition-colors",
                    value === c.name && "bg-muted/40"
                  )}
                >
                  <span className="text-body">{c.flag}</span>
                  <span className="text-foreground">{c.name}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="px-3 py-2 text-sub text-muted-foreground">No countries found</p>
              )}
            </div>
          </div>
        </>
      )}

      {hasError && (
        <p className="text-sub text-destructive mt-1">{error}</p>
      )}
    </div>
  );
}
