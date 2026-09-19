import { useEffect, useMemo, useState } from "react";
import type React from "react";
import {
  AlertTriangle,
  Anchor,
  BarChart3,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Database,
  History,
  Menu,
  Plus,
  Search,
  Ship,
  X,
} from "lucide-react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useReservations } from "./context/ReservationProvider";
import { daysInclusive } from "./lib/dates";
import { findConflicts, findVesselConflicts, recommendBerths, vesselFitsBerth } from "./lib/scheduling";
import { newestReservationFirst } from "./lib/sorting";
import type { Reservation, ReservationType, Vessel } from "./types";

type Page = "overview" | "schedule" | "reservations" | "checks";
type ScheduleCheckKind = "overlap" | "vessel-fit" | "vessel-length" | "berth-limit" | "reservation-data";

interface ScheduleCheck {
  id: string;
  kind: ScheduleCheckKind;
  title: string;
  detail: string;
  date?: string;
  reservations?: Reservation[];
  vesselId?: string;
  berthId?: string;
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void> };
};

const updateWithViewTransition = (update: () => void) => {
  const viewTransitionDocument = document as ViewTransitionDocument;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!viewTransitionDocument.startViewTransition || reduceMotion) {
    update();
    return;
  }
  viewTransitionDocument.startViewTransition(update);
};

const berthColor = (type: ReservationType) =>
  type === "vessel" ? "var(--blue)" : type === "event" ? "var(--violet)" : "var(--amber)";

function App() {
  const data = useReservations();
  const scheduledYears = data.reservations.map((item) => Number(item.startDate.slice(0, 4)));
  const firstScheduledYear = Math.min(...scheduledYears);
  const lastScheduledYear = Math.max(...scheduledYears);
  const [page, setPage] = useState<Page>("overview");
  const [month, setMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [selected, setSelected] = useState<Reservation | null>(null);
  const [editing, setEditing] = useState<Reservation | "new" | null>(null);
  const [drawerReturnPage, setDrawerReturnPage] = useState<Page | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem("dock-manager-sidebar-collapsed") === "true");

  const navigate = (target: Page) => {
    if (target === page) {
      setMobileNav(false);
      return;
    }
    updateWithViewTransition(() => {
      setPage(target);
      setMobileNav(false);
    });
  };

  const toggleSidebar = () => {
    setSidebarCollapsed((collapsed) => {
      const next = !collapsed;
      localStorage.setItem("dock-manager-sidebar-collapsed", String(next));
      return next;
    });
  };

  const toggleNavigation = () => {
    if (window.matchMedia("(max-width: 760px)").matches) {
      setMobileNav((open) => !open);
      return;
    }
    toggleSidebar();
  };

  const jumpToReservation = (reservation: Reservation) => {
    setDrawerReturnPage(page);
    setMonth(reservation.startDate.slice(0, 7));
    updateWithViewTransition(() => {
      setPage("schedule");
      setSelected(reservation);
    });
  };

  const closeDetails = () => {
    setSelected(null);
    if (drawerReturnPage) setPage(drawerReturnPage);
    setDrawerReturnPage(null);
  };

  const closeEditor = () => {
    setEditing(null);
    if (drawerReturnPage) setPage(drawerReturnPage);
    setDrawerReturnPage(null);
  };

  return (
    <div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><Anchor size={20} /></div>
          <div><strong>WHOI</strong><span>Dock Manager</span></div>
        </div>
        <nav aria-label="Primary navigation">
          <NavButton icon={<BarChart3 />} active={page === "overview"} compact={sidebarCollapsed} onClick={() => navigate("overview")}>Overview</NavButton>
          <NavButton icon={<CalendarDays />} active={page === "schedule"} compact={sidebarCollapsed} onClick={() => navigate("schedule")}>Schedule</NavButton>
          <NavButton icon={<History />} active={page === "reservations"} compact={sidebarCollapsed} onClick={() => navigate("reservations")}>Reservations</NavButton>
          <NavButton icon={<AlertTriangle />} active={page === "checks"} compact={sidebarCollapsed} onClick={() => navigate("checks")}>Schedule checks</NavButton>
        </nav>
        <div className="sidebar-note">
          <Database size={16} />
          <span><strong>{firstScheduledYear} to {lastScheduledYear}</strong>{data.reservations.length.toLocaleString()} scheduled reservations</span>
        </div>
      </aside>
      <button className="sidebar-menu-toggle" onClick={toggleNavigation} aria-label="Toggle navigation" title="Toggle navigation"><Menu /></button>

      <main>
        <div className="content">
          <div className="page-surface" key={page}>
            {page === "overview" && <Overview onNavigate={navigate} onOpen={jumpToReservation} onNew={() => { setDrawerReturnPage(null); setEditing("new"); }} />}
            {page === "schedule" && <Schedule month={month} setMonth={setMonth} onOpen={(reservation) => { setDrawerReturnPage(null); setSelected(reservation); }} onNew={() => { setDrawerReturnPage(null); setEditing("new"); }} />}
            {page === "reservations" && <ReservationsPage onOpen={(reservation) => { setDrawerReturnPage(null); setSelected(reservation); }} onNew={() => { setDrawerReturnPage(null); setEditing("new"); }} />}
            {page === "checks" && <ScheduleChecks onEdit={(reservation) => { setDrawerReturnPage("checks"); setEditing(reservation); }} />}
          </div>
        </div>
      </main>

      {selected && <ReservationDrawer reservation={selected} onClose={closeDetails} onEdit={() => { setEditing(selected); setSelected(null); }} />}
      {editing && <ReservationDialog reservation={editing === "new" ? undefined : editing} onClose={closeEditor} />}
    </div>
  );
}

function NavButton({ icon, active, badge, compact, children, onClick }: { icon: React.ReactNode; active: boolean; badge?: number; compact?: boolean; children: React.ReactNode; onClick: () => void }) {
  return <button className={active ? "active" : ""} onClick={onClick} title={compact ? String(children) : undefined}>{icon}<span>{children}</span>{badge ? <b>{badge}</b> : null}</button>;
}

function PageTitle({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return <div className="page-title"><div><span>{eyebrow}</span><h1>{title}</h1></div>{children}</div>;
}

function MonthPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => Number(value.slice(0, 4)));
  const selected = parseISO(`${value}-01`);
  const months = Array.from({ length: 12 }, (_, index) => new Date(year, index, 1));
  const chooseMonth = (month: Date) => {
    onChange(format(month, "yyyy-MM"));
    setOpen(false);
  };
  return <div className="month-picker-wrap" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}><button type="button" className="month-picker month-picker-button" aria-expanded={open} onClick={() => { setYear(Number(value.slice(0, 4))); setOpen((current) => !current); }}><span>{format(selected, "MMMM yyyy")}</span><CalendarDays /></button>{open && <div className="month-popover"><div className="picker-heading"><button type="button" className="icon-button" onClick={() => setYear((current) => Math.max(1997, current - 1))} disabled={year <= 1997} aria-label="Previous year"><ChevronLeft /></button><strong>{year}</strong><button type="button" className="icon-button" onClick={() => setYear((current) => Math.min(2028, current + 1))} disabled={year >= 2028} aria-label="Next year"><ChevronRight /></button></div><div className="month-grid">{months.map((month) => <button type="button" key={month.toISOString()} className={format(month, "yyyy-MM") === value ? "selected" : ""} onClick={() => chooseMonth(month)}>{format(month, "MMM")}</button>)}</div></div>}</div>;
}

function InAppDatePicker({ label, value, min, onChange }: { label: string; value: string; min?: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(parseISO(value)));
  const selected = parseISO(value);
  const today = new Date();
  const calendarDays = eachDayOfInterval({ start: startOfWeek(startOfMonth(viewMonth)), end: endOfWeek(endOfMonth(viewMonth)) });
  const chooseDate = (date: Date) => {
    onChange(format(date, "yyyy-MM-dd"));
    setOpen(false);
  };
  return <div className="date-picker" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}><label>{label}</label><button type="button" className="date-picker-trigger" aria-expanded={open} onClick={() => { setViewMonth(startOfMonth(selected)); setOpen((current) => !current); }}><span>{format(selected, "MMM d, yyyy")}</span><CalendarDays /></button>{open && <div className="date-popover"><div className="picker-heading"><button type="button" className="icon-button" onClick={() => setViewMonth((current) => addMonths(current, -1))} aria-label="Previous month"><ChevronLeft /></button><strong>{format(viewMonth, "MMMM yyyy")}</strong><button type="button" className="icon-button" onClick={() => setViewMonth((current) => addMonths(current, 1))} aria-label="Next month"><ChevronRight /></button></div><div className="picker-year-row"><button type="button" onClick={() => setViewMonth((current) => addMonths(current, -12))}>Previous year</button><button type="button" onClick={() => setViewMonth((current) => addMonths(current, 12))}>Next year</button></div><div className="weekday-row">{["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div><div className="date-grid">{calendarDays.map((date) => { const dateValue = format(date, "yyyy-MM-dd"); const disabled = Boolean(min && dateValue < min); return <button type="button" key={dateValue} disabled={disabled} className={`${isSameMonth(date, viewMonth) ? "" : "outside"} ${isSameDay(date, selected) ? "selected" : ""} ${isSameDay(date, today) ? "today" : ""}`} onClick={() => chooseDate(date)}>{format(date, "d")}</button>; })}</div><button type="button" className="text-button picker-today" disabled={Boolean(min && format(today, "yyyy-MM-dd") < min)} onClick={() => chooseDate(today)}>Today</button></div>}</div>;
}

function ConfirmationDialog({ title, message, confirmLabel, danger = false, onConfirm, onCancel }: { title: string; message: string; confirmLabel: string; danger?: boolean; onConfirm: () => void; onCancel: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return <div className="overlay dialog-overlay confirmation-overlay" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}><section className="dialog confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirmation-title" aria-describedby="confirmation-message"><div className="dialog-header"><div><span>Please confirm</span><h2 id="confirmation-title">{title}</h2></div><button type="button" className="icon-button" onClick={onCancel} aria-label="Close confirmation"><X /></button></div><div className="confirmation-body"><p id="confirmation-message">{message}</p><div className="dialog-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button type="button" className={danger ? "danger-button" : "primary-button"} onClick={onConfirm}>{confirmLabel}</button></div></div></section></div>;
}

function InAppSelect({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((option) => option.value === value)?.label ?? value;
  return <div className="inline-select" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}><button type="button" className="inline-select-trigger" aria-label={label} aria-expanded={open} onClick={() => setOpen((current) => !current)}><span>{selectedLabel}</span><ChevronRight /></button>{open && <div className="inline-select-options" role="listbox" aria-label={label}>{options.map((option) => <button type="button" role="option" aria-selected={option.value === value} className={option.value === value ? "selected" : ""} key={option.value} onClick={() => { onChange(option.value); setOpen(false); }}>{option.label}{option.value === value && <Check />}</button>)}</div>}</div>;
}

function Overview({ onNavigate, onOpen, onNew }: { onNavigate: (page: Page) => void; onOpen: (reservation: Reservation) => void; onNew: () => void }) {
  const { reservations, berths, vessels } = useReservations();
  const berthCapacity = [...berths].sort((a, b) => (b.maxVesselLengthFt ?? -1) - (a.maxVesselLengthFt ?? -1)).slice(0, 5);
  const scheduleYears = useMemo(() => {
    const years = reservations.map((item) => Number(item.startDate.slice(0, 4)));
    const first = Math.min(...years);
    const last = Math.max(...years);
    return Array.from({ length: last - first + 1 }, (_, index) => first + index);
  }, [reservations]);
  const yearData = useMemo(() => {
    return scheduleYears.map((year) => ({ year: String(year), bookings: reservations.filter((item) => item.startDate.startsWith(String(year))).length }));
  }, [reservations, scheduleYears]);
  const recent = [...reservations].sort(newestReservationFirst).slice(0, 5);
  const latestYear = scheduleYears.at(-1);
  return <>
    <PageTitle eyebrow="Waterfront operations" title="Overview"><div className="title-actions"><button className="secondary-button" onClick={() => onNavigate("schedule")}>Open schedule <ChevronRight size={16} /></button><button className="primary-button" onClick={onNew}><Plus size={17} /> New reservation</button></div></PageTitle>
    <section className="metric-grid" aria-label="Schedule summary">
      <Metric label="Reservations" value={reservations.length.toLocaleString()} note={`Across ${scheduleYears.length} annual schedules`} icon={<CalendarDays />} />
      <Metric label="Vessels" value={vessels.length.toLocaleString()} note={`${vessels.filter((item) => item.lengthFt != null).length} with recorded length`} icon={<Ship />} />
      <Metric label="Berths" value={berths.length.toString()} note={`${berths.filter((item) => item.maxVesselLengthFt != null).length} with vessel length limits`} icon={<Anchor />} />
      <Metric label="Events" value={reservations.filter((item) => item.type === "event").length.toLocaleString()} note="Community and operational use" icon={<CalendarDays />} />
      <Metric label="Closures" value={reservations.filter((item) => item.type === "closure").length.toLocaleString()} note="Maintenance and access restrictions" icon={<AlertTriangle />} />
    </section>
    <div className="overview-grid">
      <section className="panel chart-panel">
        <div className="panel-heading"><div><span>Historical activity</span><h2>Reservations by year</h2></div><small>Confirmed bookings</small></div>
        <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={yearData} margin={{ top: 10, right: 8, left: -24, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dbe4e8" /><XAxis dataKey="year" tick={{ fontSize: 11 }} interval={2} /><YAxis tick={{ fontSize: 11 }} /><Tooltip cursor={{ fill: "#edf5f6" }} /><Bar dataKey="bookings" fill="#087f8c" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
      </section>
      <section className="panel capacity-panel">
        <div className="panel-heading"><div><span>Waterfront plan</span><h2>Berth capacity</h2></div><button className="text-button" onClick={() => onNavigate("schedule")}>Open schedule</button></div>
        {berthCapacity.map((berth) => <div className="berth-capacity-row" key={berth.id}><span><Anchor size={15} /></span><div><strong>{berth.name}</strong><small>{berth.category ?? "Vessel berth"}</small></div><b>{berth.maxVesselLengthFt ? `${berth.maxVesselLengthFt} ft` : "Flexible"}</b></div>)}
        <div className="capacity-summary">Maximum supported vessel length by berth</div>
      </section>
    </div>
    <section className="panel recent-panel">
      <div className="panel-heading"><div><span>Latest schedule year</span><h2>{latestYear} reservations</h2></div><button className="text-button" onClick={() => onNavigate("reservations")}>Search history</button></div>
      <div className="compact-table">
        {recent.map((item) => <button key={item.id} onClick={() => onOpen(item)}><span className={`type-icon ${item.type}`}><Ship size={15} /></span><strong>{item.title}</strong><span>{berths.find((berth) => berth.id === item.berthId)?.name}</span><span>{format(parseISO(item.startDate), "MMM d, yyyy")}</span><ChevronRight size={16} /></button>)}
      </div>
    </section>
  </>;
}

function Metric({ label, value, note, icon }: { label: string; value: string; note: string; icon: React.ReactNode }) {
  return <article className="metric"><div className="metric-icon">{icon}</div><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}

function Schedule({ month, setMonth, onOpen, onNew }: { month: string; setMonth: (month: string) => void; onOpen: (reservation: Reservation) => void; onNew: () => void }) {
  const { reservations, berths } = useReservations();
  const currentMonth = format(new Date(), "yyyy-MM");
  const start = startOfMonth(parseISO(`${month}-01`));
  const end = endOfMonth(start);
  const days = eachDayOfInterval({ start, end });
  const visible = reservations.filter((item) => item.startDate <= format(end, "yyyy-MM-dd") && item.endDate >= format(start, "yyyy-MM-dd"));
  const setOffset = (offset: number) => setMonth(format(addMonths(start, offset), "yyyy-MM"));
  return <>
    <PageTitle eyebrow="Berth schedule" title={format(start, "MMMM yyyy")}><div className="title-actions"><button className="secondary-button today-button" onClick={() => setMonth(currentMonth)} disabled={month === currentMonth}>Today</button><button className="icon-button" onClick={() => setOffset(-1)} aria-label="Previous month"><ChevronLeft /></button><MonthPicker value={month} onChange={setMonth} /><button className="icon-button" onClick={() => setOffset(1)} aria-label="Next month"><ChevronRight /></button><button className="primary-button" onClick={onNew}><Plus size={17} /> Reserve berth</button></div></PageTitle>
    <div className="schedule-toolbar"><div><span className="legend vessel" />Vessel<span className="legend event" />Event<span className="legend closure" />Closure</div></div>
    <section className="schedule-frame" aria-label={`${format(start, "MMMM yyyy")} berth schedule`}>
      <div className="timeline" style={{ "--days": days.length } as React.CSSProperties}>
        <div className="timeline-corner"><span>Berth</span><small>Maximum length</small></div>
        <div className="timeline-days">{days.map((day) => <div key={day.toISOString()} className={[0, 6].includes(day.getDay()) ? "weekend" : ""}><span>{format(day, "EEE")}</span><strong>{format(day, "d")}</strong></div>)}</div>
        {berths.map((berth) => {
          const items = visible.filter((item) => item.berthId === berth.id);
          return <div className="berth-line" key={berth.id}>
            <div className="berth-label"><strong>{berth.name}</strong><small>{berth.maxVesselLengthFt ? `Up to ${berth.maxVesselLengthFt} ft` : "Capacity not specified"}</small></div>
            <div className="berth-days">{days.map((day) => <div key={day.toISOString()} className={[0, 6].includes(day.getDay()) ? "weekend" : ""} />)}{items.map((item) => {
              const itemStart = parseISO(item.startDate) < start ? start : parseISO(item.startDate);
              const itemEnd = parseISO(item.endDate) > end ? end : parseISO(item.endDate);
              const left = Math.round((daysInclusive(format(start, "yyyy-MM-dd"), format(itemStart, "yyyy-MM-dd")) - 1) / days.length * 10000) / 100;
              const width = Math.max(3.2, Math.round(daysInclusive(format(itemStart, "yyyy-MM-dd"), format(itemEnd, "yyyy-MM-dd")) / days.length * 10000) / 100);
              return <button key={item.id} className="reservation-block" style={{ left: `${left}%`, width: `${width}%`, background: berthColor(item.type) }} onClick={() => onOpen(item)} title={`${item.title}: ${item.startDate} to ${item.endDate}`}><span>{item.title}</span></button>;
            })}</div>
          </div>;
        })}
      </div>
      {visible.length === 0 && <div className="empty-state"><CalendarDays /><strong>No reservations in this month</strong><span>Move to a historical month or create a new reservation.</span></div>}
    </section>
  </>;
}

function ReservationsPage({ onOpen, onNew }: { onOpen: (reservation: Reservation) => void; onNew: () => void }) {
  const { reservations, berths } = useReservations();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [year, setYear] = useState("all");
  const years = [...new Set(reservations.map((item) => item.startDate.slice(0, 4)))].sort((a, b) => b.localeCompare(a));
  const filtered = reservations.filter((item) => (type === "all" || item.type === type) && (year === "all" || item.startDate.startsWith(year)) && `${item.title} ${berths.find((berth) => berth.id === item.berthId)?.name}`.toLowerCase().includes(query.toLowerCase())).sort(newestReservationFirst);
  return <>
    <PageTitle eyebrow="Historical record" title="Reservations"><div className="title-actions"><span className="record-count">{filtered.length.toLocaleString()} records</span><button className="primary-button" onClick={onNew}><Plus size={17} /> New reservation</button></div></PageTitle>
    <div className="filter-bar"><label><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search reservations" /></label><InAppSelect label="Reservation type" value={type} onChange={setType} options={[{ value: "all", label: "All types" }, { value: "vessel", label: "Vessels" }, { value: "event", label: "Events" }, { value: "closure", label: "Closures" }]} /><InAppSelect label="Year" value={year} onChange={setYear} options={[{ value: "all", label: "All years" }, ...years.map((item) => ({ value: item, label: item }))]} /></div>
    <div className="table-panel"><table><thead><tr><th>Reservation</th><th>Type</th><th>Berth</th><th>Dates</th><th>Status</th><th /></tr></thead><tbody>{filtered.slice(0, 250).map((item) => <tr key={item.id} onClick={() => onOpen(item)}><td><strong>{item.title}</strong></td><td><span className={`type-pill ${item.type}`}>{item.type}</span></td><td>{berths.find((berth) => berth.id === item.berthId)?.name}</td><td>{format(parseISO(item.startDate), "MMM d, yyyy")}{item.endDate !== item.startDate && <> to {format(parseISO(item.endDate), "MMM d, yyyy")}</>}</td><td>Confirmed</td><td><ChevronRight size={16} /></td></tr>)}</tbody></table>{filtered.length > 250 && <div className="table-foot">Showing the first 250 matching records. Narrow the filters to see a specific visit.</div>}</div>
  </>;
}

const checkLabels: Record<ScheduleCheckKind, string> = {
  overlap: "Overlapping bookings",
  "vessel-fit": "Vessel does not fit",
  "vessel-length": "Vessel length needed",
  "berth-limit": "Missing berth limit",
  "reservation-data": "Incomplete reservation",
};

function ScheduleChecks({ onEdit }: { onEdit: (reservation: Reservation) => void }) {
  const { reservations, berths, vessels, importedIssues } = useReservations();
  const [kind, setKind] = useState<ScheduleCheckKind | "all">("all");
  const [selectedCheckId, setSelectedCheckId] = useState<string | null>(null);
  const reservationById = useMemo(() => new Map(reservations.map((item) => [item.id, item])), [reservations]);
  const checks = useMemo<ScheduleCheck[]>(() => {
    const missingBerthLimits = berths
      .filter((berth) => berth.maxVesselLengthFt == null)
      .map((berth): ScheduleCheck => ({
        id: `berth-limit-${berth.id}`,
        kind: "berth-limit",
        title: berth.name,
        detail: "Set a maximum vessel length so fit can be checked automatically.",
        berthId: berth.id,
      }));

    const referenceDataChecks = importedIssues
      .filter((item) => ["UNKNOWN_VESSEL_LENGTH", "VESSEL_LENGTH_CONFLICT", "MISSING_DATA", "INVALID_DATE_RANGE"].includes(item.type))
      .filter((item) => {
        const related = item.reservationIds?.map((id) => reservationById.get(id)).filter((reservation): reservation is Reservation => Boolean(reservation)) ?? [];
        const vessel = vessels.find((candidate) => candidate.id === item.vesselId);
        const berth = berths.find((candidate) => candidate.id === item.berthId);
        if (item.type === "UNKNOWN_VESSEL_LENGTH") return vessel?.lengthFt == null;
        if (item.type === "VESSEL_LENGTH_CONFLICT") return Boolean(vessel && new Set(vessel.lengthSources.map((source) => source.valueFt)).size > 1);
        if (item.type === "INVALID_DATE_RANGE") return Boolean(related[0] && related[0].startDate > related[0].endDate);
        if (item.type === "MISSING_DATA") return !related[0] || !related[0].berthId || (related[0].type === "vessel" && !related[0].vesselId) || !berth;
        return true;
      })
      .map((item): ScheduleCheck => {
        const related = item.reservationIds?.map((id) => reservationById.get(id)).filter((reservation): reservation is Reservation => Boolean(reservation)) ?? [];
        const vessel = vessels.find((candidate) => candidate.id === item.vesselId);
        const kind: ScheduleCheckKind = item.type === "UNKNOWN_VESSEL_LENGTH" || item.type === "VESSEL_LENGTH_CONFLICT" ? "vessel-length" : "reservation-data";
        return {
          id: item.id,
          kind,
          title: vessel?.name ?? related[0]?.title ?? "Reservation information is incomplete",
          detail: item.message,
          date: related[0]?.startDate ?? (item.year ? `${item.year}-01-01` : undefined),
          reservations: related,
          vesselId: item.vesselId,
          berthId: item.berthId,
        };
      });

    const overlapChecks = reservations.flatMap((reservation, index) => reservations.slice(index + 1).flatMap((candidate): ScheduleCheck[] => {
      const overlaps = candidate.startDate <= reservation.endDate && reservation.startDate <= candidate.endDate;
      if (!overlaps) return [];
      const date = reservation.startDate > candidate.startDate ? reservation.startDate : candidate.startDate;
      if (candidate.berthId === reservation.berthId) {
        const berth = berths.find((item) => item.id === reservation.berthId);
        return [{
          id: `berth-overlap-${reservation.id}-${candidate.id}`,
          kind: "overlap",
          title: `${berth?.name ?? "A berth"} is double-booked`,
          detail: `${reservation.title} and ${candidate.title} occupy the same berth on overlapping dates.`,
          date,
          reservations: [reservation, candidate],
          berthId: reservation.berthId,
        }];
      }
      if (reservation.type === "vessel" && candidate.type === "vessel" && reservation.vesselId && candidate.vesselId === reservation.vesselId) {
        return [{
          id: `vessel-overlap-${reservation.id}-${candidate.id}`,
          kind: "overlap",
          title: `${reservation.title} is booked at two berths`,
          detail: `${berths.find((item) => item.id === reservation.berthId)?.name ?? "One berth"} and ${berths.find((item) => item.id === candidate.berthId)?.name ?? "another berth"} overlap on the schedule.`,
          date,
          reservations: [reservation, candidate],
          vesselId: reservation.vesselId,
        }];
      }
      return [];
    }));

    const fitChecks = reservations.flatMap((reservation): ScheduleCheck[] => {
      if (reservation.type !== "vessel" || !reservation.vesselId) return [];
      const vessel = vessels.find((item) => item.id === reservation.vesselId);
      const berth = berths.find((item) => item.id === reservation.berthId);
      if (!berth || vesselFitsBerth(vessel, berth) !== false) return [];
      return [{
        id: `vessel-fit-${reservation.id}`,
        kind: "vessel-fit",
        title: `${reservation.title} does not fit ${berth.name}`,
        detail: `${vessel?.lengthFt} ft vessel exceeds the berth's ${berth.maxVesselLengthFt} ft limit.`,
        date: reservation.startDate,
        reservations: [reservation],
        vesselId: reservation.vesselId,
        berthId: reservation.berthId,
      }];
    });

    return [...overlapChecks, ...fitChecks, ...referenceDataChecks, ...missingBerthLimits].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || a.title.localeCompare(b.title));
  }, [berths, importedIssues, reservationById, reservations, vessels]);
  const visible = checks.filter((item) => kind === "all" || item.kind === kind);
  const count = (checkKind: ScheduleCheckKind) => checks.filter((item) => item.kind === checkKind).length;
  const selectedCheck = checks.find((item) => item.id === selectedCheckId);
  return <>
    <PageTitle eyebrow="Operational review" title="Schedule checks"><span className="record-count">{checks.length.toLocaleString()} checks</span></PageTitle>
    <section className="check-summary" aria-label="Schedule check totals">
      {(["overlap", "vessel-fit", "vessel-length", "berth-limit", "reservation-data"] as ScheduleCheckKind[]).map((item) => <button key={item} className={kind === item ? "active" : ""} onClick={() => setKind(kind === item ? "all" : item)}><span>{item === "overlap" || item === "reservation-data" ? <AlertTriangle /> : item === "vessel-fit" ? <Ship /> : item === "vessel-length" ? <CircleHelp /> : <Anchor />}</span><div><strong>{count(item).toLocaleString()}</strong><small>{checkLabels[item]}</small></div></button>)}
    </section>
    <div className="check-toolbar"><strong>{kind === "all" ? "All checks" : checkLabels[kind]}</strong>{kind !== "all" && <button className="text-button" onClick={() => setKind("all")}>Show all checks</button>}</div>
    <section className="check-list">
      {visible.map((item) => <button key={item.id} onClick={() => setSelectedCheckId(item.id)}><span className={`check-icon ${item.kind}`}>{item.kind === "overlap" || item.kind === "reservation-data" ? <AlertTriangle /> : item.kind === "vessel-fit" ? <Ship /> : item.kind === "vessel-length" ? <CircleHelp /> : <Anchor />}</span><span><strong>{item.title}</strong><small>{item.detail}</small></span><span className="check-meta">{item.date ? format(parseISO(item.date), "MMM d, yyyy") : item.kind === "berth-limit" ? "Berth setting" : item.kind === "vessel-length" ? "Vessel record" : "Needs attention"}<ChevronRight /></span></button>)}
    </section>
    {selectedCheck && <ScheduleCheckDrawer check={selectedCheck} onClose={() => setSelectedCheckId(null)} onEdit={onEdit} />}
  </>;
}

function ScheduleCheckDrawer({ check, onClose, onEdit }: { check: ScheduleCheck; onClose: () => void; onEdit: (reservation: Reservation) => void }) {
  const { berths, vessels, updateBerth, updateVessel } = useReservations();
  const [closing, setClosing] = useState(false);
  const vessel = vessels.find((item) => item.id === check.vesselId);
  const berth = berths.find((item) => item.id === check.berthId);
  const editableVessel = check.kind === "vessel-length" ? vessel : undefined;
  const editableBerth = check.kind === "berth-limit" ? berth : undefined;
  const [measurement, setMeasurement] = useState(() => String(editableVessel?.lengthFt ?? editableBerth?.maxVesselLengthFt ?? ""));
  const [error, setError] = useState("");
  const requestClose = () => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(onClose, 190);
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && requestClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const saveMeasurement = () => {
    const value = Number(measurement);
    if (!Number.isFinite(value) || value <= 0) return setError("Enter a valid length in feet.");
    if (editableVessel) updateVessel({ ...editableVessel, lengthFt: value, lengthSources: [{ valueFt: value, source: "manual" }] });
    if (editableBerth) updateBerth({ ...editableBerth, maxVesselLengthFt: value });
    requestClose();
  };
  const resolutionText = editableVessel ? "Enter the verified vessel length. This check clears as soon as the value is saved." : editableBerth ? "Enter the berth's maximum supported vessel length. This check clears as soon as the value is saved." : "Edit one of the affected reservations. The check clears when the schedule no longer violates this rule.";
  return <div className={`overlay ${closing ? "closing" : ""}`} onMouseDown={(event) => event.target === event.currentTarget && requestClose()}><aside className="drawer check-drawer" aria-label="Schedule check details"><div className="drawer-header"><div><span className="type-pill closure">{checkLabels[check.kind]}</span><h2>{check.title}</h2></div><button type="button" className="icon-button" onClick={requestClose} aria-label="Close"><X /></button></div><div className="drawer-body"><div className="check-resolution-intro"><AlertTriangle /><div><strong>Action needed</strong><p>{check.detail}</p></div></div><dl className="detail-list"><div><dt>Check</dt><dd>{checkLabels[check.kind]}</dd></div>{check.date && <div><dt>Date</dt><dd>{format(parseISO(check.date), "MMMM d, yyyy")}</dd></div>}{vessel && <div><dt>Vessel</dt><dd>{vessel.name}<small>{vessel.lengthFt ? `${vessel.lengthFt} ft currently recorded` : "Length is missing"}</small></dd></div>}{berth && <div><dt>Berth</dt><dd>{berth.name}<small>{berth.maxVesselLengthFt ? `${berth.maxVesselLengthFt} ft maximum` : "Maximum length is missing"}</small></dd></div>}</dl><section className="resolution-panel"><span>How to resolve</span><p>{resolutionText}</p>{(editableVessel || editableBerth) && <label>{editableVessel ? "Verified vessel length (ft)" : "Maximum vessel length (ft)"}<input type="number" min="1" step="0.1" value={measurement} onChange={(event) => { setMeasurement(event.target.value); setError(""); }} /></label>}{error && <div className="form-error"><AlertTriangle />{error}</div>}{!editableVessel && !editableBerth && check.reservations?.map((reservation) => <button type="button" className="secondary-button resolution-reservation" key={reservation.id} onClick={() => { requestClose(); window.setTimeout(() => onEdit(reservation), 190); }}>Edit {reservation.title}</button>)}</section></div><div className="drawer-actions"><button type="button" className="secondary-button" onClick={requestClose}>Close</button>{(editableVessel || editableBerth) && <button type="button" className="primary-button" onClick={saveMeasurement}>Save and resolve</button>}</div></aside></div>;
}

function ReservationDrawer({ reservation, onClose, onEdit }: { reservation: Reservation; onClose: () => void; onEdit: () => void }) {
  const { berths, vessels, deleteReservation } = useReservations();
  const [closing, setClosing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const berth = berths.find((item) => item.id === reservation.berthId);
  const vessel = vessels.find((item) => item.id === reservation.vesselId);
  const requestClose = () => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(onClose, 190);
  };
  const requestEdit = () => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(onEdit, 190);
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && !confirmDelete && requestClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return <><div className={`overlay ${closing ? "closing" : ""}`} onMouseDown={(event) => event.target === event.currentTarget && requestClose()}><aside className="drawer" aria-label="Reservation details"><div className="drawer-header"><div><span className={`type-pill ${reservation.type}`}>{reservation.type}</span><h2>{reservation.title}</h2></div><button className="icon-button" onClick={requestClose} aria-label="Close"><X /></button></div><div className="drawer-body">
    <dl className="detail-list"><div><dt>Berth</dt><dd>{berth?.name}<small>{berth?.maxVesselLengthFt ? `${berth.maxVesselLengthFt} ft maximum vessel length` : "No vessel length limit set"}</small></dd></div><div><dt>Dates</dt><dd>{format(parseISO(reservation.startDate), "MMMM d, yyyy")}{reservation.endDate !== reservation.startDate && <> to {format(parseISO(reservation.endDate), "MMMM d, yyyy")}</>}<small>{daysInclusive(reservation.startDate, reservation.endDate)} calendar {daysInclusive(reservation.startDate, reservation.endDate) === 1 ? "day" : "days"}</small></dd></div>{vessel && <div><dt>Vessel</dt><dd>{vessel.name}<small>{vessel.lengthFt ? `${vessel.lengthFt} ft length overall` : "Length unknown"}{vessel.operator ? `, ${vessel.operator}` : ""}</small></dd></div>}<div><dt>Status</dt><dd>Confirmed<small>Scheduled reservation</small></dd></div></dl>
  </div><div className="drawer-actions"><button className="secondary-button" onClick={requestEdit}>Edit reservation</button><button className="danger-button" onClick={() => setConfirmDelete(true)}>Delete</button></div></aside></div>{confirmDelete && <ConfirmationDialog title="Delete this reservation?" message={`${reservation.title} will be removed from this browser's schedule. This cannot be undone.`} confirmLabel="Delete reservation" danger onCancel={() => setConfirmDelete(false)} onConfirm={() => { setConfirmDelete(false); deleteReservation(reservation.id); requestClose(); }} />}</>;
}

function ReservationDialog({ reservation, onClose }: { reservation?: Reservation; onClose: () => void }) {
  const { reservations, berths, vessels, addVessel, saveReservation } = useReservations();
  const today = format(new Date(), "yyyy-MM-dd");
  const [closing, setClosing] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [type, setType] = useState<ReservationType>(reservation?.type ?? "vessel");
  const [title, setTitle] = useState(reservation?.title ?? "");
  const [vesselId, setVesselId] = useState(reservation?.vesselId ?? "");
  const [vesselSearch, setVesselSearch] = useState(() => vessels.find((item) => item.id === reservation?.vesselId)?.name ?? "");
  const [vesselPickerOpen, setVesselPickerOpen] = useState(false);
  const [addingVessel, setAddingVessel] = useState(false);
  const [newVesselName, setNewVesselName] = useState("");
  const [newVesselLength, setNewVesselLength] = useState("");
  const [newVesselOperator, setNewVesselOperator] = useState("");
  const [newVesselError, setNewVesselError] = useState("");
  const [berthId, setBerthId] = useState(reservation?.berthId ?? "");
  const [berthPickerOpen, setBerthPickerOpen] = useState(false);
  const [startDate, setStartDate] = useState(reservation?.startDate ?? today);
  const [endDate, setEndDate] = useState(reservation?.endDate ?? today);
  const [error, setError] = useState("");
  const vessel = vessels.find((item) => item.id === vesselId);
  const initialVesselSearch = vessels.find((item) => item.id === reservation?.vesselId)?.name ?? "";
  const hasUnsavedChanges = type !== (reservation?.type ?? "vessel") || title !== (reservation?.title ?? "") || vesselId !== (reservation?.vesselId ?? "") || vesselSearch !== initialVesselSearch || berthId !== (reservation?.berthId ?? "") || startDate !== (reservation?.startDate ?? today) || endDate !== (reservation?.endDate ?? today) || newVesselName !== "" || newVesselLength !== "" || newVesselOperator !== "";
  const visibleVessels = useMemo(() => {
    const term = vesselSearch.trim().toLowerCase();
    const matches = vessels.filter((item) => !term || item.name.toLowerCase().includes(term) || item.aliases.some((alias) => alias.toLowerCase().includes(term))).slice(0, 12);
    const selectedVessel = vessels.find((item) => item.id === vesselId);
    return selectedVessel && !matches.some((item) => item.id === selectedVessel.id) ? [selectedVessel, ...matches] : matches;
  }, [vesselId, vesselSearch, vessels]);
  const chooseVessel = (chosen: Vessel) => {
    setVesselId(chosen.id);
    setVesselSearch(chosen.name);
    setTitle(chosen.name);
    setVesselPickerOpen(false);
    setAddingVessel(false);
  };
  const beginAddingVessel = () => {
    setNewVesselName(vesselSearch.trim());
    setNewVesselLength("");
    setNewVesselOperator("");
    setNewVesselError("");
    setAddingVessel(true);
    setVesselPickerOpen(false);
  };
  const createVessel = () => {
    const lengthFt = Number(newVesselLength);
    if (!newVesselName.trim()) return setNewVesselError("Enter the vessel name.");
    if (!Number.isFinite(lengthFt) || lengthFt <= 0) return setNewVesselError("Enter a valid vessel length.");
    const created: Vessel = {
      id: `custom-vessel-${crypto.randomUUID()}`,
      name: newVesselName.trim(),
      lengthFt,
      lengthSources: [{ valueFt: lengthFt, source: "manual" }],
      aliases: [newVesselName.trim()],
      operator: newVesselOperator.trim() || undefined,
      contacts: [],
      notes: [],
    };
    addVessel(created);
    chooseVessel(created);
  };
  const changeType = (nextType: ReservationType) => {
    if (nextType === type) return;
    setType(nextType);
    setError("");
    setAddingVessel(false);
    setVesselPickerOpen(false);
    setTitle(nextType === "vessel" ? vessel?.name ?? "" : "");
  };
  const recommendations = startDate && endDate && startDate <= endDate ? recommendBerths(berths, reservations, vessel, startDate, endDate, reservation?.id) : [];
  const sortedRecommendations = [...recommendations].sort((a, b) => Number(b.recommended) - Number(a.recommended));
  const selectedAssessment = recommendations.find((item) => item.berth.id === berthId);
  const selectedBerth = berths.find((item) => item.id === berthId);
  const vesselUnavailable = (candidate: Vessel) => Boolean(startDate && endDate && startDate <= endDate && findVesselConflicts(reservations, { id: reservation?.id, vesselId: candidate.id, startDate, endDate }).length);
  const performClose = () => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(onClose, 190);
  };
  const requestClose = () => {
    if (closing || confirmLeave) return;
    if (hasUnsavedChanges) {
      setConfirmLeave(true);
      return;
    }
    performClose();
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && requestClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [hasUnsavedChanges]);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (type === "vessel" && !vessel) return setError("Choose a vessel or add a new one.");
    if (!title.trim() || !berthId || !startDate || !endDate) return setError("Complete the title, berth, and date range.");
    if (startDate > endDate) return setError("End date must be on or after start date.");
    const selectedBerth = berths.find((item) => item.id === berthId)!;
    const vesselConflicts = type === "vessel" ? findVesselConflicts(reservations, { id: reservation?.id, vesselId, startDate, endDate }) : [];
    if (vesselConflicts.length) return setError(`${vessel?.name} already has a booking from ${format(parseISO(vesselConflicts[0].startDate), "MMM d")} to ${format(parseISO(vesselConflicts[0].endDate), "MMM d, yyyy")}.`);
    const conflicts = findConflicts(reservations, { id: reservation?.id, berthId, startDate, endDate });
    if (conflicts.length) return setError(`${selectedBerth.name} is occupied by ${conflicts[0].title} during this date range.`);
    if (type === "vessel" && vesselFitsBerth(vessel, selectedBerth) === false) return setError(`${vessel?.name} is too long for ${selectedBerth.name}.`);
    saveReservation({ id: reservation?.id ?? `created-${crypto.randomUUID()}`, type, title: type === "vessel" && vessel ? vessel.name : title.trim(), vesselId: type === "vessel" ? vesselId : undefined, berthId, startDate, endDate, origin: reservation?.origin ?? "created", source: reservation?.source, importConfidence: reservation?.importConfidence, modifiedSinceImport: reservation?.origin === "imported", status: "confirmed" });
    performClose();
  };
  return <><div className={`overlay dialog-overlay ${closing ? "closing" : ""}`} onMouseDown={(event) => event.target === event.currentTarget && requestClose()}><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="reservation-title"><div className="dialog-header"><div><span>{reservation ? "Update booking" : "New booking"}</span><h2 id="reservation-title">{reservation ? "Edit reservation" : "Reserve a berth"}</h2></div><button className="icon-button" onClick={requestClose} aria-label="Close"><X /></button></div><form onSubmit={submit}><div className="segmented">{(["vessel", "event", "closure"] as ReservationType[]).map((item) => <button type="button" key={item} className={type === item ? "active" : ""} onClick={() => changeType(item)}>{item === "vessel" ? <Ship size={16} /> : item === "event" ? <CalendarDays size={16} /> : <AlertTriangle size={16} />}{item}</button>)}</div>
    <div className="booking-type-fields" key={type}>{type === "vessel" ? <div className="vessel-picker vessel-combobox" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setVesselPickerOpen(false); }}><label htmlFor="vessel-search">Vessel</label><div className="picker-search"><Search size={16} /><input id="vessel-search" role="combobox" aria-expanded={vesselPickerOpen} aria-controls="vessel-options" autoComplete="off" value={vesselSearch} onFocus={() => setVesselPickerOpen(true)} onChange={(event) => { setVesselSearch(event.target.value); setVesselId(""); setTitle(""); setAddingVessel(false); setVesselPickerOpen(true); }} placeholder="Type a vessel name" /></div>{vesselPickerOpen && <div className="vessel-options" id="vessel-options" role="listbox">{visibleVessels.map((item) => { const unavailable = vesselUnavailable(item); return <button type="button" role="option" aria-selected={item.id === vesselId} key={item.id} disabled={unavailable} onClick={() => chooseVessel(item)}><span><strong>{item.name}</strong><small>{unavailable ? "Not available · already booked for these dates" : item.lengthFt ? `${item.lengthFt} ft${item.operator ? ` · ${item.operator}` : ""}` : "Length unknown"}</small></span>{unavailable ? <span className="unavailable-label">Not available</span> : <ChevronRight />}</button>; })}<button type="button" className="add-vessel-option" onClick={beginAddingVessel}><Plus /><span><strong>Add new vessel</strong><small>{vesselSearch.trim() ? `Create “${vesselSearch.trim()}”` : "Enter vessel details"}</small></span></button></div>}{addingVessel && <div className="add-vessel-panel"><div><strong>Add new vessel</strong><button type="button" className="text-button" onClick={() => setAddingVessel(false)}>Cancel</button></div><label>Name<input value={newVesselName} onChange={(event) => setNewVesselName(event.target.value)} autoFocus /></label><div className="form-row"><label>Length overall (ft)<input type="number" min="1" step="0.1" value={newVesselLength} onChange={(event) => setNewVesselLength(event.target.value)} /></label><label>Operator <small>Optional</small><input value={newVesselOperator} onChange={(event) => setNewVesselOperator(event.target.value)} /></label></div>{newVesselError && <div className="form-error"><AlertTriangle size={16} />{newVesselError}</div>}<button type="button" className="secondary-button" onClick={createVessel}><Plus size={16} /> Save vessel</button></div>}</div> : <label>{type === "event" ? "Event" : "Closure"} name<input value={title} onChange={(event) => setTitle(event.target.value)} required autoFocus /></label>}</div>
    <div className="form-row date-form-row"><InAppDatePicker label="Start date" value={startDate} onChange={(value) => { setStartDate(value); if (endDate < value) setEndDate(value); }} /><InAppDatePicker label="End date" value={endDate} min={startDate} onChange={setEndDate} /></div>
    <div className="berth-picker vessel-combobox" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setBerthPickerOpen(false); }}><label>Berth</label><button type="button" className="combobox-trigger" aria-expanded={berthPickerOpen} aria-controls="berth-options" onClick={() => setBerthPickerOpen((open) => !open)}><span>{selectedBerth?.name ?? "Select a berth"}<small>{selectedBerth ? selectedBerth.maxVesselLengthFt ? `Up to ${selectedBerth.maxVesselLengthFt} ft` : "Capacity not specified" : "Choose from available waterfront locations"}</small></span><ChevronRight /></button>{berthPickerOpen && <div className="vessel-options berth-options" id="berth-options" role="listbox">{sortedRecommendations.map((item) => { const unavailable = !item.available || item.fits === false; const reason = item.vesselConflicts.length ? "vessel already booked" : item.conflicts.length ? "berth occupied" : item.fits === false ? "vessel too long" : item.berth.maxVesselLengthFt ? `up to ${item.berth.maxVesselLengthFt} ft` : "capacity not specified"; return <button type="button" role="option" aria-selected={item.berth.id === berthId} key={item.berth.id} disabled={unavailable} onClick={() => { setBerthId(item.berth.id); setBerthPickerOpen(false); }}><span><strong>{item.recommended ? `Recommended · ${item.berth.name}` : item.berth.name}</strong><small>{unavailable ? `Not available · ${reason}` : reason}</small></span>{unavailable ? <span className="unavailable-label">Not available</span> : <ChevronRight />}</button>; })}</div>}</div>
    {berthId && selectedAssessment && <div className={`assessment ${selectedAssessment.available && selectedAssessment.fits !== false ? "good" : "bad"}`}>{selectedAssessment.available && selectedAssessment.fits !== false ? <Check /> : <AlertTriangle />}<div><strong>{selectedAssessment.vesselConflicts.length ? "Vessel is already booked" : selectedAssessment.available ? selectedAssessment.fits === false ? "Vessel does not fit" : "Available for these dates" : "Berth is occupied"}</strong><span>{selectedAssessment.vesselConflicts.length ? `${vessel?.name} has another reservation during these dates.` : selectedAssessment.recommended ? "Best-fit available berth for this vessel." : selectedAssessment.spareFeet != null ? `${selectedAssessment.spareFeet} ft of clearance.` : "No vessel length limit is set for this berth."}</span></div></div>}
    {error && <div className="form-error"><AlertTriangle size={17} />{error}</div>}
    <div className="dialog-actions"><button type="button" className="secondary-button" onClick={requestClose}>Cancel</button><button className="primary-button" type="submit">{reservation ? "Save changes" : "Create reservation"}</button></div></form></section></div>{confirmLeave && <ConfirmationDialog title="Discard unsaved changes?" message="Your changes to this reservation have not been saved." confirmLabel="Discard changes" danger onCancel={() => setConfirmLeave(false)} onConfirm={() => { setConfirmLeave(false); performClose(); }} />}</>;
}

export default App;
