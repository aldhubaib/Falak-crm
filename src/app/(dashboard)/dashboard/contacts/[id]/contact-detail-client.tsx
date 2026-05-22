"use client";

import { updateContact } from "@/actions/contacts";
import { InputField, PhoneField, EmailField } from "@/components/ui/field";
import { ActionMenu } from "@/components/ui/action-menu";
import { ArrowLeft, User, MapPin, Handshake } from "lucide-react";
import Link from "next/link";

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
  company: { id: string; name: string } | null;
  deals: Deal[];
};

export function ContactDetailClient({ contact }: { contact: Contact }) {
  const save = (field: string) => async (value: string) => {
    const formData = new FormData();
    formData.set(field, value);
    await updateContact(contact.id, formData);
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 h-12 mb-6">
        <Link
          href="/dashboard/contacts"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-lg font-semibold text-foreground flex-1">
          {contact.firstName} {contact.middleName ? `${contact.middleName} ` : ""}{contact.lastName}
        </h1>
        <ActionMenu
          entityType="contact"
          entityId={contact.id}
          entityName={`${contact.firstName} ${contact.lastName}`}
          redirectAfterDelete="/dashboard/contacts"
        />
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InputField
            label="First Name"
            icon={<User className="w-3 h-3" />}
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
          <InputField
            label="Role"
            value={contact.role || ""}
            placeholder="Title / Position"
            onSave={save("role")}
          />
          <InputField
            label="Country"
            icon={<MapPin className="w-3 h-3" />}
            value={contact.country}
            onSave={save("country")}
          />
        </div>
      </div>

      {/* Deals Table */}
      <div className="border-t border-border my-8" />
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2 text-[13px] font-medium text-foreground">
            <Handshake className="w-4 h-4" />
            Deals ({contact.deals.length})
          </h2>
        </div>

        {contact.deals.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">No deals yet.</p>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-2.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Title</th>
                  <th className="px-4 py-2.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Stage</th>
                  <th className="px-4 py-2.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {contact.deals.map((deal) => (
                  <tr key={deal.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5">
                      <Link href={`/dashboard/deals/${deal.id}`} className="text-[13px] text-foreground hover:text-primary transition-colors no-underline">
                        {deal.title}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: deal.stage.color }} />
                        <span className="text-[13px] text-muted-foreground">{deal.stage.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-[13px] text-foreground text-right">
                      {Number(deal.value).toLocaleString()} KWD
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
