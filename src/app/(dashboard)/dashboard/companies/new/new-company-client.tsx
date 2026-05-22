"use client";

import { useState, useRef } from "react";
import { createCompany } from "@/actions/companies";
import { createIndustry, deleteIndustry } from "@/actions/industries";
import { ComboboxField } from "@/components/ui/combobox-field";
import { ArrowLeft, Building2, Globe, Save, Plus, Trash2, StickyNote, Calendar } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type IndustryOption = { id: string; name: string };

const countries = [
  "Saudi Arabia", "Kuwait", "UAE", "Bahrain", "Qatar", "Oman",
  "Egypt", "Jordan", "Lebanon", "Iraq", "Morocco", "Tunisia",
  "United States", "United Kingdom", "Germany", "France",
  "Canada", "Australia", "India", "Pakistan", "Turkey",
];

type Note = { date: string; text: string };

export function NewCompanyClient({ industries }: { industries: IndustryOption[] }) {
  const router = useRouter();
  const [selectedIndustry, setSelectedIndustry] = useState("");
  const [industryList, setIndustryList] = useState(industries);
  const [selectedCountry, setSelectedCountry] = useState("");
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const nameRef = useRef<HTMLInputElement>(null);
  const nameArRef = useRef<HTMLInputElement>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNoteDate, setNewNoteDate] = useState(new Date().toISOString().split("T")[0]);
  const [newNoteText, setNewNoteText] = useState("");

  const validate = () => {
    const newErrors: Record<string, boolean> = {};
    if (!nameRef.current?.value.trim()) newErrors.name = true;
    if (!nameArRef.current?.value.trim()) newErrors.nameAr = true;
    if (!selectedIndustry) newErrors.industry = true;
    if (!selectedCountry) newErrors.country = true;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const addNote = () => {
    if (!newNoteText.trim()) return;
    setNotes((prev) => [...prev, { date: newNoteDate, text: newNoteText.trim() }]);
    setNewNoteText("");
    setNewNoteDate(new Date().toISOString().split("T")[0]);
  };

  return (
    <div className="p-6">
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-4px); }
          40% { transform: translateX(4px); }
          60% { transform: translateX(-3px); }
          80% { transform: translateX(3px); }
        }
        .shake { animation: shake 0.4s ease-in-out; }
      `}</style>

      <div className="flex items-center gap-3 h-12 mb-8">
        <Link
          href="/dashboard/companies"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-lg font-semibold text-foreground flex-1">New Company</h1>
        <button
          type="submit"
          form="company-form"
          className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
        >
          <Save className="w-3.5 h-3.5" />
          Save
        </button>
      </div>

      <form
        id="company-form"
        action={async (formData) => {
          if (!validate()) return;
          formData.set("industry", selectedIndustry);
          formData.set("address", selectedCountry);
          formData.set("notes", JSON.stringify(notes));
          const company = await createCompany(formData);
          if (company) router.push(`/dashboard/companies/${company.id}`);
        }}
        className="space-y-5"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={cn(errors.name && "shake")}>
            <label className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              <Building2 className="w-3 h-3" />
              Company Name
              <span className="text-destructive">*</span>
            </label>
            <input
              ref={nameRef}
              name="name"
              placeholder="Acme Corp"
              onChange={() => errors.name && setErrors((e) => ({ ...e, name: false }))}
              className={cn(
                "w-full h-10 px-3 rounded-lg bg-transparent border text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none transition-colors",
                errors.name ? "border-destructive focus:border-destructive" : "border-border focus:border-ring"
              )}
            />
            {errors.name && (
              <p className="text-[11px] text-destructive mt-1">Company name is required</p>
            )}
          </div>
          <div className={cn(errors.nameAr && "shake")}>
            <label className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              <Building2 className="w-3 h-3" />
              Company Name (Arabic)
              <span className="text-destructive">*</span>
            </label>
            <input
              ref={nameArRef}
              name="nameAr"
              placeholder="اسم الشركة"
              dir="rtl"
              onChange={() => errors.nameAr && setErrors((e) => ({ ...e, nameAr: false }))}
              className={cn(
                "w-full h-10 px-3 rounded-lg bg-transparent border text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none transition-colors",
                errors.nameAr ? "border-destructive focus:border-destructive" : "border-border focus:border-ring"
              )}
            />
            {errors.nameAr && (
              <p className="text-[11px] text-destructive mt-1">Arabic name is required</p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={cn(errors.industry && "shake")}>
            <ComboboxField
              label="Industry"
              required
              value={selectedIndustry}
              options={industryList.map((i) => ({ id: i.id, label: i.name }))}
              placeholder="Select or add..."
              error={errors.industry}
              onSelect={(val) => {
                setSelectedIndustry(val);
                if (errors.industry) setErrors((e) => ({ ...e, industry: false }));
              }}
              onCreate={async (name) => {
                const industry = await createIndustry(name);
                setIndustryList((prev) => [...prev, { id: industry.id, name: industry.name }]);
              }}
              onDelete={async (id) => {
                await deleteIndustry(id);
                setIndustryList((prev) => prev.filter((i) => i.id !== id));
                if (industryList.find((i) => i.id === id)?.name === selectedIndustry) {
                  setSelectedIndustry("");
                }
              }}
            />
            {errors.industry && (
              <p className="text-[11px] text-destructive mt-1">Industry is required</p>
            )}
          </div>
          <div className={cn(errors.country && "shake")}>
            <label className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              <Globe className="w-3 h-3" />
              Country
              <span className="text-destructive">*</span>
            </label>
            <select
              value={selectedCountry}
              onChange={(e) => {
                setSelectedCountry(e.target.value);
                if (errors.country) setErrors((er) => ({ ...er, country: false }));
              }}
              className={cn(
                "w-full h-10 px-3 rounded-lg bg-transparent border text-[13px] text-foreground appearance-none focus:outline-none transition-colors cursor-pointer",
                errors.country ? "border-destructive" : "border-border focus:border-ring"
              )}
            >
              <option value="">Select country...</option>
              {countries.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {errors.country && (
              <p className="text-[11px] text-destructive mt-1">Country is required</p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              <Globe className="w-3 h-3" />
              Website
            </label>
            <input
              name="website"
              placeholder="https://"
              className="w-full h-10 px-3 rounded-lg bg-transparent border border-border text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-ring transition-colors"
            />
          </div>
        </div>
      </form>

      {/* Divider */}
      <div className="border-t border-border my-8" />

      {/* Notes Section */}
      <div>
        <h2 className="flex items-center gap-2 text-[13px] font-medium text-foreground mb-4">
          <StickyNote className="w-4 h-4" />
          Notes
        </h2>

        {/* Add Note */}
        <div className="flex items-start gap-3 mb-4">
          <div className="shrink-0">
            <label className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              <Calendar className="w-3 h-3" />
              Date
            </label>
            <input
              type="date"
              value={newNoteDate}
              onChange={(e) => setNewNoteDate(e.target.value)}
              className="h-10 px-3 rounded-lg bg-transparent border border-border text-[13px] text-foreground focus:outline-none focus:border-ring transition-colors"
            />
          </div>
          <div className="flex-1">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Note
            </label>
            <div className="flex gap-2">
              <input
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                placeholder="Write a note..."
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNote(); } }}
                className="flex-1 h-10 px-3 rounded-lg bg-transparent border border-border text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-ring transition-colors"
              />
              <button
                type="button"
                onClick={addNote}
                className="h-10 px-3 rounded-lg bg-card border border-border text-[13px] text-foreground hover:bg-muted transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Notes List */}
        {notes.length > 0 && (
          <div className="space-y-2">
            {notes.map((note, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-lg bg-card border border-border group"
              >
                <span className="text-[11px] text-muted-foreground shrink-0 pt-0.5">
                  {note.date}
                </span>
                <p className="flex-1 text-[13px] text-foreground">{note.text}</p>
                <button
                  type="button"
                  onClick={() => setNotes((prev) => prev.filter((_, idx) => idx !== i))}
                  className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
