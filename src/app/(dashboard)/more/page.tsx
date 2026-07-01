import Link from "next/link";
import { Building2, Users, Settings } from "lucide-react";

const moreItems = [
  { name: "Companies", href: "/companies", icon: Building2 },
  { name: "Contacts", href: "/contacts", icon: Users },
  { name: "Settings", href: "/settings", icon: Settings },
];

export default function MorePage() {
  return (
    <div className="p-6">
      <div className="space-y-1">
        {moreItems.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-card transition-colors no-underline"
          >
            <item.icon className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
            <span className="text-body font-medium text-foreground">
              {item.name}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
