"use client";

// New Company form, matching the Lovable design: logo picker, EN/AR names,
// industry/referral/website row, operating countries — laid out as field
// cards with the save action in the header.

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Globe, Globe2 } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { PageContainer } from "@/components/page-container";
import { SaveButton } from "@/components/save-button";
import { FieldCard, LogoPicker } from "@/components/crm/field-card";
import { CountryMultiSelect } from "@/components/country-multi-select";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createCompany } from "@/actions/companies";

const INPUT_CLS =
  "h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0";
const TRIGGER_CLS =
  "h-9 border-0 bg-transparent px-0 shadow-none focus:ring-0";

const ARABIC_RE = /^[\u0600-\u06FF\u0750-\u077F\s0-9.,\-()،؛؟!"'“”«»]+$/;

export function NewCompanyClient({
  industries,
  referrals,
}: {
  industries: string[];
  referrals: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [industry, setIndustry] = useState("");
  const [referral, setReferral] = useState("");
  const [website, setWebsite] = useState("");
  const [countries, setCountries] = useState<string[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | undefined>(undefined);
  const [logoError, setLogoError] = useState<string | undefined>(undefined);
  const fileRef = useRef<HTMLInputElement>(null);

  const arInvalid = !!nameAr.trim() && !ARABIC_RE.test(nameAr.trim());

  const onLogoPick = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setLogoError("Logo must be an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setLogoError("Logo must be under 5 MB");
      return;
    }
    setLogoError(undefined);
    setLogoFile(file);
    const r = new FileReader();
    r.onload = () => setLogoPreview(String(r.result));
    r.readAsDataURL(file);
  };

  const save = () => {
    if (!name.trim() || arInvalid || pending) return;
    const fd = new FormData();
    fd.set("name", name.trim());
    if (nameAr.trim()) fd.set("nameAr", nameAr.trim());
    if (industry) fd.set("industry", industry);
    if (referral) fd.set("referral", referral);
    if (website.trim()) fd.set("website", website.trim());
    for (const c of countries) fd.append("countries", c);
    if (logoFile) fd.set("logo", logoFile);
    startTransition(async () => {
      const result = await createCompany(fd);
      if (result.ok) router.push(`/companies/${result.data.id}`);
    });
  };

  return (
    <>
      <AppHeader
        title="New Company"
        backHref="/companies"
        actions={
          <SaveButton
            onClick={save}
            loading={pending}
            ready={!!name.trim() && !arInvalid}
            disabled={!name.trim() || arInvalid}
          />
        }
      />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <PageContainer className="mx-auto w-full max-w-4xl space-y-3 pb-10">
          {/* Logo row */}
          <div>
            <LogoPicker
              value={logoPreview}
              onPick={() => fileRef.current?.click()}
              onClear={() => {
                setLogoFile(null);
                setLogoPreview(undefined);
              }}
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => onLogoPick(e.target.files?.[0])}
            />
            {logoError && (
              <p className="mt-1 text-tiny text-destructive">{logoError}</p>
            )}
          </div>

          {/* Identity */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FieldCard label="NAME (EN)" required>
              <Input
                placeholder="e.g. Falak Studio"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                className={INPUT_CLS}
              />
            </FieldCard>
            <FieldCard
              label="NAME (AR)"
              error={arInvalid ? "Name must be in Arabic" : undefined}
            >
              <Input
                placeholder="اسم الشركة"
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
                dir="rtl"
                className={INPUT_CLS}
              />
            </FieldCard>
          </div>

          {/* Classification */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <FieldCard label="INDUSTRY">
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger className={TRIGGER_CLS}>
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  {industries.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                  {industries.length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      No options — add in Settings.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </FieldCard>
            <FieldCard label="REFERRAL SOURCE">
              <Select value={referral} onValueChange={setReferral}>
                <SelectTrigger className={TRIGGER_CLS}>
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  {referrals.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                  {referrals.length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      No options — add in Settings.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </FieldCard>
            <FieldCard label="WEBSITE" icon={<Globe className="h-3 w-3" />}>
              <Input
                placeholder="https://…"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                inputMode="url"
                className={INPUT_CLS}
              />
            </FieldCard>
          </div>

          {/* Countries */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FieldCard
              label="OPERATING COUNTRIES"
              icon={<Globe2 className="h-3 w-3" />}
            >
              <CountryMultiSelect value={countries} onChange={setCountries} />
            </FieldCard>
          </div>
        </PageContainer>
      </main>
    </>
  );
}
