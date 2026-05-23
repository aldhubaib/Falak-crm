"use client";

import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Phone, Mail, Loader2, Pencil, Check, X, MapPin } from "lucide-react";
import { PhoneInput } from "@/components/ui/phone-input";
import { COUNTRIES, getCountryFlag } from "@/lib/countries";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FieldProps {
  label: string;
  icon?: React.ReactNode;
}

interface InputFieldProps extends FieldProps {
  value: string;
  placeholder?: string;
  type?: string;
  dir?: "ltr" | "rtl";
  readOnly?: boolean;
  onSave: (value: string) => void | Promise<void>;
}

interface SelectFieldProps extends FieldProps {
  value: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  onSave: (value: string) => void | Promise<void>;
}

interface TextareaFieldProps extends FieldProps {
  value: string;
  placeholder?: string;
  onSave: (value: string) => void | Promise<void>;
}

export function InputField({
  label,
  icon,
  value,
  placeholder,
  type = "text",
  dir,
  readOnly,
  onSave,
}: InputFieldProps) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    if (readOnly) return;
    setLocalValue(value);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleSave = async () => {
    if (localValue !== value) {
      setSaving(true);
      await onSave(localValue);
      setSaving(false);
    }
    setEditing(false);
  };

  const handleCancel = () => {
    setLocalValue(value);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") handleCancel();
  };

  return (
    <div
      className={cn(
        "rounded-lg bg-black border px-3 pt-2 pb-1.5 transition-colors group relative",
        editing ? "border-ring" : "border-border",
        saving && "border-primary/50"
      )}
    >
      <label className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        {icon}
        {label}
        {saving && <Loader2 className="w-2.5 h-2.5 animate-spin text-primary" />}
      </label>

      {editing ? (
        <div className="flex items-center gap-1">
          <input
            ref={inputRef}
            type={type}
            dir={dir}
            value={localValue}
            placeholder={placeholder || "—"}
            onChange={(e) => setLocalValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full h-8 bg-transparent border-none text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
          />
          <button onClick={handleSave} className="w-6 h-6 rounded flex items-center justify-center text-primary hover:bg-primary/10 shrink-0">
            <Check className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleCancel} className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:bg-muted/30 shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex items-center h-8 cursor-pointer" onClick={startEdit}>
          <span dir={dir} className={cn("flex-1 text-[13px] truncate", value ? "text-foreground" : "text-muted-foreground/50")}>
            {value || placeholder || "—"}
          </span>
          {!readOnly && (
            <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          )}
        </div>
      )}
    </div>
  );
}

export function SelectField({
  label,
  icon,
  value,
  options,
  placeholder,
  onSave,
}: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const displayLabel = options.find((o) => o.value === value)?.label;

  const filtered = options.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = async (val: string) => {
    if (val !== value) {
      setSaving(true);
      await onSave(val);
      setSaving(false);
    }
    setOpen(false);
    setSearch("");
  };

  return (
    <div className="relative">
      <div
        className={cn(
          "rounded-lg bg-black border px-3 pt-2 pb-1.5 transition-colors cursor-pointer group",
          open ? "border-ring" : "border-border",
          saving && "border-primary/50"
        )}
        onClick={() => {
          setOpen(!open);
          setTimeout(() => searchRef.current?.focus(), 50);
        }}
      >
        <label className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider pointer-events-none">
          {icon}
          {label}
          {saving && <Loader2 className="w-2.5 h-2.5 animate-spin text-primary" />}
        </label>
        <div className="flex items-center h-8">
          <span className={cn("flex-1 text-[13px]", value ? "text-foreground" : "text-muted-foreground/50")}>
            {displayLabel || placeholder || "Select..."}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        </div>
      </div>

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
                    !value && "bg-muted/40"
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
                    value === opt.value && "bg-muted/40"
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

export function TextareaField({
  label,
  icon,
  value,
  placeholder,
  onSave,
}: TextareaFieldProps) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const startEdit = () => {
    setLocalValue(value);
    setEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleSave = async () => {
    if (localValue !== value) {
      setSaving(true);
      await onSave(localValue);
      setSaving(false);
    }
    setEditing(false);
  };

  const handleCancel = () => {
    setLocalValue(value);
    setEditing(false);
  };

  return (
    <div
      className={cn(
        "rounded-lg bg-black border px-3 pt-2 pb-1.5 transition-colors group relative",
        editing ? "border-ring" : "border-border",
        saving && "border-primary/50"
      )}
    >
      <label className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        {icon}
        {label}
        {saving && <Loader2 className="w-2.5 h-2.5 animate-spin text-primary" />}
      </label>

      {editing ? (
        <div>
          <textarea
            ref={textareaRef}
            value={localValue}
            placeholder={placeholder || "—"}
            rows={3}
            onChange={(e) => setLocalValue(e.target.value)}
            className="w-full py-1.5 bg-transparent border-none text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none resize-none"
          />
          <div className="flex items-center gap-1 justify-end pb-1">
            <button onClick={handleSave} className="w-6 h-6 rounded flex items-center justify-center text-primary hover:bg-primary/10">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleCancel} className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:bg-muted/30">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start min-h-[2rem] py-1.5 cursor-pointer" onClick={startEdit}>
          <span className={cn("flex-1 text-[13px] whitespace-pre-wrap", value ? "text-foreground" : "text-muted-foreground/50")}>
            {value || placeholder || "—"}
          </span>
          <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
        </div>
      )}
    </div>
  );
}

interface PhoneFieldProps extends FieldProps {
  value: string;
  onSave: (value: string) => void | Promise<void>;
}

export function PhoneField({ label, icon, value, onSave }: PhoneFieldProps) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setLocalValue(value);
    setEditing(true);
  };

  const handleSave = async () => {
    if (localValue !== value) {
      setSaving(true);
      await onSave(localValue);
      setSaving(false);
    }
    setEditing(false);
  };

  const handleCancel = () => {
    setLocalValue(value);
    setEditing(false);
  };

  return (
    <div
      className={cn(
        "rounded-lg bg-black border px-3 pt-2 pb-1.5 transition-colors group relative",
        editing ? "border-ring" : "border-border",
        saving && "border-primary/50"
      )}
    >
      <label className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        {icon || <Phone className="w-3 h-3" />}
        {label}
        {saving && <Loader2 className="w-2.5 h-2.5 animate-spin text-primary" />}
      </label>

      {editing ? (
        <div className="flex items-center gap-1">
          <div className="flex-1">
            <PhoneInput
              name="_phone_edit"
              value={localValue}
              onChange={setLocalValue}
              embedded
            />
          </div>
          <button onClick={handleSave} className="w-6 h-6 rounded flex items-center justify-center text-primary hover:bg-primary/10 shrink-0">
            <Check className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleCancel} className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:bg-muted/30 shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex items-center h-8 cursor-pointer" onClick={startEdit}>
          <span className={cn("flex-1 text-[13px]", value ? "text-foreground" : "text-muted-foreground/50")}>
            {value || "—"}
          </span>
          <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </div>
      )}
    </div>
  );
}

interface EmailFieldProps extends FieldProps {
  value: string;
  placeholder?: string;
  onSave: (value: string) => void | Promise<void>;
}

export function EmailField({ label, icon, value, placeholder, onSave }: EmailFieldProps) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const [saving, setSaving] = useState(false);
  const [formatError, setFormatError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setLocalValue(value);
    setFormatError(false);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleSave = async () => {
    if (localValue && !EMAIL_REGEX.test(localValue)) {
      setFormatError(true);
      return;
    }
    setFormatError(false);
    if (localValue !== value) {
      setSaving(true);
      await onSave(localValue);
      setSaving(false);
    }
    setEditing(false);
  };

  const handleCancel = () => {
    setLocalValue(value);
    setFormatError(false);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") handleCancel();
  };

  return (
    <div>
      <div
        className={cn(
          "rounded-lg bg-black border px-3 pt-2 pb-1.5 transition-colors group relative",
          editing ? "border-ring" : "border-border",
          formatError && "border-destructive",
          saving && "border-primary/50"
        )}
      >
        <label className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          {icon || <Mail className="w-3 h-3" />}
          {label}
          {saving && <Loader2 className="w-2.5 h-2.5 animate-spin text-primary" />}
        </label>

        {editing ? (
          <div className="flex items-center gap-1">
            <input
              ref={inputRef}
              type="email"
              value={localValue}
              placeholder={placeholder || "—"}
              onChange={(e) => {
                setLocalValue(e.target.value);
                if (formatError) setFormatError(false);
              }}
              onKeyDown={handleKeyDown}
              className="w-full h-8 bg-transparent border-none text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
            />
            <button onClick={handleSave} className="w-6 h-6 rounded flex items-center justify-center text-primary hover:bg-primary/10 shrink-0">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleCancel} className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:bg-muted/30 shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center h-8 cursor-pointer" onClick={startEdit}>
            <span className={cn("flex-1 text-[13px] truncate", value ? "text-foreground" : "text-muted-foreground/50")}>
              {value || placeholder || "—"}
            </span>
            <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </div>
        )}
      </div>
      {formatError && (
        <p className="text-[11px] text-destructive mt-1">Please enter a valid email</p>
      )}
    </div>
  );
}

interface CountryFieldProps extends FieldProps {
  value: string;
  onSave: (value: string) => void | Promise<void>;
}

export function CountryField({ label, icon, value, onSave }: CountryFieldProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const flag = getCountryFlag(value);
  const filtered = COUNTRIES.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = async (name: string) => {
    if (name !== value) {
      setSaving(true);
      await onSave(name);
      setSaving(false);
    }
    setOpen(false);
    setSearch("");
  };

  return (
    <div className="relative" ref={containerRef}>
      <div
        className={cn(
          "rounded-lg bg-black border px-3 pt-2 pb-1.5 transition-colors group cursor-pointer",
          open ? "border-ring" : "border-border",
          saving && "border-primary/50"
        )}
        onClick={() => {
          setOpen(!open);
          setTimeout(() => searchRef.current?.focus(), 50);
        }}
      >
        <label className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider pointer-events-none">
          {icon || <MapPin className="w-3 h-3" />}
          {label}
          {saving && <Loader2 className="w-2.5 h-2.5 animate-spin text-primary" />}
        </label>
        <div className="flex items-center h-8">
          <span className={cn("flex-1 text-[13px] flex items-center gap-2", value ? "text-foreground" : "text-muted-foreground/50")}>
            {flag && <span className="text-[16px]">{flag}</span>}
            {value || "Select country..."}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        </div>
      </div>

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
                  if (e.key === "Enter" && filtered.length > 0) handleSelect(filtered[0].name);
                }}
              />
            </div>
            <div className="max-h-[200px] overflow-y-auto border-t border-border">
              {filtered.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => handleSelect(c.name)}
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
    </div>
  );
}
