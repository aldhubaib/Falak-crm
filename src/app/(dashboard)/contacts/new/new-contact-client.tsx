"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageContainer } from "@/components/page-container";
import { createContact } from "@/actions/contacts";

export function NewContactClient({
  companies,
}: {
  companies: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [country, setCountry] = useState("");
  const [companyId, setCompanyId] = useState("");

  const save = () => {
    if (!firstName.trim() || !lastName.trim()) return;
    const fd = new FormData();
    fd.set("firstName", firstName.trim());
    fd.set("lastName", lastName.trim());
    fd.set("mobile", mobile.trim());
    if (email) fd.set("email", email.trim());
    if (role) fd.set("role", role.trim());
    if (country) fd.set("country", country.trim());
    if (companyId) fd.set("companyId", companyId);
    startTransition(async () => {
      const result = await createContact(fd);
      if (result.ok) router.push(`/contacts/${result.data.id}`);
    });
  };

  return (
    <PageContainer className="mx-auto max-w-lg space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Section label="FIRST NAME" required>
          <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" autoFocus />
        </Section>
        <Section label="LAST NAME" required>
          <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" />
        </Section>
      </div>
      <Section label="MOBILE">
        <Input value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="+966..." />
      </Section>
      <Section label="EMAIL">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
      </Section>
      <Section label="ROLE">
        <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. CEO, Manager" />
      </Section>
      <Section label="COUNTRY">
        <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. Saudi Arabia" />
      </Section>
      {companies.length > 0 && (
        <Section label="COMPANY">
          <Select value={companyId} onValueChange={setCompanyId}>
            <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
            <SelectContent>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Section>
      )}
      <div className="flex justify-end pt-2">
        <Button onClick={save} disabled={!firstName.trim() || !lastName.trim() || pending}>
          Create Contact
        </Button>
      </div>
    </PageContainer>
  );
}

function Section({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/60 bg-surface/50 p-4">
      <div className="mb-2 text-tiny font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}{required && <span className="text-destructive"> *</span>}
      </div>
      {children}
    </div>
  );
}
