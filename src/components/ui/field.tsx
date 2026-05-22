"use client";

import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Phone, Mail, Loader2 } from "lucide-react";
import { PhoneInput } from "@/components/ui/phone-input";

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
  const [localValue, setLocalValue] = useState(value);
  const [saving, setSaving] = useState(false);

  const handleBlur = async () => {
    if (localValue !== value) {
      setSaving(true);
      await onSave(localValue);
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div>
      <label className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
        {icon}
        {label}
        {saving && <Loader2 className="w-2.5 h-2.5 animate-spin text-primary" />}
      </label>
      <input
        type={type}
        dir={dir}
        value={localValue}
        readOnly={readOnly}
        placeholder={placeholder || "—"}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={cn(
          "w-full h-10 px-3 rounded-lg bg-transparent border text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none transition-colors",
          readOnly
            ? "border-transparent cursor-default"
            : "border-border focus:border-ring",
          saving && "border-primary/50"
        )}
      />
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
  const [saving, setSaving] = useState(false);

  return (
    <div>
      <label className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
        {icon}
        {label}
        {saving && <Loader2 className="w-2.5 h-2.5 animate-spin text-primary" />}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={async (e) => {
            setSaving(true);
            await onSave(e.target.value);
            setSaving(false);
          }}
          className={cn(
            "w-full h-10 px-3 pr-8 rounded-lg bg-transparent border border-border text-[13px] text-foreground appearance-none focus:outline-none focus:border-ring transition-colors cursor-pointer",
            !value && "text-muted-foreground/50",
            saving && "border-primary/50"
          )}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
      </div>
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
  const [localValue, setLocalValue] = useState(value);
  const [saving, setSaving] = useState(false);

  const handleBlur = async () => {
    if (localValue !== value) {
      setSaving(true);
      await onSave(localValue);
      setSaving(false);
    }
  };

  return (
    <div>
      <label className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
        {icon}
        {label}
        {saving && <Loader2 className="w-2.5 h-2.5 animate-spin text-primary" />}
      </label>
      <textarea
        value={localValue}
        placeholder={placeholder || "—"}
        rows={3}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        className={cn(
          "w-full px-3 py-2.5 rounded-lg bg-transparent border border-border text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-ring transition-colors resize-none",
          saving && "border-primary/50"
        )}
      />
    </div>
  );
}

interface PhoneFieldProps extends FieldProps {
  value: string;
  onSave: (value: string) => void | Promise<void>;
}

export function PhoneField({ label, icon, value, onSave }: PhoneFieldProps) {
  const [localValue, setLocalValue] = useState(value);
  const [saving, setSaving] = useState(false);
  const blurTimeoutRef = useRef<NodeJS.Timeout>(undefined);

  const handleChange = (val: string) => {
    setLocalValue(val);
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    blurTimeoutRef.current = setTimeout(async () => {
      if (val !== value && val.length > 4) {
        setSaving(true);
        await onSave(val);
        setSaving(false);
      }
    }, 1500);
  };

  return (
    <div>
      <label className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
        {icon || <Phone className="w-3 h-3" />}
        {label}
        {saving && <Loader2 className="w-2.5 h-2.5 animate-spin text-primary" />}
      </label>
      <PhoneInput
        name="_phone_edit"
        value={localValue}
        onChange={handleChange}
      />
    </div>
  );
}

interface EmailFieldProps extends FieldProps {
  value: string;
  placeholder?: string;
  onSave: (value: string) => void | Promise<void>;
}

export function EmailField({ label, icon, value, placeholder, onSave }: EmailFieldProps) {
  const [localValue, setLocalValue] = useState(value);
  const [saving, setSaving] = useState(false);
  const [formatError, setFormatError] = useState(false);

  const handleBlur = async () => {
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
  };

  return (
    <div>
      <label className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
        {icon || <Mail className="w-3 h-3" />}
        {label}
        {saving && <Loader2 className="w-2.5 h-2.5 animate-spin text-primary" />}
      </label>
      <input
        type="email"
        value={localValue}
        placeholder={placeholder || "—"}
        onChange={(e) => {
          setLocalValue(e.target.value);
          if (formatError) setFormatError(false);
        }}
        onBlur={handleBlur}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        className={cn(
          "w-full h-10 px-3 rounded-lg bg-transparent border text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none transition-colors",
          formatError ? "border-destructive" : "border-border focus:border-ring",
          saving && "border-primary/50"
        )}
      />
      {formatError && (
        <p className="text-[11px] text-destructive mt-1">Please enter a valid email</p>
      )}
    </div>
  );
}
