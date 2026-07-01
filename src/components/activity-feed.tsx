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
  created: <Plus className="w-icon-sm h-icon-sm" />,
  updated: <Pencil className="w-icon-sm h-icon-sm" />,
  deleted: <Trash2 className="w-icon-sm h-icon-sm" />,
  moved: <ArrowRight className="w-icon-sm h-icon-sm" />,
  sent: <Send className="w-icon-sm h-icon-sm" />,
  accepted: <CheckCircle className="w-icon-sm h-icon-sm" />,
  rejected: <XCircle className="w-icon-sm h-icon-sm" />,
  paid: <DollarSign className="w-icon-sm h-icon-sm" />,
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
      <p className="text-secondary text-muted-foreground">No activity yet</p>
    );
  }

  return (
    <div className="space-y-0">
      {activities.map((activity, i) => (
        <div key={activity.id} className="flex gap-3 py-2.5">
          {/* User avatar */}
          {activity.userImage ? (
            <img src={activity.userImage} alt="" loading="lazy" className="w-7 h-7 rounded-full shrink-0" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-label font-semibold text-muted-foreground shrink-0">
              {(activity.userName || "?").charAt(0)}
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-body text-foreground leading-snug">
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
            <p className="text-secondary text-muted-foreground mt-0.5">
              {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
