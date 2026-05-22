"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Pencil, Check, X, ChevronDown, Phone, Mail } from "lucide-react";
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
  onSave,
}: InputFieldProps) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

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
    <div>
      <label className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
        {icon}
        {label}
      </label>

      {!editing ? (
        <div
          onClick={() => setEditing(true)}
          className="group flex items-center gap-2 w-full h-10 px-3 rounded-lg border border-transparent hover:border-border cursor-pointer transition-colors"
        >
          <span className={cn("flex-1 text-[13px] truncate", value ? "text-foreground" : "text-muted-foreground/50")}>
            {value || placeholder || "—"}
          </span>
          <Pencil className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <input
            ref={inputRef}
            type={type}
            dir={dir}
            value={localValue}
            placeholder={placeholder}
            onChange={(e) => setLocalValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") handleCancel();
            }}
            className="flex-1 h-10 px-3 rounded-lg bg-transparent border border-ring text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none transition-colors"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-8 h-8 rounded-full border border-primary flex items-center justify-center text-primary hover:bg-primary hover:text-primary-foreground transition-colors shrink-0 disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleCancel}
            className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground transition-colors shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
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
  const [saving, setSaving] = useState(false);

  return (
    <div>
      <label className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
        {icon}
        {label}
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
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

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
    <div>
      <label className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
        {icon}
        {label}
      </label>

      {!editing ? (
        <div
          onClick={() => setEditing(true)}
          className="group flex items-start gap-2 w-full min-h-[60px] px-3 py-2.5 rounded-lg border border-transparent hover:border-border cursor-pointer transition-colors"
        >
          <span className={cn("flex-1 text-[13px] whitespace-pre-wrap", value ? "text-foreground" : "text-muted-foreground/50")}>
            {value || placeholder || "—"}
          </span>
          <Pencil className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
        </div>
      ) : (
        <div>
          <textarea
            ref={textareaRef}
            value={localValue}
            placeholder={placeholder}
            rows={3}
            onChange={(e) => setLocalValue(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg bg-transparent border border-ring text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none transition-colors resize-none"
          />
          <div className="flex items-center gap-1.5 mt-1.5">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-8 h-8 rounded-full border border-primary flex items-center justify-center text-primary hover:bg-primary hover:text-primary-foreground transition-colors shrink-0 disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleCancel}
              className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
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
    <div>
      <label className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
        {icon || <Phone className="w-3 h-3" />}
        {label}
      </label>

      {!editing ? (
        <div
          onClick={() => setEditing(true)}
          className="group flex items-center gap-2 w-full h-10 px-3 rounded-lg border border-transparent hover:border-border cursor-pointer transition-colors"
        >
          <span className={cn("flex-1 text-[13px] truncate", value ? "text-foreground" : "text-muted-foreground/50")}>
            {value || "—"}
          </span>
          <Pencil className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <div className="flex-1">
            <PhoneInput
              name="_phone_edit"
              value={localValue}
              onChange={(val) => setLocalValue(val)}
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-8 h-8 rounded-full border border-primary flex items-center justify-center text-primary hover:bg-primary hover:text-primary-foreground transition-colors shrink-0 disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleCancel}
            className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground transition-colors shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
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

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

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

  return (
    <div>
      <label className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
        {icon || <Mail className="w-3 h-3" />}
        {label}
      </label>

      {!editing ? (
        <div
          onClick={() => setEditing(true)}
          className="group flex items-center gap-2 w-full h-10 px-3 rounded-lg border border-transparent hover:border-border cursor-pointer transition-colors"
        >
          <span className={cn("flex-1 text-[13px] truncate", value ? "text-foreground" : "text-muted-foreground/50")}>
            {value || placeholder || "—"}
          </span>
          <Pencil className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-1.5">
            <input
              ref={inputRef}
              type="email"
              value={localValue}
              placeholder={placeholder}
              onChange={(e) => {
                setLocalValue(e.target.value);
                if (formatError) setFormatError(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") handleCancel();
              }}
              className={cn(
                "flex-1 h-10 px-3 rounded-lg bg-transparent border text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none transition-colors",
                formatError ? "border-destructive" : "border-ring"
              )}
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-8 h-8 rounded-full border border-primary flex items-center justify-center text-primary hover:bg-primary hover:text-primary-foreground transition-colors shrink-0 disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleCancel}
              className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {formatError && (
            <p className="text-[11px] text-destructive mt-1">Please enter a valid email address</p>
          )}
        </div>
      )}
    </div>
  );
}
