"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { cn } from "@/lib/utils";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface EmailInputProps {
  name: string;
  label?: string;
  value?: string;
  placeholder?: string;
  required?: boolean;
  error?: boolean;
  errorMessage?: string;
  onChange?: (value: string) => void;
}

export function EmailInput({
  name,
  label,
  value = "",
  placeholder = "name@company.com",
  required,
  error: externalError,
  errorMessage: externalErrorMessage,
  onChange,
}: EmailInputProps) {
  const [internalValue, setInternalValue] = useState(value);
  const [formatError, setFormatError] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInternalValue(val);
    onChange?.(val);

    if (val && !EMAIL_REGEX.test(val)) {
      setFormatError(true);
    } else {
      setFormatError(false);
    }
  };

  const handleBlur = () => {
    if (internalValue && !EMAIL_REGEX.test(internalValue)) {
      setFormatError(true);
    } else {
      setFormatError(false);
    }
  };

  const hasError = externalError || formatError;

  return (
    <div>
      {label && (
        <label className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
          <Mail className="w-3 h-3" />
          {label}
          {required && <span className="text-destructive">*</span>}
        </label>
      )}
      <input
        name={name}
        type="email"
        value={internalValue}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={cn(
          "w-full h-10 px-3 rounded-lg bg-transparent border text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none transition-colors",
          hasError ? "border-destructive focus:border-destructive" : "border-border focus:border-ring"
        )}
      />
      {hasError && (
        <p className="text-[11px] text-destructive mt-1">
          {externalErrorMessage || "Please enter a valid email address"}
        </p>
      )}
    </div>
  );
}
