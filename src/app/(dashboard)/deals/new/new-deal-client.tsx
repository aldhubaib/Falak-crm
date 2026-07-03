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
import { createDeal } from "@/actions/deals";

export function NewDealClient({
  companies,
  contacts,
}: {
  companies: { id: string; name: string }[];
  contacts: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [contactId, setContactId] = useState("");

  const save = () => {
    if (!title.trim()) return;
    const fd = new FormData();
    fd.set("title", title.trim());
    fd.set("value", value || "0");
    if (companyId) fd.set("companyId", companyId);
    if (contactId) fd.set("contactId", contactId);
    startTransition(async () => {
      const result = await createDeal(fd);
      if (result.ok) router.push(`/deals/${result.data.id}`);
    });
  };

  return (
    <PageContainer className="mx-auto max-w-lg space-y-4">
      <Section label="DEAL NAME" required>
        <Input
          placeholder="Deal name"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
      </Section>
      <Section label="VALUE">
        <Input
          type="number"
          placeholder="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </Section>
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
      <Section label="CONTACT">
        <Select value={contactId} onValueChange={setContactId}>
          <SelectTrigger><SelectValue placeholder="Select contact" /></SelectTrigger>
          <SelectContent>
            {contacts.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Section>
      <div className="flex justify-end pt-2">
        <Button onClick={save} disabled={!title.trim() || pending}>Create Deal</Button>
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
