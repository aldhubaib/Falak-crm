"use server";

import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/workspace";

export type SearchResult = {
  id: string;
  type: "company" | "contact" | "deal" | "project" | "invoice";
  title: string;
  subtitle: string | null;
  href: string;
};

export async function globalSearch(query: string): Promise<SearchResult[]> {
  if (!query || query.length < 2) return [];

  const workspace = await requireWorkspace();
  const results: SearchResult[] = [];

  const [companies, contacts, deals, projects] = await Promise.all([
    db.company.findMany({
      where: {
        workspaceId: workspace.id,
        deletedAt: null,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { nameAr: { contains: query, mode: "insensitive" } },
          { industry: { contains: query, mode: "insensitive" } },
        ],
      },
      take: 5,
      select: { id: true, name: true, industry: true },
    }),
    db.contact.findMany({
      where: {
        workspaceId: workspace.id,
        deletedAt: null,
        OR: [
          { firstName: { contains: query, mode: "insensitive" } },
          { lastName: { contains: query, mode: "insensitive" } },
          { nameAr: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
          { mobile: { contains: query, mode: "insensitive" } },
        ],
      },
      take: 5,
      select: { id: true, firstName: true, lastName: true, role: true, company: { select: { name: true } } },
    }),
    db.deal.findMany({
      where: {
        workspaceId: workspace.id,
        deletedAt: null,
        title: { contains: query, mode: "insensitive" },
      },
      take: 5,
      select: { id: true, title: true, company: { select: { name: true } } },
    }),
    db.project.findMany({
      where: {
        workspaceId: workspace.id,
        deletedAt: null,
        name: { contains: query, mode: "insensitive" },
      },
      take: 5,
      select: { id: true, name: true, company: { select: { name: true } } },
    }),
  ]);

  for (const c of companies) {
    results.push({ id: c.id, type: "company", title: c.name, subtitle: c.industry, href: `/dashboard/companies/${c.id}` });
  }
  for (const c of contacts) {
    results.push({ id: c.id, type: "contact", title: `${c.firstName} ${c.lastName}`, subtitle: c.role || c.company?.name || null, href: `/dashboard/contacts/${c.id}` });
  }
  for (const d of deals) {
    results.push({ id: d.id, type: "deal", title: d.title, subtitle: d.company?.name || null, href: `/dashboard/deals/${d.id}` });
  }
  for (const p of projects) {
    results.push({ id: p.id, type: "project", title: p.name, subtitle: p.company?.name || null, href: `/dashboard/projects/${p.id}` });
  }

  return results;
}
