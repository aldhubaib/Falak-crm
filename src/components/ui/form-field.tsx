"use client";

import { type FieldDef } from "@/lib/fields";
import { PhoneInput } from "@/components/ui/phone-input";
import { EmailInput } from "@/components/ui/email-input";
import { cn } from "@/lib/utils";
import {
  User, Phone, Mail, MapPin, Building2, Globe, UserPlus,
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

  // text / arabic
  return (
    <div className={cn(hasError && "shake")}>
      <label className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
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
        className={cn(
          "w-full h-10 px-3 rounded-lg bg-transparent border text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none transition-colors",
          hasError ? "border-destructive focus:border-destructive" : "border-border focus:border-ring"
        )}
      />
      {hasError && (
        <p className="text-[11px] text-destructive mt-1">{error}</p>
      )}
    </div>
  );
}
