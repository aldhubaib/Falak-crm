import { formatDistanceToNow } from "date-fns";
import {
  Plus,
  Pencil,
  Trash2,
  ArrowRight,
  Send,
  CheckCircle,
  XCircle,
  DollarSign,
} from "lucide-react";

type Activity = {
  id: string;
  userName: string | null;
  userImage: string | null;
  entityType: string;
  entityId: string;
  entityName: string | null;
  action: string;
  changes: Record<string, { from: unknown; to: unknown }> | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
};

const actionIcons: Record<string, React.ReactNode> = {
  created: <Plus className="w-3 h-3" />,
  updated: <Pencil className="w-3 h-3" />,
  deleted: <Trash2 className="w-3 h-3" />,
  moved: <ArrowRight className="w-3 h-3" />,
  sent: <Send className="w-3 h-3" />,
  accepted: <CheckCircle className="w-3 h-3" />,
  rejected: <XCircle className="w-3 h-3" />,
  paid: <DollarSign className="w-3 h-3" />,
};

const actionColors: Record<string, string> = {
  created: "text-success bg-success/15",
  updated: "text-primary bg-primary/15",
  deleted: "text-destructive bg-destructive/15",
  moved: "text-purple bg-purple/15",
  sent: "text-orange bg-orange/15",
  accepted: "text-success bg-success/15",
  rejected: "text-destructive bg-destructive/15",
  paid: "text-success bg-success/15",
};

export function ActivityFeed({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) {
    return (
      <p className="text-[12px] text-muted-foreground">No activity yet</p>
    );
  }

  return (
    <div className="space-y-0">
      {activities.map((activity, i) => (
        <div key={activity.id} className="flex gap-3 py-2.5">
          {/* User avatar */}
          {activity.userImage ? (
            <img src={activity.userImage} alt="" className="w-7 h-7 rounded-full shrink-0" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground shrink-0">
              {(activity.userName || "?").charAt(0)}
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-[13px] text-foreground leading-snug">
              <span className="font-medium">{activity.userName || "System"}</span>
              {" "}
              {activity.action === "moved" && activity.changes?.stage ? (
                <span className="text-muted-foreground">
                  moved from {String(activity.changes.stage.from)} →{" "}
                  <span className="text-foreground">{String(activity.changes.stage.to)}</span>
                </span>
              ) : (
                <span className="text-muted-foreground">
                  {activity.action} this {activity.entityType}
                </span>
              )}
              {activity.action === "updated" && activity.changes && !activity.changes.stage && (
                <span className="text-muted-foreground">
                  {" "}({Object.keys(activity.changes).join(", ")})
                </span>
              )}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
