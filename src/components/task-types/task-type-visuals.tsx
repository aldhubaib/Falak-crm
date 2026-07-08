import {
  Film,
  Image as ImageIcon,
  Mic,
  Video,
  FileText,
  Package,
  Briefcase,
  Sparkles,
  Layers,
  PenTool,
  Music,
  Camera,
  type LucideIcon,
} from "lucide-react";

export const TYPE_COLORS = [
  "#22d3ee", // cyan
  "#3b82f6", // blue
  "#a78bfa", // purple
  "#c4b5fd", // lilac
  "#f472b6", // pink
  "#f43f5e", // rose
  "#fb923c", // orange
  "#f59e0b", // amber
  "#22c55e", // green
  "#14b8a6", // teal
  "#94a3b8", // slate
  "#f8fafc", // white
];

export const TYPE_ICONS: Record<string, LucideIcon> = {
  film: Film,
  image: ImageIcon,
  video: Video,
  mic: Mic,
  music: Music,
  camera: Camera,
  file: FileText,
  package: Package,
  briefcase: Briefcase,
  sparkles: Sparkles,
  layers: Layers,
  pen: PenTool,
};

export function TypeIcon({
  name,
  className,
  style,
}: {
  name?: string | null;
  className?: string;
  style?: React.CSSProperties;
}) {
  const Icon = (name && TYPE_ICONS[name]) || Film;
  return <Icon className={className} style={style} />;
}
