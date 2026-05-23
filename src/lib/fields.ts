/**
 * Field Registry — single source of truth for all form fields.
 * 
 * Each field definition specifies its type, label, placeholder, validation,
 * and any extra config. Forms reference fields by key and the FormField
 * component renders them consistently everywhere.
 */

export type FieldType = "text" | "phone" | "email" | "arabic" | "combobox" | "textarea" | "country";

export type FieldValidation = {
  required?: boolean;
  arabic?: boolean;
  email?: boolean;
  minLength?: number;
};

export type FieldDef = {
  key: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  icon?: string;
  dir?: "ltr" | "rtl";
  validation?: FieldValidation;
};

export const FIELD_REGISTRY: Record<string, FieldDef> = {
  // ─── Contact Fields ─────────────────────────────────────────
  firstName: {
    key: "firstName",
    type: "text",
    label: "First Name",
    placeholder: "First name",
    icon: "User",
    validation: { required: true },
  },
  middleName: {
    key: "middleName",
    type: "text",
    label: "Middle Name",
    placeholder: "Middle name",
  },
  lastName: {
    key: "lastName",
    type: "text",
    label: "Last Name",
    placeholder: "Last name",
    validation: { required: true },
  },
  nameAr: {
    key: "nameAr",
    type: "arabic",
    label: "الاسم بالعربي (Arabic Name)",
    placeholder: "الاسم الكامل بالعربي",
    dir: "rtl",
    validation: { required: true, arabic: true },
  },
  mobile: {
    key: "mobile",
    type: "phone",
    label: "Mobile",
    placeholder: "5XXXXXXXX",
    icon: "Phone",
    validation: { required: true },
  },
  email: {
    key: "email",
    type: "email",
    label: "Email",
    placeholder: "name@company.com",
    icon: "Mail",
    validation: { email: true },
  },
  role: {
    key: "role",
    type: "text",
    label: "Role",
    placeholder: "Title / Position",
  },
  country: {
    key: "country",
    type: "country",
    label: "Country",
    placeholder: "Select country...",
    icon: "MapPin",
    validation: { required: true },
  },

  // ─── Company Fields ─────────────────────────────────────────
  companyName: {
    key: "name",
    type: "text",
    label: "Company Name",
    placeholder: "Company name",
    icon: "Building2",
    validation: { required: true },
  },
  companyNameAr: {
    key: "nameAr",
    type: "arabic",
    label: "Company Name (Arabic)",
    placeholder: "اسم الشركة",
    dir: "rtl",
    validation: { required: true, arabic: true },
  },
  industry: {
    key: "industry",
    type: "combobox",
    label: "Industry",
    placeholder: "Select industry...",
    validation: { required: true },
  },
  referral: {
    key: "referral",
    type: "combobox",
    label: "Referral",
    placeholder: "Select referral...",
    icon: "UserPlus",
    validation: { required: true },
  },
  website: {
    key: "website",
    type: "text",
    label: "Website",
    placeholder: "https://",
    icon: "Globe",
  },

  // ─── Deal Fields ───────────────────────────────────────────
  dealTitle: {
    key: "title",
    type: "text",
    label: "Deal Title",
    placeholder: "Deal title",
    icon: "Handshake",
    validation: { required: true },
  },
  dealValue: {
    key: "value",
    type: "text",
    label: "Value",
    placeholder: "0.00",
    icon: "DollarSign",
  },
};

/**
 * Validate a single field value against its definition.
 * Returns an error message string or null if valid.
 */
export function validateField(def: FieldDef, value: string): string | null {
  const v = def.validation;
  if (!v) return null;

  const trimmed = value.trim();

  if (v.required && !trimmed) {
    return `${def.label} is required`;
  }

  if (v.arabic && trimmed && !/[\u0600-\u06FF]/.test(trimmed)) {
    return "Please enter text in Arabic";
  }

  if (v.email && trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return "Please enter a valid email address";
  }

  if (v.minLength && trimmed.length < v.minLength) {
    return `Must be at least ${v.minLength} characters`;
  }

  return null;
}

/**
 * Validate multiple fields at once.
 * Returns a map of field key → error message for invalid fields.
 */
export function validateFields(
  fields: FieldDef[],
  values: Record<string, string>
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const def of fields) {
    const error = validateField(def, values[def.key] || "");
    if (error) errors[def.key] = error;
  }
  return errors;
}
