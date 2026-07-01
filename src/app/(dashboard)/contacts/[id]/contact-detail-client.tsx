"use client";

import { useState } from "react";
import { updateContact, addContactCompany, removeContactCompany, updateContactCompanyRole, setContactPrimaryCompany } from "@/actions/contacts";
import { InputField, PhoneField, EmailField, CountryField } from "@/components/ui/field";
import { ActionMenu } from "@/components/ui/action-menu";
import { RelatedTable, type RelatedColumn } from "@/components/ui/related-table";
import { ArrowLeft, User, MapPin, Handshake, Building2, Plus, Loader2, Trash2, Star, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/ui/form-select";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useErrorStore } from "@/lib/error-store";

type CompanyLink = {
  companyId: string;
  role: string | null;
  primary: boolean;
  company: { id: string; name: string };
};

type Deal = {
  id: string;
  title: string;
  value: unknown;
  stage: { name: string; color: string };
};

type Contact = {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  nameAr: string | null;
  mobile: string;
  email: string | null;
  role: string | null;
  country: string;
  companies: CompanyLink[];
  deals: Deal[];
};

export function ContactDetailClient({ contact, companies }: { contact: Contact; companies: { id: string; name: string }[] }) {
  const router = useRouter();
  const { push: pushError } = useErrorStore();
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [addingCompany, setAddingCompany] = useState(false);

  const save = (field: string) => async (value: string) => {
    const formData = new FormData();
    formData.set(field, value);
    const result = await updateContact(contact.id, formData);
    if (!result.ok) pushError(result.error);
  };

  const linkedCompanyIds = contact.companies.map((c) => c.companyId);
  const availableCompanies = companies.filter((c) => !linkedCompanyIds.includes(c.id));

  const handleAddCompany = async (formData: FormData) => {
    const companyId = formData.get("companyId") as string;
    const role = formData.get("role") as string;
    if (!companyId) return;
    setAddingCompany(true);
    const result = await addContactCompany(contact.id, companyId, role || undefined);
    if (!result.ok) pushError(result.error);
    setAddingCompany(false);
    setShowAddCompany(false);
    router.refresh();
  };

  const handleRemoveCompany = async (companyId: string) => {
    const result = await removeContactCompany(contact.id, companyId);
    if (!result.ok) pushError(result.error);
    router.refresh();
  };

  const handleUpdateRole = async (companyId: string, role: string) => {
    const result = await updateContactCompanyRole(contact.id, companyId, role);
    if (!result.ok) pushError(result.error);
    router.refresh();
  };

  const handleSetPrimary = async (companyId: string) => {
    const result = await setContactPrimaryCompany(contact.id, companyId);
    if (!result.ok) pushError(result.error);
    router.refresh();
  };

  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState("");

  const startEdit = (r: CompanyLink) => {
    setEditingCompanyId(r.companyId);
    setEditRole(r.role || "");
  };

  const saveEdit = async (companyId: string) => {
    await handleUpdateRole(companyId, editRole);
    setEditingCompanyId(null);
  };

  const companyColumns: RelatedColumn<CompanyLink>[] = [
    {
      key: "name",
      label: "Company",
      render: (r) => <span className="text-foreground font-medium">{r.company.name}</span>,
    },
    {
      key: "role",
      label: "Role",
      render: (r) =>
        editingCompanyId === r.companyId ? (
          <input
            autoFocus
            value={editRole}
            onChange={(e) => setEditRole(e.target.value)}
            onBlur={() => saveEdit(r.companyId)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveEdit(r.companyId);
              if (e.key === "Escape") setEditingCompanyId(null);
            }}
            onClick={(e) => e.stopPropagation()}
            placeholder="e.g. CEO, Manager"
            className="h-input px-2 rounded-md bg-background border border-ring text-body text-foreground focus:outline-none w-full max-w-[180px]"
          />
        ) : (
          <span className="text-muted-foreground">{r.role || "—"}</span>
        ),
    },
    {
      key: "primary",
      label: "Primary",
      render: (r) => (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!r.primary) handleSetPrimary(r.companyId); }}
          className={`w-icon-btn h-icon-btn rounded flex items-center justify-center transition-colors ${
            r.primary
              ? "text-amber-400"
              : "text-muted-foreground/30 hover:text-amber-400/60"
          }`}
          title={r.primary ? "Primary company" : "Set as primary"}
        >
          <Star className={`w-icon-sm h-icon-sm ${r.primary ? "fill-current" : ""}`} />
        </button>
      ),
    },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); startEdit(r); }}
            className="w-icon-btn h-icon-btn rounded flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            title="Edit role"
          >
            <Pencil className="w-icon-sm h-icon-sm" />
          </button>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRemoveCompany(r.companyId); }}
            className="w-icon-btn h-icon-btn rounded flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
            title="Remove"
          >
            <Trash2 className="w-icon-sm h-icon-sm" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 h-12 mb-6">
        <Link
          href="/contacts"
          className="w-icon-btn h-icon-btn rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
        >
          <ArrowLeft className="w-icon-md h-icon-md" />
        </Link>
        <h1 className="text-lg font-semibold text-foreground flex-1">
          {contact.firstName} {contact.middleName ? `${contact.middleName} ` : ""}{contact.lastName}
        </h1>
        <ActionMenu
          entityType="contact"
          entityId={contact.id}
          entityName={`${contact.firstName} ${contact.lastName}`}
          redirectAfterDelete="/contacts"
        />
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InputField
            label="First Name"
            icon={<User className="w-icon-sm h-icon-sm" />}
            value={contact.firstName}
            onSave={save("firstName")}
          />
          <InputField
            label="Middle Name"
            value={contact.middleName || ""}
            placeholder="—"
            onSave={save("middleName")}
          />
          <InputField
            label="Last Name"
            value={contact.lastName}
            onSave={save("lastName")}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputField
            label="الاسم بالعربي (Arabic Name)"
            value={contact.nameAr || ""}
            placeholder="الاسم الكامل بالعربي"
            dir="rtl"
            onSave={save("nameAr")}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PhoneField
            label="Mobile"
            value={contact.mobile}
            onSave={save("mobile")}
          />
          <EmailField
            label="Email"
            value={contact.email || ""}
            placeholder="—"
            onSave={save("email")}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CountryField
            label="Country"
            icon={<MapPin className="w-icon-sm h-icon-sm" />}
            value={contact.country}
            onSave={save("country")}
          />
        </div>
      </div>

      {/* Companies Table */}
      <div className="border-t border-border my-8" />
      <RelatedTable
        icon={<Building2 className="w-icon-sm h-icon-sm" />}
        title="Companies"
        data={contact.companies}
        getRowId={(r) => r.companyId}
        rowHref={(r) => `/companies/${r.company.id}`}
        columns={companyColumns}
        action={
          availableCompanies.length > 0 ? (
            <Button size="sm" onClick={() => setShowAddCompany(true)}>
              <Plus className="w-icon-sm h-icon-sm" />
              Add Company
            </Button>
          ) : undefined
        }
      />

      {showAddCompany && (
        <form
          action={handleAddCompany}
          className="mt-3 p-4 rounded-lg border border-border bg-black space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormSelect
              name="companyId"
              label="Company"
              required
              placeholder="Select company..."
              options={availableCompanies.map((c) => ({ value: c.id, label: c.name }))}
            />
            <div className="rounded-lg bg-black border border-border px-3 pt-2 pb-1.5 focus-within:border-ring transition-colors">
              <label className="text-label font-medium text-muted-foreground uppercase tracking-wider">Role at Company</label>
              <input
                name="role"
                placeholder="e.g. CEO, Consultant"
                className="w-full h-input bg-transparent border-none text-body text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={addingCompany}>
              {addingCompany && <Loader2 className="w-3 h-3 animate-spin" />}
              {addingCompany ? "Adding..." : "Add"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddCompany(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {/* Deals Table */}
      <div className="border-t border-border my-8" />
      <RelatedTable
        icon={<Handshake className="w-icon-sm h-icon-sm" />}
        title="Deals"
        data={contact.deals}
        getRowId={(r) => r.id}
        rowHref={(r) => `/deals/${r.id}`}
        columns={contactDealColumns}
      />
    </div>
  );
}

const contactDealColumns: RelatedColumn<{ id: string; title: string; value: unknown; stage: { name: string; color: string } }>[] = [
  {
    key: "title",
    label: "Title",
    render: (r) => <span className="text-foreground font-medium">{r.title}</span>,
  },
  {
    key: "stage",
    label: "Stage",
    render: (r) => (
      <span className="inline-flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: r.stage.color }} />
        {r.stage.name}
      </span>
    ),
  },
  {
    key: "value",
    label: "Value",
    align: "right",
    render: (r) => <span className="text-foreground">{Number(r.value).toLocaleString()} KWD</span>,
  },
];
