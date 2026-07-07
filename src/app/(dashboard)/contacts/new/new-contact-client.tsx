"use client";

// New Contact form, matching the Lovable design: field cards in a two-column
// grid with the save action in the header. The phone input carries a country
// dial-code picker; the contact's country is derived from it.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { PageContainer } from "@/components/page-container";
import { SaveButton } from "@/components/save-button";
import { FieldCard } from "@/components/crm/field-card";
import { PhoneInput, parsePhone } from "@/components/phone-input";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createContact } from "@/actions/contacts";

const INPUT_CLS =
  "h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0";
const TRIGGER_CLS =
  "h-9 border-0 bg-transparent px-0 shadow-none focus:ring-0";

export function NewContactClient({
  companies,
  initialCompanyId,
}: {
  companies: { id: string; name: string }[];
  initialCompanyId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [companyId, setCompanyId] = useState(initialCompanyId ?? "");

  // Mobile is required + unique per workspace in the schema, so the national
  // part of the phone must be filled before saving.
  const hasPhone = !!parsePhone(phone).national.trim();
  const canSave = !!firstName.trim() && !!lastName.trim() && hasPhone;

  const save = () => {
    if (!canSave || pending) return;
    const fd = new FormData();
    fd.set("firstName", firstName.trim());
    fd.set("lastName", lastName.trim());
    fd.set("mobile", phone.trim());
    if (email.trim()) fd.set("email", email.trim());
    if (role.trim()) fd.set("role", role.trim());
    // Derive the contact's country from the phone dial code.
    fd.set("country", parsePhone(phone).country.name);
    if (companyId) fd.set("companyId", companyId);
    startTransition(async () => {
      const result = await createContact(fd);
      if (result.ok) router.push(`/contacts/${result.data.id}`);
    });
  };

  return (
    <>
      <AppHeader
        title="New Contact"
        backHref="/contacts"
        actions={
          <SaveButton
            onClick={save}
            loading={pending}
            ready={canSave}
            disabled={!canSave}
          />
        }
      />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <PageContainer className="mx-auto w-full max-w-4xl pb-10">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FieldCard label="FIRST NAME" required>
              <Input
                placeholder="e.g. Sara"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoFocus
                className={INPUT_CLS}
              />
            </FieldCard>
            <FieldCard label="LAST NAME" required>
              <Input
                placeholder="e.g. Al-Ahmad"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={INPUT_CLS}
              />
            </FieldCard>
            <FieldCard label="EMAIL">
              <Input
                type="email"
                inputMode="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={INPUT_CLS}
              />
            </FieldCard>
            <FieldCard label="PHONE" required>
              <PhoneInput value={phone} onChange={setPhone} />
            </FieldCard>
            <FieldCard label="COMPANY">
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger className={TRIGGER_CLS}>
                  <SelectValue placeholder="No company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                  {companies.length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      No companies yet.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </FieldCard>
            <FieldCard label="ROLE">
              <Input
                placeholder="e.g. CMO"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className={INPUT_CLS}
              />
            </FieldCard>
          </div>
        </PageContainer>
      </main>
    </>
  );
}
