"use client";

import { useState } from "react";
import { createContact } from "@/actions/contacts";
import { PhoneInput } from "@/components/ui/phone-input";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useErrorStore } from "@/lib/error-store";
import { Plus, X } from "lucide-react";

interface AddContactFormProps {
  companyId?: string;
  onSuccess?: () => void;
}

export function AddContactForm({ companyId, onSuccess }: AddContactFormProps) {
  const router = useRouter();
  const { push: pushError } = useErrorStore();
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="w-3.5 h-3.5" />
        Add Contact
      </Button>
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        if (companyId) formData.set("companyId", companyId);
        const result = await createContact(formData);
        if (!result.ok) {
          if (result.error.prismaCode === "P2002") {
            pushError({ ...result.error, message: "A contact with this mobile already exists" });
          } else {
            pushError(result.error);
          }
          return;
        }
        setOpen(false);
        onSuccess?.();
        router.refresh();
      }}
      className="rounded-lg border border-border p-4 space-y-3"
    >
      <div className="flex items-center justify-between mb-1">
        <p className="text-[12px] font-medium text-foreground">New Contact</p>
        <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-lg bg-black border border-border px-3 pt-2 pb-1.5 focus-within:border-ring transition-colors">
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            First Name <span className="text-destructive">*</span>
          </label>
          <input
            name="firstName"
            placeholder="First name"
            required
            autoFocus
            className="w-full h-8 bg-transparent border-none text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
          />
        </div>
        <div className="rounded-lg bg-black border border-border px-3 pt-2 pb-1.5 focus-within:border-ring transition-colors">
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            Last Name <span className="text-destructive">*</span>
          </label>
          <input
            name="lastName"
            placeholder="Last name"
            required
            className="w-full h-8 bg-transparent border-none text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <PhoneInput name="mobile" label="Mobile" required />
        <div className="rounded-lg bg-black border border-border px-3 pt-2 pb-1.5 focus-within:border-ring transition-colors">
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            Email
          </label>
          <input
            name="email"
            type="email"
            placeholder="name@company.com"
            className="w-full h-8 bg-transparent border-none text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-lg bg-black border border-border px-3 pt-2 pb-1.5 focus-within:border-ring transition-colors">
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            Country <span className="text-destructive">*</span>
          </label>
          <input
            name="country"
            placeholder="Country"
            required
            className="w-full h-8 bg-transparent border-none text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
          />
        </div>
        <div className="rounded-lg bg-black border border-border px-3 pt-2 pb-1.5 focus-within:border-ring transition-colors">
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Role</label>
          <input
            name="role"
            placeholder="Title / Position"
            className="w-full h-8 bg-transparent border-none text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button type="submit" size="sm">Create</Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}
