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
      <div
        className={cn(
          "rounded-lg bg-black border px-3 pt-2 pb-1.5 transition-colors focus-within:border-ring",
          hasError ? "border-destructive" : "border-border"
        )}
      >
        {label && (
          <label className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
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
          className="w-full h-8 bg-transparent border-none text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
        />
      </div>
      {hasError && (
        <p className="text-[11px] text-destructive mt-1">
          {externalErrorMessage || "Please enter a valid email address"}
        </p>
      )}
    </div>
  );
}
