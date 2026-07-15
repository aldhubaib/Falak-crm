import {
  LayoutGrid,
  Building2,
  Users,
  Handshake,
  FolderKanban,
  FileText,
  Wallet,
  CalendarDays,
  MessageSquare,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { ModuleKey } from "@/lib/permissions";

// Icons are presentation-only; which items exist and who sees them is driven
// by the module registry in src/lib/permissions.ts. Shared by the app sidebar
// and the mobile bottom navigation.
export const MODULE_ICONS: Partial<Record<ModuleKey, LucideIcon>> = {
  dashboard: LayoutGrid,
  companies: Building2,
  contacts: Users,
  deals: Handshake,
  projects: FolderKanban,
  invoices: FileText,
  payments: Wallet,
  publish: CalendarDays,
  chat: MessageSquare,
  settings: Settings,
};
