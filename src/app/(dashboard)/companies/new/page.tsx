"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/page-container";
import { AppHeader } from "@/components/app-header";
import { createCompany } from "@/actions/companies";

export default function NewCompanyPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [website, setWebsite] = useState("");

  const save = () => {
    if (!name.trim()) return;
    const fd = new FormData();
    fd.set("name", name.trim());
    if (industry) fd.set("industry", industry.trim());
    if (phone) fd.set("phone", phone.trim());
    if (email) fd.set("email", email.trim());
    if (address) fd.set("address", address.trim());
    if (website) fd.set("website", website.trim());
    startTransition(async () => {
      const result = await createCompany(fd);
      if (result.ok) router.push(`/companies/${result.data.id}`);
    });
  };

  return (
    <>
      <AppHeader title="New Company" />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <PageContainer className="mx-auto max-w-lg space-y-4">
          <Section label="COMPANY NAME" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Company name" autoFocus />
          </Section>
          <Section label="INDUSTRY">
            <Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. Technology" />
          </Section>
          <div className="grid grid-cols-2 gap-4">
            <Section label="PHONE">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+966..." />
            </Section>
            <Section label="EMAIL">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="info@company.com" />
            </Section>
          </div>
          <Section label="WEBSITE">
            <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://company.com" />
          </Section>
          <Section label="ADDRESS">
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address" />
          </Section>
          <div className="flex justify-end pt-2">
            <Button onClick={save} disabled={!name.trim() || pending}>Create Company</Button>
          </div>
        </PageContainer>
      </main>
    </>
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
