"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Image as ImageIcon,
  Video,
  Mic,
  FileText,
  Check,
  X,
  Clock,
  Inbox,
  CheckCircle2,
  Paperclip,
  Download,
} from "lucide-react";
import {
  getPublishSchedule,
  getDeliveryTasks,
  getAllScheduledItems,
  scheduleTask,
  unscheduleTask,
  markPublished,
  markUnpublished,
} from "@/actions/publish";

type Project = { id: string; name: string; thumbnailId: string | null };

type DeliveryFile = {
  id: string;
  name: string;
  type: string;
  attachmentId: string | null;
  allowedFormats: string | null;
  templateItem: { template: { name: string; icon: string | null; color: string | null } } | null;
};

type ScheduledDeliveryFile = DeliveryFile & { textValue: string | null };

type ScheduledItem = {
  id: string;
  scheduledDate: string;
  published: boolean;
  publishedAt: string | null;
  notes: string | null;
  project: { id: string; name: string; thumbnailId: string | null };
  task: {
    id: string;
    title: string;
    taskNumber: number;
    completedAt: string | null;
    checklistItems: ScheduledDeliveryFile[];
  };
  scheduler: { id: string; name: string | null; email: string };
};

type DeliveryTask = {
  id: string;
  title: string;
  taskNumber: number;
  completedAt: string | null;
  project?: { id: string; name: string; thumbnailId: string | null };
  checklistItems: DeliveryFile[];
  publishItem: { id: string; scheduledDate: string } | null;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getFileIcon(type: string, formats: string | null) {
  if (type === "file_upload") {
    if (formats) {
      const f = formats.toLowerCase();
      if (f.includes("mp4") || f.includes("mov") || f.includes("video")) return <Video className="w-icon-sm h-icon-sm" />;
      if (f.includes("mp3") || f.includes("wav") || f.includes("audio")) return <Mic className="w-icon-sm h-icon-sm" />;
      if (f.includes("jpg") || f.includes("png") || f.includes("jpeg") || f.includes("image")) return <ImageIcon className="w-icon-sm h-icon-sm" />;
    }
    return <Paperclip className="w-icon-sm h-icon-sm" />;
  }
  return <FileText className="w-icon-sm h-icon-sm" />;
}

function ProjectAvatar({ thumbnailId, name, size = "sm" }: { thumbnailId: string | null; name: string; size?: "sm" | "md" | "lg" }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!thumbnailId) return;
    let cancelled = false;
    fetch(`/api/files/${thumbnailId}/download-url`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled && data.url) setUrl(data.url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [thumbnailId]);

  const s = size === "lg" ? "w-10 h-10" : size === "md" ? "w-7 h-7" : "w-5 h-5";
  const textSize = size === "lg" ? "text-[13px]" : size === "md" ? "text-[10px]" : "text-[8px]";
  const radius = size === "lg" ? "rounded-xl" : "rounded";

  if (url) {
    return <img src={url} alt={name} className={`${s} ${radius} object-cover shrink-0`} loading="lazy" />;
  }

  const initials = name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  return (
    <div className={`${s} ${radius} bg-primary/15 flex items-center justify-center ${textSize} font-semibold text-primary shrink-0`}>
      {initials}
    </div>
  );
}

export function PublishClient({ projects }: { projects: Project[] }) {
  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<ScheduledItem[]>([]);
  const [allItems, setAllItems] = useState<ScheduledItem[]>([]);
  const [deliveryTasks, setDeliveryTasks] = useState<DeliveryTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"month" | "week" | "schedule">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("publish_view");
      if (saved === "month" || saved === "week" || saved === "schedule") return saved;
    }
    return "month";
  });

  const changeView = (v: "month" | "week" | "schedule") => {
    setViewMode(v);
    localStorage.setItem("publish_view", v);
  };
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const loadSchedule = useCallback(async () => {
    setLoading(true);
    const data = await getPublishSchedule(selectedProjectId, currentMonth, currentYear);
    setSchedule(data as unknown as ScheduledItem[]);
    setLoading(false);
  }, [selectedProjectId, currentMonth, currentYear]);

  const loadAllItems = useCallback(async () => {
    const data = await getAllScheduledItems(selectedProjectId);
    setAllItems(data as unknown as ScheduledItem[]);
  }, [selectedProjectId]);

  const loadDeliveryTasks = useCallback(async () => {
    const data = await getDeliveryTasks(selectedProjectId);
    setDeliveryTasks(data as unknown as DeliveryTask[]);
  }, [selectedProjectId]);

  useEffect(() => { loadSchedule(); }, [loadSchedule]);
  useEffect(() => { loadAllItems(); }, [loadAllItems]);
  useEffect(() => { loadDeliveryTasks(); }, [loadDeliveryTasks]);

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(currentYear - 1); }
    else setCurrentMonth(currentMonth - 1);
  };

  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(currentYear + 1); }
    else setCurrentMonth(currentMonth + 1);
  };

  const goToday = () => {
    setCurrentMonth(now.getMonth());
    setCurrentYear(now.getFullYear());
  };

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  const toLocalDateStr = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const getDateStr = (day: number) => {
    return toLocalDateStr(new Date(currentYear, currentMonth, day));
  };

  const toDateKey = (value: ScheduledItem["scheduledDate"]) =>
    toLocalDateStr(new Date(value));

  const scheduleByDate = useMemo(() => {
    const map = new Map<string, ScheduledItem[]>();
    for (const item of schedule) {
      const ds = toDateKey(item.scheduledDate);
      const arr = map.get(ds);
      if (arr) arr.push(item);
      else map.set(ds, [item]);
    }
    return map;
  }, [schedule]);

  const allItemsByDate = useMemo(() => {
    const map = new Map<string, ScheduledItem[]>();
    for (const item of allItems) {
      const ds = toDateKey(item.scheduledDate);
      const arr = map.get(ds);
      if (arr) arr.push(item);
      else map.set(ds, [item]);
    }
    return map;
  }, [allItems]);

  const getItemsForDate = useCallback((dateStr: string) => {
    const source = viewMode === "month" ? scheduleByDate : allItemsByDate;
    return source.get(dateStr) ?? [];
  }, [viewMode, allItemsByDate, scheduleByDate]);

  const unscheduledTasks = useMemo(() => deliveryTasks.filter((t) => !t.publishItem), [deliveryTasks]);

  const stats = useMemo(() => ({
    scheduled: allItems.filter((s) => !s.published).length,
    published: allItems.filter((s) => s.published).length,
    queued: unscheduledTasks.length,
  }), [allItems, unscheduledTasks]);

  const handleScheduleTask = async (task: DeliveryTask, dateStr: string) => {
    const projectId = task.project?.id || selectedProjectId;
    if (!projectId) return;
    await scheduleTask({ taskId: task.id, projectId, scheduledDate: dateStr });
    loadSchedule();
    loadAllItems();
    loadDeliveryTasks();
  };

  const handleReschedule = async (itemId: string, taskId: string, projectId: string, dateStr: string) => {
    await scheduleTask({ taskId, projectId, scheduledDate: dateStr });
    loadSchedule();
    loadAllItems();
    loadDeliveryTasks();
  };

  const handleUnschedule = async (itemId: string) => {
    await unscheduleTask(itemId);
    loadSchedule();
    loadAllItems();
    loadDeliveryTasks();
  };

  const handleTogglePublished = async (item: ScheduledItem) => {
    if (item.published) await markUnpublished(item.id);
    else await markPublished(item.id);
    loadSchedule();
    loadAllItems();
  };

  const todayStr = toLocalDateStr(now);


  return (
    <div className="flex flex-col h-full">
      {/* Main content — full width calendar */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-3 lg:px-6 py-2 lg:py-3 border-b border-border">
          <div className="flex items-center gap-2 lg:gap-4">
            <h2 className="text-body lg:text-subheading font-semibold text-foreground">
              {viewMode === "week"
                ? `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(weekStart.getTime() + 6 * 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                : `${MONTHS[currentMonth]} ${currentYear}`}
            </h2>
            <div className="flex items-center gap-0.5">
              <button onClick={() => {
                if (viewMode === "week") setWeekStart(new Date(weekStart.getTime() - 7 * 86400000));
                else prevMonth();
              }} className="w-icon-btn h-icon-btn rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <ChevronLeft className="w-icon-md h-icon-md" />
              </button>
              <button onClick={() => {
                if (viewMode === "week") {
                  const d = new Date(); d.setDate(d.getDate() - d.getDay()); d.setHours(0,0,0,0); setWeekStart(d);
                } else goToday();
              }} className="px-2 py-1 rounded-lg text-sub font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                Today
              </button>
              <button onClick={() => {
                if (viewMode === "week") setWeekStart(new Date(weekStart.getTime() + 7 * 86400000));
                else nextMonth();
              }} className="w-icon-btn h-icon-btn rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <ChevronRight className="w-icon-md h-icon-md" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 lg:gap-3">
            <div className="hidden md:flex items-center gap-4 text-sub">
              <span className="text-muted-foreground">
                <span className="text-foreground font-medium">{stats.scheduled}</span> scheduled
              </span>
              <span className="text-muted-foreground">
                <span className="text-green-400 font-medium">{stats.published}</span> published
              </span>
              <span className="text-muted-foreground">
                <span className="text-amber-400 font-medium">{stats.queued}</span> queued
              </span>
            </div>

            <select
              value={selectedProjectId || ""}
              onChange={(e) => setSelectedProjectId(e.target.value || null)}
              className="h-input px-2 pr-6 rounded-lg bg-black border border-border text-sub font-medium text-foreground focus:outline-none focus:border-ring transition-colors appearance-none cursor-pointer"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 6px center" }}
            >
              <option value="">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            <select
              value={viewMode}
              onChange={(e) => changeView(e.target.value as "month" | "week" | "schedule")}
              className="h-input px-2 lg:px-3 pr-6 lg:pr-7 rounded-lg bg-black border border-border text-sub font-medium text-foreground focus:outline-none focus:border-ring transition-colors appearance-none cursor-pointer"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 6px center" }}
            >
              <option value="month">Month</option>
              <option value="week">Week</option>
              <option value="schedule">Schedule</option>
            </select>
          </div>
        </div>

        {/* MONTH VIEW */}
        {viewMode === "month" && (
          <>
            <div className="grid grid-cols-7 border-b border-border">
              {DAYS.map((day) => (
                <div key={day} className="text-center text-sub font-medium text-muted-foreground py-2">
                  {day}
                </div>
              ))}
            </div>
            <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-y-auto">
              {Array.from({ length: totalCells }, (_, i) => {
                const day = i - firstDay + 1;
                const isCurrentMonth = day >= 1 && day <= daysInMonth;
                const dateStr = isCurrentMonth ? getDateStr(day) : "";
                const dayItems = isCurrentMonth ? getItemsForDate(dateStr) : [];
                const isToday = dateStr === todayStr;
                return (
                  <div
                    key={i}
                    className={`border-b border-r border-border/30 p-1 min-h-[80px] lg:min-h-[100px] transition-colors cursor-pointer ${
                      !isCurrentMonth ? "bg-black/20" : selectedDate === dateStr ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted/10"
                    }`}
                    onClick={() => isCurrentMonth && setSelectedDate(selectedDate === dateStr ? null : dateStr)}
                  >
                    {isCurrentMonth && (
                      <>
                        <div className="text-right mb-1">
                          <span className={`inline-flex items-center justify-center text-sub font-medium ${isToday ? "w-6 h-6 rounded-full bg-primary text-white" : "text-muted-foreground"}`}>
                            {day}
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          {dayItems.slice(0, 3).map((item) => (
                            <CalendarCard key={item.id} item={item} onClick={() => setSelectedDate(dateStr)} compact />
                          ))}
                          {dayItems.length > 3 && <p className="text-label text-muted-foreground text-center">+{dayItems.length - 3} more</p>}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* WEEK VIEW */}
        {viewMode === "week" && (() => {
          const weekDays = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + i);
            return { date: d, dateStr: toLocalDateStr(d), dayName: DAYS[d.getDay()], dayNum: d.getDate() };
          });
          return (
            <>
              <div className="grid grid-cols-7 border-b border-border">
                {weekDays.map((wd) => (
                  <div key={wd.dateStr} className={`text-center py-2.5 ${wd.dateStr === todayStr ? "bg-primary/5" : ""}`}>
                    <p className="text-label font-medium text-muted-foreground uppercase">{wd.dayName}</p>
                    <p className={`text-subheading font-semibold mt-0.5 ${wd.dateStr === todayStr ? "text-primary" : "text-foreground"}`}>{wd.dayNum}</p>
                  </div>
                ))}
              </div>
              <div className="flex-1 grid grid-cols-7 overflow-y-auto">
                {weekDays.map((wd) => {
                  const dayItems = getItemsForDate(wd.dateStr);
                  return (
                    <div
                      key={wd.dateStr}
                      className={`border-r border-border/30 p-2 space-y-2 transition-colors cursor-pointer ${selectedDate === wd.dateStr ? "bg-primary/10 ring-1 ring-primary/30" : wd.dateStr === todayStr ? "bg-primary/5" : "hover:bg-muted/10"}`}
                      onClick={() => setSelectedDate(selectedDate === wd.dateStr ? null : wd.dateStr)}
                    >
                      {dayItems.map((item) => (
                        <CalendarCard key={item.id} item={item} onClick={() => setSelectedDate(wd.dateStr)} />
                      ))}
                      {dayItems.length === 0 && (
                        <p className="text-label text-muted-foreground/30 text-center pt-4">—</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          );
        })()}

        {/* SCHEDULE VIEW */}
        {viewMode === "schedule" && (
          <div className="flex-1 overflow-y-auto">
            {(() => {
              const sorted = [...allItems].sort(
                (a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()
              );
              const grouped: Record<string, ScheduledItem[]> = {};
              for (const item of sorted) {
                const dateStr = toDateKey(item.scheduledDate);
                if (!grouped[dateStr]) grouped[dateStr] = [];
                grouped[dateStr].push(item);
              }
              const dates = Object.keys(grouped).sort();

              if (dates.length === 0) {
                return <p className="text-body text-muted-foreground text-center py-16">No scheduled deliveries</p>;
              }

              return dates.map((dateStr) => {
                const d = new Date(dateStr + "T00:00:00");
                const isToday = dateStr === todayStr;
                const isPast = dateStr < todayStr;
                return (
                  <div key={dateStr} className={`border-b border-border/30 ${isPast ? "opacity-60" : ""}`}>
                    <div className={`sticky top-0 z-10 flex items-center gap-3 px-6 py-2.5 ${isToday ? "bg-primary/5" : "bg-card/50"} backdrop-blur-sm`}>
                      <span className={`text-heading font-bold ${isToday ? "text-primary" : "text-foreground"}`}>{d.getDate()}</span>
                      <div>
                        <p className={`text-sub font-medium uppercase ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                          {d.toLocaleDateString("en-US", { weekday: "short" })}, {d.toLocaleDateString("en-US", { month: "short" })}
                        </p>
                        {isToday && <p className="text-label text-primary font-medium">TODAY</p>}
                      </div>
                    </div>
                    <div className="space-y-1 px-4 pb-3">
                      {grouped[dateStr].map((item) => (
                        <div
                          key={item.id}
                          onClick={() => setSelectedDate(dateStr)}
                          className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-colors ${
                            item.published ? "hover:bg-green-500/5" : "hover:bg-muted/20"
                          }`}
                        >
                          <ProjectAvatar thumbnailId={item.project.thumbnailId} name={item.project.name} size="md" />
                          <div className="flex-1 min-w-0">
                            <span className="text-sub font-medium text-foreground truncate block">
                              {item.task.title}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-label text-muted-foreground">{item.project.name}</span>
                              {item.task.completedAt && (
                                <span className="text-label text-green-400/60 flex items-center gap-0.5">
                                  <CheckCircle2 className="w-2.5 h-2.5" />
                                  Delivered {new Date(item.task.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {item.published ? (
                              <span className="flex items-center gap-1 text-label text-green-400 font-medium">
                                <CheckCircle2 className="w-icon-sm h-icon-sm" /> Published
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-label text-muted-foreground">
                                <Clock className="w-icon-sm h-icon-sm" /> Scheduled
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}
      </div>

      {/* Date panel — full-screen overlay */}
      {selectedDate && (
        <DatePanel
          selectedDate={selectedDate}
          scheduledItems={getItemsForDate(selectedDate)}
          unscheduledTasks={unscheduledTasks}
          projects={projects}
          selectedProjectId={selectedProjectId}
          onSchedule={handleScheduleTask}
          onTogglePublished={handleTogglePublished}
          onUnschedule={handleUnschedule}
          onReschedule={handleReschedule}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  );
}

function CalendarCard({ item, onClick, compact }: { item: ScheduledItem; onClick: () => void; compact?: boolean }) {
  return (
    <div
      className={`flex items-center gap-1.5 px-1.5 py-1 rounded cursor-pointer transition-colors ${
        item.published
          ? "bg-green-500/10 border border-green-500/20 hover:bg-green-500/15"
          : "bg-primary/10 border border-primary/20 hover:bg-primary/15"
      }`}
      title={`${item.project.name} — ${item.task.title}`}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <ProjectAvatar thumbnailId={item.project.thumbnailId} name={item.project.name} />
      <span className={`truncate font-medium ${compact ? "text-label" : "text-label"} ${item.published ? "text-green-400" : "text-primary"}`}>
        {item.task.title}
      </span>
      {item.published && !compact && <CheckCircle2 className="w-2.5 h-2.5 text-green-400 shrink-0 ml-auto" />}
    </div>
  );
}

function DatePanel({
  selectedDate,
  scheduledItems,
  unscheduledTasks,
  projects,
  selectedProjectId,
  onSchedule,
  onTogglePublished,
  onUnschedule,
  onReschedule,
  onClose,
}: {
  selectedDate: string;
  scheduledItems: ScheduledItem[];
  unscheduledTasks: DeliveryTask[];
  projects: Project[];
  selectedProjectId: string | null;
  onSchedule: (task: DeliveryTask, dateStr: string) => void;
  onTogglePublished: (item: ScheduledItem) => void;
  onUnschedule: (id: string) => void;
  onReschedule: (itemId: string, taskId: string, projectId: string, dateStr: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"unscheduled" | "scheduled">(
    unscheduledTasks.length > 0 ? "unscheduled" : "scheduled"
  );
  const d = new Date(selectedDate + "T00:00:00");

  const scheduledByProject = useMemo(() => {
    const map = new Map<string, { project: ScheduledItem["project"]; items: ScheduledItem[] }>();
    for (const item of scheduledItems) {
      const existing = map.get(item.project.id);
      if (existing) existing.items.push(item);
      else map.set(item.project.id, { project: item.project, items: [item] });
    }
    return Array.from(map.values());
  }, [scheduledItems]);

  const unscheduledByProject = useMemo(() => {
    const map = new Map<string, { project: Project; tasks: DeliveryTask[] }>();
    for (const task of unscheduledTasks) {
      const proj = task.project || projects.find((p) => p.id === selectedProjectId);
      if (!proj) continue;
      const existing = map.get(proj.id);
      if (existing) existing.tasks.push(task);
      else map.set(proj.id, { project: proj, tasks: [task] });
    }
    return Array.from(map.values());
  }, [unscheduledTasks, projects, selectedProjectId]);

  return (
    <div className="fixed inset-0 z-[500] flex items-end lg:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full lg:w-[480px] max-h-[85vh] lg:max-h-[80vh] bg-background border border-border rounded-t-2xl lg:rounded-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom lg:zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-label font-medium text-muted-foreground uppercase tracking-wider">
                {d.toLocaleDateString("en-US", { weekday: "short" })}, {d.toLocaleDateString("en-US", { month: "long" })}
              </p>
              <h3 className="text-heading font-bold text-foreground">
                {d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </h3>
              <p className="text-sub text-muted-foreground mt-0.5">
                Pick from the queue to schedule, or browse what&apos;s already scheduled.
              </p>
            </div>
            <button onClick={onClose} className="w-icon-btn h-icon-btn rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <X className="w-icon-md h-icon-md" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => setTab("unscheduled")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sub font-medium transition-colors ${
                tab === "unscheduled" ? "bg-primary text-white" : "bg-muted/30 text-muted-foreground hover:text-foreground"
              }`}
            >
              <Inbox className="w-icon-sm h-icon-sm" />
              {unscheduledTasks.length}
            </button>
            <button
              onClick={() => setTab("scheduled")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sub font-medium transition-colors ${
                tab === "scheduled" ? "bg-primary text-white" : "bg-muted/30 text-muted-foreground hover:text-foreground"
              }`}
            >
              <Calendar className="w-icon-sm h-icon-sm" />
              {scheduledItems.length}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {tab === "unscheduled" && (
            <>
              {unscheduledByProject.length === 0 ? (
                <p className="text-sub text-muted-foreground text-center py-8">No unscheduled deliveries</p>
              ) : (
                unscheduledByProject.map(({ project, tasks }) => (
                  <div key={project.id}>
                    <div className="flex items-center gap-2 mb-2">
                      <ProjectAvatar thumbnailId={project.thumbnailId} name={project.name} size="sm" />
                      <p className="text-sub font-semibold text-muted-foreground">{project.name} ({tasks.length})</p>
                    </div>
                    <div className="space-y-1.5">
                      {tasks.map((task) => (
                        <div key={task.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-black/40 border border-border/50">
                          <ProjectAvatar thumbnailId={project.thumbnailId} name={project.name} size="md" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sub font-medium text-foreground truncate">{task.title}</p>
                            {task.completedAt && (
                              <p className="text-label text-green-400/70 flex items-center gap-1 mt-0.5">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                Delivered {new Date(task.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => onSchedule(task, selectedDate)}
                            className="shrink-0 w-icon-btn h-icon-btn rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                            title="Schedule to this date"
                          >
                            <Calendar className="w-icon-md h-icon-md" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {tab === "scheduled" && (
            <>
              {scheduledByProject.length === 0 ? (
                <p className="text-sub text-muted-foreground text-center py-8">No deliveries scheduled for this day</p>
              ) : (
                scheduledByProject.map(({ project, items }) => (
                  <div key={project.id}>
                    <div className="flex items-center gap-2 mb-2">
                      <ProjectAvatar thumbnailId={project.thumbnailId} name={project.name} size="sm" />
                      <p className="text-sub font-semibold text-muted-foreground">{project.name} ({items.length})</p>
                    </div>
                    <div className="space-y-3">
                      {items.map((item) => (
                        <div key={item.id} className="rounded-2xl border border-border/60 bg-card/60 overflow-hidden">
                          {/* Header */}
                          <div className="px-4 pt-4 pb-3">
                            <div className="flex items-start gap-3">
                              <ProjectAvatar thumbnailId={item.project.thumbnailId} name={item.project.name} size="lg" />
                              <div className="flex-1 min-w-0">
                                <p className="text-label text-muted-foreground/70 font-medium">{item.project.name}</p>
                                <p className="text-body font-semibold text-foreground mt-0.5 leading-tight">{item.task.title}</p>
                              </div>
                              {item.published && (
                                <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/15 text-green-400 text-label font-semibold">
                                  <CheckCircle2 className="w-icon-sm h-icon-sm" />
                                  Published
                                </span>
                              )}
                            </div>

                            {/* Date pills */}
                            <div className="flex items-center gap-2 mt-3">
                              {item.task.completedAt && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-500/10 text-label font-medium text-green-400">
                                  <CheckCircle2 className="w-icon-sm h-icon-sm" />
                                  Delivered {new Date(item.task.completedAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 text-label font-medium text-primary">
                                <Calendar className="w-icon-sm h-icon-sm" />
                                Publish {new Date(item.scheduledDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                              </span>
                            </div>
                          </div>

                          {/* Files */}
                          {item.task.checklistItems.length > 0 && (
                            <div className="mx-4 mb-3 rounded-xl border border-border/40 overflow-hidden bg-black/30">
                              {item.task.checklistItems.map((ci) => (
                                <DeliveryFilePreview key={ci.id} file={ci} />
                              ))}
                            </div>
                          )}

                          {/* Actions */}
                          <div className="border-t border-border/40">
                            <div className="flex items-center">
                              <label className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 text-sub font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors cursor-pointer">
                                <Calendar className="w-icon-sm h-icon-sm" />
                                Reschedule
                                <input
                                  type="date"
                                  className="sr-only"
                                  defaultValue={selectedDate}
                                  onChange={(e) => {
                                    if (e.target.value && e.target.value !== selectedDate) {
                                      onReschedule(item.id, item.task.id, item.project.id, e.target.value);
                                    }
                                  }}
                                />
                              </label>
                              <div className="w-px h-5 bg-border/30" />
                              <button
                                onClick={() => onUnschedule(item.id)}
                                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 text-sub font-medium text-muted-foreground hover:text-red-400 hover:bg-red-500/5 transition-colors"
                              >
                                <X className="w-icon-sm h-icon-sm" />
                                Remove
                              </button>
                            </div>
                            <button
                              onClick={() => onTogglePublished(item)}
                              className={`w-full flex items-center justify-center gap-2 px-4 py-3 border-t border-border/40 text-sub font-semibold transition-colors ${
                                item.published
                                  ? "text-green-400 bg-green-500/5 hover:bg-green-500/10"
                                  : "text-primary bg-primary/5 hover:bg-primary/10"
                              }`}
                            >
                              {item.published ? <CheckCircle2 className="w-icon-md h-icon-md" /> : <Check className="w-icon-md h-icon-md" />}
                              {item.published ? "Published" : "Mark Published"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DeliveryFilePreview({ file }: { file: ScheduledDeliveryFile }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file.attachmentId) return;
    let cancelled = false;
    fetch(`/api/files/${file.attachmentId}/download-url`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled && data.url) setUrl(data.url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [file.attachmentId]);

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border/20 last:border-0">
      <span className="text-muted-foreground">
        {getFileIcon(file.type, file.allowedFormats)}
      </span>
      <span className="flex-1 text-sub font-medium text-foreground truncate">{file.name}</span>
      {url && (
        <a
          href={url}
          download={file.name}
          target="_blank"
          rel="noopener noreferrer"
          className="w-icon-btn h-icon-btn rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
          title="Download"
          onClick={(e) => e.stopPropagation()}
        >
          <Download className="w-icon-sm h-icon-sm" />
        </a>
      )}
    </div>
  );
}

