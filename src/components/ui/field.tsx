"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

interface FieldProps {
  label: string;
  icon?: React.ReactNode;
}

interface InputFieldProps extends FieldProps {
  value: string;
  placeholder?: string;
  type?: string;
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
  onSave,
}: InputFieldProps) {
  const [localValue, setLocalValue] = useState(value);
  const [saving, setSaving] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedSave = useCallback(
    (val: string) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(async () => {
        if (val !== value) {
          setSaving(true);
          await onSave(val);
          setSaving(false);
        }
      }, 600);
    },
    [onSave, value]
  );

  return (
    <div>
      <label className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
        {icon}
        {label}
      </label>
      <div className="relative">
        <input
          type={type}
          value={localValue}
          placeholder={placeholder}
          onChange={(e) => {
            setLocalValue(e.target.value);
            debouncedSave(e.target.value);
          }}
          onBlur={() => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (localValue !== value) {
              setSaving(true);
              Promise.resolve(onSave(localValue)).then(() => setSaving(false));
            }
          }}
          className={cn(
            "w-full h-10 px-3 rounded-lg bg-transparent border border-border text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-ring transition-colors",
            saving && "border-primary/50"
          )}
        />
        {saving && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        )}
      </div>
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
  const [localValue, setLocalValue] = useState(value);
  const [saving, setSaving] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedSave = useCallback(
    (val: string) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(async () => {
        if (val !== value) {
          setSaving(true);
          await onSave(val);
          setSaving(false);
        }
      }, 600);
    },
    [onSave, value]
  );

  return (
    <div>
      <label className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
        {icon}
        {label}
      </label>
      <div className="relative">
        <textarea
          value={localValue}
          placeholder={placeholder}
          rows={3}
          onChange={(e) => {
            setLocalValue(e.target.value);
            debouncedSave(e.target.value);
          }}
          onBlur={() => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (localValue !== value) {
              setSaving(true);
              Promise.resolve(onSave(localValue)).then(() => setSaving(false));
            }
          }}
          className={cn(
            "w-full px-3 py-2.5 rounded-lg bg-transparent border border-border text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-ring transition-colors resize-none",
            saving && "border-primary/50"
          )}
        />
        {saving && (
          <div className="absolute right-3 top-3 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        )}
      </div>
    </div>
  );
}
