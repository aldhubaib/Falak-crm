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
  GripVertical,
  Clock,
  CheckCircle2,
  Paperclip,
  Download,
  FolderKanban,
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
      if (f.includes("mp4") || f.includes("mov") || f.includes("video")) return <Video className="w-3 h-3" />;
      if (f.includes("mp3") || f.includes("wav") || f.includes("audio")) return <Mic className="w-3 h-3" />;
      if (f.includes("jpg") || f.includes("png") || f.includes("jpeg") || f.includes("image")) return <ImageIcon className="w-3 h-3" />;
    }
    return <Paperclip className="w-3 h-3" />;
  }
  return <FileText className="w-3 h-3" />;
}

function ProjectAvatar({ thumbnailId, name, size = "sm" }: { thumbnailId: string | null; name: string; size?: "sm" | "md" }) {
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

  const s = size === "md" ? "w-7 h-7" : "w-5 h-5";
  const textSize = size === "md" ? "text-[10px]" : "text-[8px]";

  if (url) {
    return <img src={url} alt={name} className={`${s} rounded object-cover shrink-0`} loading="lazy" />;
  }

  const initials = name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  return (
    <div className={`${s} rounded bg-primary/15 flex items-center justify-center ${textSize} font-semibold text-primary shrink-0`}>
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
  const [dragTask, setDragTask] = useState<DeliveryTask | null>(null);
  const [dragProjectId, setDragProjectId] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
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
  const scheduledTasks = useMemo(() => deliveryTasks.filter((t) => t.publishItem), [deliveryTasks]);

  const stats = useMemo(() => ({
    scheduled: allItems.filter((s) => !s.published).length,
    published: allItems.filter((s) => s.published).length,
    queued: unscheduledTasks.length,
  }), [allItems, unscheduledTasks]);

  const handleDrop = async (dateStr: string) => {
    if (!dragTask) return;
    const projectForDrag = dragProjectId || dragTask.project?.id || selectedProjectId;
    if (!projectForDrag) return;
    setDragOverDate(null);
    setDragTask(null);
    setDragProjectId(null);

    await scheduleTask({
      taskId: dragTask.id,
      projectId: projectForDrag,
      scheduledDate: dateStr,
    });
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

  const projectMap = useMemo(() => {
    const m = new Map<string, Project>();
    for (const p of projects) m.set(p.id, p);
    return m;
  }, [projects]);

  const [mobileTab, setMobileTab] = useState<"calendar" | "queue">("calendar");
  const [showMobileDetail, setShowMobileDetail] = useState(false);

  const handleDateSelect = (dateStr: string) => {
    setSelectedDate(dateStr);
    setShowMobileDetail(true);
  };

  return (
    <div className="flex flex-col lg:flex-row h-full lg:h-[calc(100vh-48px)]">
      {/* Left sidebar — delivery queue (desktop) */}
      <div className="hidden lg:flex w-[300px] border-r border-border flex-col shrink-0 bg-card/30">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-[13px] font-semibold text-foreground flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            Delivery Queue
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">Drag tasks to the calendar to schedule</p>
        </div>

        <div className="px-3 py-2 border-b border-border">
          <select
            value={selectedProjectId || ""}
            onChange={(e) => setSelectedProjectId(e.target.value || null)}
            className="w-full h-8 px-2 rounded-lg bg-black border border-border text-[12px] text-foreground focus:outline-none focus:border-ring"
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5">
          {unscheduledTasks.length === 0 && scheduledTasks.length === 0 ? (
            <p className="text-[12px] text-muted-foreground text-center py-8">
              No deliveries ready
            </p>
          ) : (
            <>
              {unscheduledTasks.length > 0 && (
                <>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 pt-1">
                    Unscheduled ({unscheduledTasks.length})
                  </p>
                  {unscheduledTasks.map((task) => {
                    const tmpl = task.checklistItems[0]?.templateItem?.template;
                    const tp = task.project || (selectedProjectId ? projectMap.get(selectedProjectId) : null);
                    return (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={() => { setDragTask(task); setDragProjectId(tp?.id || null); }}
                        onDragEnd={() => { setDragTask(null); setDragOverDate(null); setDragProjectId(null); }}
                        className="px-3 py-2.5 rounded-xl bg-black/40 border border-border/50 cursor-grab hover:border-primary/30 hover:bg-primary/5 transition-colors group"
                      >
                        <div className="flex items-center gap-2.5">
                          <GripVertical className="w-3 h-3 text-muted-foreground/30 shrink-0 group-hover:text-muted-foreground" />
                          {tp && (
                            <ProjectAvatar
                              thumbnailId={tp.thumbnailId ?? null}
                              name={tp.name ?? ""}
                              size="md"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            {tmpl && (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium border mb-1"
                                style={{
                                  borderColor: `${tmpl.color || "#3b82f6"}40`,
                                  color: tmpl.color || "#3b82f6",
                                  backgroundColor: `${tmpl.color || "#3b82f6"}10`,
                                }}
                              >
                                {tmpl.icon} {tmpl.name}
                              </span>
                            )}
                            <p className="text-[12px] font-medium text-foreground truncate">{task.title}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {scheduledTasks.length > 0 && (
                <>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 pt-3">
                    Scheduled ({scheduledTasks.length})
                  </p>
                  {scheduledTasks.map((task) => {
                    const schedDate = task.publishItem ? new Date(task.publishItem.scheduledDate) : null;
                    const deliveredDate = task.completedAt ? new Date(task.completedAt) : null;
                    const tp = task.project || (selectedProjectId ? projectMap.get(selectedProjectId) : null);
                    return (
                      <div
                        key={task.id}
                        className="rounded-xl bg-black/20 border border-border/30 opacity-70 hover:opacity-100 transition-all overflow-hidden"
                      >
                        <div className="flex items-center gap-2.5 px-3 pt-2.5 pb-2">
                          {tp && (
                            <ProjectAvatar
                              thumbnailId={tp.thumbnailId ?? null}
                              name={tp.name ?? ""}
                              size="md"
                            />
                          )}
                          <p className="text-[12px] font-medium text-foreground truncate flex-1 min-w-0">{task.title}</p>
                        </div>
                        <div className="flex border-t border-border/20">
                          {deliveredDate && (
                            <div className="flex-1 px-3 py-1.5 border-r border-border/20">
                              <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">Delivered</p>
                              <p className="text-[11px] text-green-400 font-medium mt-0.5">
                                {deliveredDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </p>
                            </div>
                          )}
                          {schedDate && (
                            <div className="flex-1 px-3 py-1.5">
                              <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">Publish</p>
                              <p className="text-[11px] text-primary font-medium mt-0.5">
                                {schedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile tabs */}
      <div className="lg:hidden flex items-center border-b border-border bg-card/30">
        <button
          onClick={() => setMobileTab("calendar")}
          className={`flex-1 py-2.5 text-[12px] font-medium text-center transition-colors ${mobileTab === "calendar" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}
        >
          Calendar
        </button>
        <button
          onClick={() => setMobileTab("queue")}
          className={`flex-1 py-2.5 text-[12px] font-medium text-center transition-colors relative ${mobileTab === "queue" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}
        >
          Queue
          {unscheduledTasks.length > 0 && (
            <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 text-[9px] font-bold">
              {unscheduledTasks.length}
            </span>
          )}
        </button>
      </div>

      {/* Mobile queue view */}
      {mobileTab === "queue" && (
        <div className="lg:hidden flex-1 overflow-y-auto">
          <div className="px-3 py-2 border-b border-border">
            <select
              value={selectedProjectId || ""}
              onChange={(e) => setSelectedProjectId(e.target.value || null)}
              className="w-full h-8 px-2 rounded-lg bg-black border border-border text-[12px] text-foreground focus:outline-none focus:border-ring"
            >
              <option value="">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="px-3 py-2 space-y-1.5">
            {unscheduledTasks.length === 0 && scheduledTasks.length === 0 ? (
              <p className="text-[12px] text-muted-foreground text-center py-8">No deliveries ready</p>
            ) : (
              <>
                {unscheduledTasks.length > 0 && (
                  <>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 pt-1">Unscheduled ({unscheduledTasks.length})</p>
                    {unscheduledTasks.map((task) => {
                      const tmpl = task.checklistItems[0]?.templateItem?.template;
                      const tp = task.project || (selectedProjectId ? projectMap.get(selectedProjectId) : null);
                      return (
                        <div key={task.id} className="px-3 py-2.5 rounded-xl bg-black/40 border border-border/50">
                          <div className="flex items-center gap-2.5">
                            {tp && <ProjectAvatar thumbnailId={tp.thumbnailId ?? null} name={tp.name ?? ""} size="md" />}
                            <div className="flex-1 min-w-0">
                              {tmpl && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium border mb-1"
                                  style={{ borderColor: `${tmpl.color || "#3b82f6"}40`, color: tmpl.color || "#3b82f6", backgroundColor: `${tmpl.color || "#3b82f6"}10` }}>
                                  {tmpl.icon} {tmpl.name}
                                </span>
                              )}
                              <p className="text-[12px] font-medium text-foreground truncate">{task.title}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
                {scheduledTasks.length > 0 && (
                  <>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 pt-3">Scheduled ({scheduledTasks.length})</p>
                    {scheduledTasks.map((task) => {
                      const schedDate = task.publishItem ? new Date(task.publishItem.scheduledDate) : null;
                      const tp = task.project || (selectedProjectId ? projectMap.get(selectedProjectId) : null);
                      return (
                        <div key={task.id} className="rounded-xl bg-black/20 border border-border/30 px-3 py-2.5">
                          <div className="flex items-center gap-2.5">
                            {tp && <ProjectAvatar thumbnailId={tp.thumbnailId ?? null} name={tp.name ?? ""} size="md" />}
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-medium text-foreground truncate">{task.title}</p>
                              {schedDate && (
                                <p className="text-[10px] text-primary mt-0.5">
                                  {schedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className={`flex-1 flex flex-col min-w-0 ${mobileTab !== "calendar" ? "hidden lg:flex" : ""}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-3 lg:px-6 py-2 lg:py-3 border-b border-border">
          <div className="flex items-center gap-2 lg:gap-4">
            <h2 className="text-[14px] lg:text-[16px] font-semibold text-foreground">
              {viewMode === "week"
                ? `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(weekStart.getTime() + 6 * 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                : `${MONTHS[currentMonth]} ${currentYear}`}
            </h2>
            <div className="flex items-center gap-0.5">
              <button onClick={() => {
                if (viewMode === "week") setWeekStart(new Date(weekStart.getTime() - 7 * 86400000));
                else prevMonth();
              }} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => {
                if (viewMode === "week") {
                  const d = new Date(); d.setDate(d.getDate() - d.getDay()); d.setHours(0,0,0,0); setWeekStart(d);
                } else goToday();
              }} className="px-2 py-1 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                Today
              </button>
              <button onClick={() => {
                if (viewMode === "week") setWeekStart(new Date(weekStart.getTime() + 7 * 86400000));
                else nextMonth();
              }} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 lg:gap-3">
            <div className="hidden lg:flex items-center gap-4 text-[11px]">
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
              value={viewMode}
              onChange={(e) => changeView(e.target.value as "month" | "week" | "schedule")}
              className="h-7 lg:h-8 px-2 lg:px-3 pr-6 lg:pr-7 rounded-lg bg-black border border-border text-[11px] lg:text-[12px] font-medium text-foreground focus:outline-none focus:border-ring transition-colors appearance-none cursor-pointer"
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
                <div key={day} className="text-center text-[11px] font-medium text-muted-foreground py-2">
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
                const isDragOver = dateStr === dragOverDate;
                return (
                  <div
                    key={i}
                    className={`border-b border-r border-border/30 p-1 min-h-[100px] transition-colors ${
                      !isCurrentMonth ? "bg-black/20" : isDragOver ? "bg-primary/10" : "hover:bg-muted/10"
                    }`}
                    onDragOver={(e) => { if (isCurrentMonth && dragTask) { e.preventDefault(); setDragOverDate(dateStr); } }}
                    onDragLeave={() => setDragOverDate(null)}
                    onDrop={(e) => { e.preventDefault(); if (isCurrentMonth) handleDrop(dateStr); }}
                    onClick={() => isCurrentMonth && setSelectedDate(selectedDate === dateStr ? null : dateStr)}
                  >
                    {isCurrentMonth && (
                      <>
                        <div className="text-right mb-1">
                          <span className={`inline-flex items-center justify-center text-[11px] font-medium ${isToday ? "w-6 h-6 rounded-full bg-primary text-white" : "text-muted-foreground"}`}>
                            {day}
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          {dayItems.slice(0, 3).map((item) => (
                            <CalendarCard key={item.id} item={item} onClick={() => setSelectedDate(dateStr)} compact />
                          ))}
                          {dayItems.length > 3 && <p className="text-[9px] text-muted-foreground text-center">+{dayItems.length - 3} more</p>}
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
                    <p className="text-[10px] font-medium text-muted-foreground uppercase">{wd.dayName}</p>
                    <p className={`text-[16px] font-semibold mt-0.5 ${wd.dateStr === todayStr ? "text-primary" : "text-foreground"}`}>{wd.dayNum}</p>
                  </div>
                ))}
              </div>
              <div className="flex-1 grid grid-cols-7 overflow-y-auto">
                {weekDays.map((wd) => {
                  const dayItems = getItemsForDate(wd.dateStr);
                  const isDragOver = wd.dateStr === dragOverDate;
                  return (
                    <div
                      key={wd.dateStr}
                      className={`border-r border-border/30 p-2 space-y-2 transition-colors ${isDragOver ? "bg-primary/10" : ""} ${wd.dateStr === todayStr ? "bg-primary/5" : ""}`}
                      onDragOver={(e) => { if (dragTask) { e.preventDefault(); setDragOverDate(wd.dateStr); } }}
                      onDragLeave={() => setDragOverDate(null)}
                      onDrop={(e) => { e.preventDefault(); handleDrop(wd.dateStr); }}
                    >
                      {dayItems.map((item) => (
                        <CalendarCard key={item.id} item={item} onClick={() => setSelectedDate(wd.dateStr)} />
                      ))}
                      {dayItems.length === 0 && (
                        <p className="text-[10px] text-muted-foreground/30 text-center pt-4">—</p>
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
                return <p className="text-[13px] text-muted-foreground text-center py-16">No scheduled deliveries</p>;
              }

              return dates.map((dateStr) => {
                const d = new Date(dateStr + "T00:00:00");
                const isToday = dateStr === todayStr;
                const isPast = dateStr < todayStr;
                return (
                  <div key={dateStr} className={`border-b border-border/30 ${isPast ? "opacity-60" : ""}`}>
                    <div className={`sticky top-0 z-10 flex items-center gap-3 px-6 py-2.5 ${isToday ? "bg-primary/5" : "bg-card/50"} backdrop-blur-sm`}>
                      <span className={`text-[22px] font-bold ${isToday ? "text-primary" : "text-foreground"}`}>{d.getDate()}</span>
                      <div>
                        <p className={`text-[11px] font-medium uppercase ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                          {d.toLocaleDateString("en-US", { weekday: "short" })}, {d.toLocaleDateString("en-US", { month: "short" })}
                        </p>
                        {isToday && <p className="text-[9px] text-primary font-medium">TODAY</p>}
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
                            <span className="text-[12px] font-medium text-foreground truncate block">
                              {item.task.title}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground">{item.project.name}</span>
                              {item.task.completedAt && (
                                <span className="text-[10px] text-green-400/60 flex items-center gap-0.5">
                                  <CheckCircle2 className="w-2.5 h-2.5" />
                                  Delivered {new Date(item.task.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {item.published ? (
                              <span className="flex items-center gap-1 text-[10px] text-green-400 font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Published
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Clock className="w-3.5 h-3.5" /> Scheduled
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

      {/* Right detail panel — desktop inline */}
      {selectedDate && (
        <div className="hidden lg:block">
          <DetailPanel
            selectedDate={selectedDate}
            items={getItemsForDate(selectedDate)}
            onTogglePublished={handleTogglePublished}
            onUnschedule={handleUnschedule}
            onClose={() => setSelectedDate(null)}
          />
        </div>
      )}

      {/* Right detail panel — mobile modal */}
      {selectedDate && (
        <div className="lg:hidden fixed inset-0 z-[500] flex flex-col">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedDate(null)} />
          <div className="relative mt-auto max-h-[80vh] bg-background border-t border-border rounded-t-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-200">
            <DetailPanel
              selectedDate={selectedDate}
              items={getItemsForDate(selectedDate)}
              onTogglePublished={handleTogglePublished}
              onUnschedule={handleUnschedule}
              onClose={() => setSelectedDate(null)}
            />
          </div>
        </div>
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
      <span className={`truncate font-medium ${compact ? "text-[9px]" : "text-[10px]"} ${item.published ? "text-green-400" : "text-primary"}`}>
        {item.task.title}
      </span>
      {item.published && !compact && <CheckCircle2 className="w-2.5 h-2.5 text-green-400 shrink-0 ml-auto" />}
    </div>
  );
}

function DetailPanel({
  selectedDate,
  items,
  onTogglePublished,
  onUnschedule,
  onClose,
}: {
  selectedDate: string;
  items: ScheduledItem[];
  onTogglePublished: (item: ScheduledItem) => void;
  onUnschedule: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="w-[380px] border-l border-border flex flex-col shrink-0 bg-card/30">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="text-[13px] font-semibold text-foreground">
            {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
          </h3>
          <p className="text-[11px] text-muted-foreground">{items.length} deliveries</p>
        </div>
        <button onClick={onClose} className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {items.length === 0 ? (
          <p className="text-[12px] text-muted-foreground text-center py-8">No deliveries for this day</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="rounded-xl border border-border bg-black/40 overflow-hidden">
              <div className="px-3 pt-3 pb-2 flex items-start gap-2.5">
                <ProjectAvatar thumbnailId={item.project.thumbnailId} name={item.project.name} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-muted-foreground">{item.project.name}</p>
                  <p className="text-[13px] font-medium text-foreground truncate">{item.task.title}</p>
                  {item.task.completedAt && (
                    <p className="text-[10px] text-green-400/70 mt-0.5 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Delivered {new Date(item.task.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  )}
                </div>
              </div>

              <div className="border-t border-border/30">
                {item.task.checklistItems.map((ci) => (
                  <DeliveryFilePreview key={ci.id} file={ci} />
                ))}
              </div>

              {item.notes && (
                <div className="px-3 py-2 border-t border-border/30">
                  <p className="text-[11px] text-muted-foreground/70 italic border-l-2 border-border pl-2">{item.notes}</p>
                </div>
              )}

              <div className="flex items-center justify-between px-3 py-2.5 border-t border-border/30 bg-black/20">
                <button
                  onClick={() => onTogglePublished(item)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                    item.published
                      ? "text-green-400 bg-green-500/10 hover:bg-green-500/20"
                      : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                  }`}
                >
                  {item.published ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                  {item.published ? "Published" : "Mark Published"}
                </button>
                <button
                  onClick={() => onUnschedule(item.id)}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <X className="w-3 h-3" />
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function DeliveryFilePreview({ file }: { file: ScheduledDeliveryFile }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!file.attachmentId) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/files/${file.attachmentId}/download-url`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled && data.url) setUrl(data.url); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [file.attachmentId]);

  const category = getFileCategory(file.type, file.allowedFormats);

  return (
    <div className="border-b border-border/20 last:border-0">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="text-muted-foreground">
          {getFileIcon(file.type, file.allowedFormats)}
        </span>
        <span className="flex-1 text-[11px] font-medium text-foreground truncate">{file.name}</span>
        {url && (
          <a
            href={url}
            download={file.name}
            target="_blank"
            rel="noopener noreferrer"
            className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
            title="Download"
            onClick={(e) => e.stopPropagation()}
          >
            <Download className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      {loading && (
        <div className="px-3 pb-2">
          <div className="h-24 rounded-lg bg-muted/20 animate-pulse" />
        </div>
      )}

      {url && category === "image" && (
        <div className="px-3 pb-2">
          <img src={url} alt={file.name} loading="lazy" className="w-full max-h-52 rounded-lg object-contain bg-black/30" />
        </div>
      )}

      {url && category === "video" && (
        <div className="px-3 pb-2">
          <video controls className="w-full max-h-52 rounded-lg bg-black/30" src={url}>
            Your browser does not support video.
          </video>
        </div>
      )}

      {url && category === "audio" && (
        <div className="px-3 pb-2">
          <audio controls className="w-full h-10" src={url}>
            Your browser does not support audio.
          </audio>
        </div>
      )}

      {file.type === "text_area" && file.textValue && (
        <div className="px-3 pb-2">
          <div className="rounded-lg bg-muted/10 border border-border/30 px-3 py-2 text-[11px] text-foreground/80 whitespace-pre-wrap max-h-32 overflow-y-auto select-text">
            {file.textValue}
          </div>
        </div>
      )}

      {!file.attachmentId && file.type === "file_upload" && (
        <div className="px-3 pb-2">
          <div className="h-16 rounded-lg bg-muted/10 border border-dashed border-border/50 flex items-center justify-center">
            <span className="text-[10px] text-muted-foreground/50">No file uploaded</span>
          </div>
        </div>
      )}
    </div>
  );
}

function getFileCategory(type: string, formats: string | null): "image" | "video" | "audio" | "other" {
  if (type !== "file_upload") return "other";
  if (!formats) return "other";
  const f = formats.toLowerCase();
  if (f.includes("mp4") || f.includes("mov") || f.includes("video") || f.includes("webm")) return "video";
  if (f.includes("mp3") || f.includes("wav") || f.includes("audio") || f.includes("ogg") || f.includes("m4a")) return "audio";
  if (f.includes("jpg") || f.includes("png") || f.includes("jpeg") || f.includes("webp") || f.includes("image") || f.includes("gif")) return "image";
  return "other";
}
