"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MoreVertical,
  LayoutGrid,
  Paperclip,
  Settings2,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ProjectViewMenu({ projectId }: { projectId: string }) {
  const path = usePathname();
  const boardHref = `/projects/${projectId}`;
  const assetsHref = `/projects/${projectId}/assets`;
  const settingsHref = `/projects/${projectId}/settings`;

  const views = [
    {
      href: boardHref,
      label: "Board",
      icon: LayoutGrid,
      active: path === boardHref,
    },
    {
      href: assetsHref,
      label: "Assets",
      icon: Paperclip,
      active: path.startsWith(assetsHref),
    },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label="More options"
        >
          <MoreVertical className="size-[18px]" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-tiny font-medium uppercase tracking-wider text-muted-foreground">
          View
        </DropdownMenuLabel>
        {views.map((v) => (
          <DropdownMenuItem key={v.href} asChild>
            <Link href={v.href} className="gap-2">
              <v.icon className="h-4 w-4" />
              <span className="flex-1">{v.label}</span>
              {v.active && <Check className="h-4 w-4 text-primary" />}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={settingsHref} className="gap-2">
            <Settings2 className="h-4 w-4" />
            Settings
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
