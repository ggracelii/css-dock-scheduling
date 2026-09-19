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
  format,
  isWithinInterval,
  parseISO,
  startOfMonth,
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
type ScheduleCheckKind = "overlap" | "vessel-fit" | "vessel-length" | "berth-limit";

interface ScheduleCheck {
  id: string;
  kind: ScheduleCheckKind;
  title: string;
  detail: string;
  date?: string;
  reservation?: Reservation;
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
    updateWithViewTransition(() => {
      setSelected(null);
      if (drawerReturnPage) setPage(drawerReturnPage);
      setDrawerReturnPage(null);
    });
  };

  const closeEditor = () => {
    updateWithViewTransition(() => {
      setEditing(null);
      if (drawerReturnPage) setPage(drawerReturnPage);
      setDrawerReturnPage(null);
    });
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
          <span><strong>{firstScheduledYear}–{lastScheduledYear}</strong>{data.reservations.length.toLocaleString()} scheduled reservations</span>
        </div>
      </aside>
      <button className="sidebar-menu-toggle" onClick={toggleNavigation} aria-label="Toggle navigation" title="Toggle navigation"><Menu /></button>

      <main>
        <div className="content">
          <div className="page-surface" key={page}>
            {page === "overview" && <Overview onNavigate={navigate} onOpen={jumpToReservation} onNew={() => { setDrawerReturnPage(null); setEditing("new"); }} />}
            {page === "schedule" && <Schedule month={month} setMonth={setMonth} onOpen={(reservation) => { setDrawerReturnPage(null); setSelected(reservation); }} onNew={() => { setDrawerReturnPage(null); setEditing("new"); }} />}
            {page === "reservations" && <ReservationsPage onOpen={(reservation) => { setDrawerReturnPage(null); setSelected(reservation); }} onNew={() => { setDrawerReturnPage(null); setEditing("new"); }} />}
            {page === "checks" && <ScheduleChecks onOpen={jumpToReservation} />}
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
      <Metric label="Scheduled reservations" value={reservations.length.toLocaleString()} note={`Across ${scheduleYears.length} annual schedules`} icon={<CalendarDays />} />
      <Metric label="Known vessels" value={vessels.length.toLocaleString()} note={`${vessels.filter((item) => item.lengthFt != null).length} with recorded length`} icon={<Ship />} />
      <Metric label="Berths" value={berths.length.toString()} note={`${berths.filter((item) => item.maxVesselLengthFt != null).length} with vessel length limits`} icon={<Anchor />} />
      <Metric label="Waterfront events" value={reservations.filter((item) => item.type === "event").length.toLocaleString()} note="Community and operational use" icon={<CalendarDays />} />
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
  const start = startOfMonth(parseISO(`${month}-01`));
  const end = endOfMonth(start);
  const days = eachDayOfInterval({ start, end });
  const visible = reservations.filter((item) => item.startDate <= format(end, "yyyy-MM-dd") && item.endDate >= format(start, "yyyy-MM-dd"));
  const setOffset = (offset: number) => setMonth(format(addMonths(start, offset), "yyyy-MM"));
  return <>
    <PageTitle eyebrow="Berth schedule" title={format(start, "MMMM yyyy")}><div className="title-actions"><button className="icon-button" onClick={() => setOffset(-1)} aria-label="Previous month"><ChevronLeft /></button><input className="month-picker" type="month" value={month} min="1997-01" max="2028-12" onChange={(event) => setMonth(event.target.value)} /><button className="icon-button" onClick={() => setOffset(1)} aria-label="Next month"><ChevronRight /></button><button className="primary-button" onClick={onNew}><Plus size={17} /> Reserve berth</button></div></PageTitle>
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
    <div className="filter-bar"><label><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search reservations" /></label><select value={type} onChange={(event) => setType(event.target.value)} aria-label="Reservation type"><option value="all">All types</option><option value="vessel">Vessels</option><option value="event">Events</option><option value="closure">Closures</option></select><select value={year} onChange={(event) => setYear(event.target.value)} aria-label="Year"><option value="all">All years</option>{years.map((item) => <option key={item}>{item}</option>)}</select></div>
    <div className="table-panel"><table><thead><tr><th>Reservation</th><th>Type</th><th>Berth</th><th>Dates</th><th>Status</th><th /></tr></thead><tbody>{filtered.slice(0, 250).map((item) => <tr key={item.id} onClick={() => onOpen(item)}><td><strong>{item.title}</strong></td><td><span className={`type-pill ${item.type}`}>{item.type}</span></td><td>{berths.find((berth) => berth.id === item.berthId)?.name}</td><td>{format(parseISO(item.startDate), "MMM d, yyyy")}{item.endDate !== item.startDate && <> – {format(parseISO(item.endDate), "MMM d, yyyy")}</>}</td><td>Confirmed</td><td><ChevronRight size={16} /></td></tr>)}</tbody></table>{filtered.length > 250 && <div className="table-foot">Showing the first 250 matching records. Narrow the filters to see a specific visit.</div>}</div>
  </>;
}

const checkLabels: Record<ScheduleCheckKind, string> = {
  overlap: "Overlapping bookings",
  "vessel-fit": "Vessel does not fit",
  "vessel-length": "Missing vessel length",
  "berth-limit": "Missing berth limit",
};

function ScheduleChecks({ onOpen }: { onOpen: (reservation: Reservation) => void }) {
  const { reservations, berths, vessels, importedIssues } = useReservations();
  const [kind, setKind] = useState<ScheduleCheckKind | "all">("all");
  const reservationById = useMemo(() => new Map(reservations.map((item) => [item.id, item])), [reservations]);
  const checks = useMemo<ScheduleCheck[]>(() => {
    const latestByVessel = new Map<string, Reservation>();
    [...reservations].sort(newestReservationFirst).forEach((item) => {
      if (item.vesselId && !latestByVessel.has(item.vesselId)) latestByVessel.set(item.vesselId, item);
    });

    const missingVesselLengths = vessels
      .filter((vessel) => vessel.lengthFt == null)
      .map((vessel): ScheduleCheck => {
        const reservation = latestByVessel.get(vessel.id);
        return {
          id: `vessel-length-${vessel.id}`,
          kind: "vessel-length",
          title: vessel.name,
          detail: "Add the vessel length before confirming berth fit.",
          date: reservation?.startDate,
          reservation,
        };
      });

    const missingBerthLimits = berths
      .filter((berth) => berth.maxVesselLengthFt == null)
      .map((berth): ScheduleCheck => ({
        id: `berth-limit-${berth.id}`,
        kind: "berth-limit",
        title: berth.name,
        detail: "Set a maximum vessel length so fit can be checked automatically.",
      }));

    const bookingChecks = importedIssues
      .filter((item) => item.type === "BERTH_CONFLICT" || item.type === "VESSEL_TOO_LONG")
      .map((item): ScheduleCheck => {
        const reservation = item.reservationIds?.map((id) => reservationById.get(id)).find(Boolean);
        return {
          id: item.id,
          kind: item.type === "BERTH_CONFLICT" ? "overlap" : "vessel-fit",
          title: item.type === "BERTH_CONFLICT" ? "Two bookings use the same berth" : reservation?.title ?? "Vessel exceeds berth limit",
          detail: item.message,
          date: reservation?.startDate ?? (item.year ? `${item.year}-01-01` : undefined),
          reservation,
        };
      });

    const vesselOverlapChecks = reservations.flatMap((reservation, index) => {
      if (reservation.type !== "vessel" || !reservation.vesselId) return [];
      return reservations.slice(index + 1)
        .filter((candidate) => candidate.type === "vessel" && candidate.vesselId === reservation.vesselId && candidate.startDate <= reservation.endDate && reservation.startDate <= candidate.endDate)
        .map((candidate): ScheduleCheck => ({
          id: `vessel-overlap-${reservation.id}-${candidate.id}`,
          kind: "overlap",
          title: `${reservation.title} is booked at two berths`,
          detail: `${berths.find((item) => item.id === reservation.berthId)?.name ?? "One berth"} and ${berths.find((item) => item.id === candidate.berthId)?.name ?? "another berth"} overlap on the schedule.`,
          date: reservation.startDate > candidate.startDate ? reservation.startDate : candidate.startDate,
          reservation,
        }));
    });

    return [...vesselOverlapChecks, ...bookingChecks, ...missingVesselLengths, ...missingBerthLimits].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || a.title.localeCompare(b.title));
  }, [berths, importedIssues, reservationById, reservations, vessels]);
  const visible = checks.filter((item) => kind === "all" || item.kind === kind);
  const count = (checkKind: ScheduleCheckKind) => checks.filter((item) => item.kind === checkKind).length;
  return <>
    <PageTitle eyebrow="Operational review" title="Schedule checks"><span className="record-count">{checks.length.toLocaleString()} checks</span></PageTitle>
    <section className="check-summary" aria-label="Schedule check totals">
      {(["overlap", "vessel-fit", "vessel-length", "berth-limit"] as ScheduleCheckKind[]).map((item) => <button key={item} className={kind === item ? "active" : ""} onClick={() => setKind(kind === item ? "all" : item)}><span>{item === "overlap" ? <AlertTriangle /> : item === "vessel-fit" ? <Ship /> : item === "vessel-length" ? <CircleHelp /> : <Anchor />}</span><div><strong>{count(item).toLocaleString()}</strong><small>{checkLabels[item]}</small></div></button>)}
    </section>
    <div className="check-toolbar"><strong>{kind === "all" ? "All checks" : checkLabels[kind]}</strong>{kind !== "all" && <button className="text-button" onClick={() => setKind("all")}>Show all checks</button>}</div>
    <section className="check-list">
      {visible.slice(0, 250).map((item) => <button key={item.id} disabled={!item.reservation} onClick={() => item.reservation && onOpen(item.reservation)}><span className={`check-icon ${item.kind}`}>{item.kind === "overlap" ? <AlertTriangle /> : item.kind === "vessel-fit" ? <Ship /> : item.kind === "vessel-length" ? <CircleHelp /> : <Anchor />}</span><span><strong>{item.title}</strong><small>{item.detail}</small></span><span className="check-meta">{item.date ? format(parseISO(item.date), "MMM d, yyyy") : "Berth setting"}{item.reservation && <ChevronRight />}</span></button>)}
      {visible.length > 250 && <div className="table-foot">Showing 250 checks. Select a category above to narrow the list.</div>}
    </section>
  </>;
}

function ReservationDrawer({ reservation, onClose, onEdit }: { reservation: Reservation; onClose: () => void; onEdit: () => void }) {
  const { berths, vessels, deleteReservation } = useReservations();
  const [closing, setClosing] = useState(false);
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
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && requestClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return <div className={`overlay ${closing ? "closing" : ""}`} onMouseDown={(event) => event.target === event.currentTarget && requestClose()}><aside className="drawer" aria-label="Reservation details"><div className="drawer-header"><div><span className={`type-pill ${reservation.type}`}>{reservation.type}</span><h2>{reservation.title}</h2></div><button className="icon-button" onClick={requestClose} aria-label="Close"><X /></button></div><div className="drawer-body">
    <dl className="detail-list"><div><dt>Berth</dt><dd>{berth?.name}<small>{berth?.maxVesselLengthFt ? `${berth.maxVesselLengthFt} ft maximum vessel length` : "No vessel length limit set"}</small></dd></div><div><dt>Dates</dt><dd>{format(parseISO(reservation.startDate), "MMMM d, yyyy")}{reservation.endDate !== reservation.startDate && <> – {format(parseISO(reservation.endDate), "MMMM d, yyyy")}</>}<small>{daysInclusive(reservation.startDate, reservation.endDate)} calendar {daysInclusive(reservation.startDate, reservation.endDate) === 1 ? "day" : "days"}</small></dd></div>{vessel && <div><dt>Vessel</dt><dd>{vessel.name}<small>{vessel.lengthFt ? `${vessel.lengthFt} ft length overall` : "Length unknown"}{vessel.operator ? ` · ${vessel.operator}` : ""}</small></dd></div>}<div><dt>Status</dt><dd>Confirmed<small>Scheduled reservation</small></dd></div></dl>
  </div><div className="drawer-actions"><button className="secondary-button" onClick={requestEdit}>Edit reservation</button><button className="danger-button" onClick={() => { if (window.confirm("Delete this reservation from local demo data?")) { deleteReservation(reservation.id); requestClose(); } }}>Delete</button></div></aside></div>;
}

function ReservationDialog({ reservation, onClose }: { reservation?: Reservation; onClose: () => void }) {
  const { reservations, berths, vessels, addVessel, saveReservation } = useReservations();
  const today = format(new Date(), "yyyy-MM-dd");
  const [closing, setClosing] = useState(false);
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
    requestClose();
  };
  return <div className={`overlay dialog-overlay ${closing ? "closing" : ""}`} onMouseDown={(event) => event.target === event.currentTarget && requestClose()}><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="reservation-title"><div className="dialog-header"><div><span>{reservation ? "Update booking" : "New booking"}</span><h2 id="reservation-title">{reservation ? "Edit reservation" : "Reserve a berth"}</h2></div><button className="icon-button" onClick={requestClose} aria-label="Close"><X /></button></div><form onSubmit={submit}><div className="segmented">{(["vessel", "event", "closure"] as ReservationType[]).map((item) => <button type="button" key={item} className={type === item ? "active" : ""} onClick={() => changeType(item)}>{item === "vessel" ? <Ship size={16} /> : item === "event" ? <CalendarDays size={16} /> : <AlertTriangle size={16} />}{item}</button>)}</div>
    <div className="booking-type-fields" key={type}>{type === "vessel" ? <div className="vessel-picker vessel-combobox" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setVesselPickerOpen(false); }}><label htmlFor="vessel-search">Vessel</label><div className="picker-search"><Search size={16} /><input id="vessel-search" role="combobox" aria-expanded={vesselPickerOpen} aria-controls="vessel-options" autoComplete="off" value={vesselSearch} onFocus={() => setVesselPickerOpen(true)} onChange={(event) => { setVesselSearch(event.target.value); setVesselId(""); setTitle(""); setAddingVessel(false); setVesselPickerOpen(true); }} placeholder="Type a vessel name" /></div>{vesselPickerOpen && <div className="vessel-options" id="vessel-options" role="listbox">{visibleVessels.map((item) => { const unavailable = vesselUnavailable(item); return <button type="button" role="option" aria-selected={item.id === vesselId} key={item.id} disabled={unavailable} onClick={() => chooseVessel(item)}><span><strong>{item.name}</strong><small>{unavailable ? "Not available · already booked for these dates" : item.lengthFt ? `${item.lengthFt} ft${item.operator ? ` · ${item.operator}` : ""}` : "Length unknown"}</small></span>{unavailable ? <span className="unavailable-label">Not available</span> : <ChevronRight />}</button>; })}<button type="button" className="add-vessel-option" onClick={beginAddingVessel}><Plus /><span><strong>Add new vessel</strong><small>{vesselSearch.trim() ? `Create “${vesselSearch.trim()}”` : "Enter vessel details"}</small></span></button></div>}{addingVessel && <div className="add-vessel-panel"><div><strong>Add new vessel</strong><button type="button" className="text-button" onClick={() => setAddingVessel(false)}>Cancel</button></div><label>Name<input value={newVesselName} onChange={(event) => setNewVesselName(event.target.value)} autoFocus /></label><div className="form-row"><label>Length overall (ft)<input type="number" min="1" step="0.1" value={newVesselLength} onChange={(event) => setNewVesselLength(event.target.value)} /></label><label>Operator <small>Optional</small><input value={newVesselOperator} onChange={(event) => setNewVesselOperator(event.target.value)} /></label></div>{newVesselError && <div className="form-error"><AlertTriangle size={16} />{newVesselError}</div>}<button type="button" className="secondary-button" onClick={createVessel}><Plus size={16} /> Save vessel</button></div>}</div> : <label>{type === "event" ? "Event" : "Closure"} name<input value={title} onChange={(event) => setTitle(event.target.value)} required autoFocus /></label>}</div>
    <div className="form-row"><label>Start date<input type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); if (endDate < event.target.value) setEndDate(event.target.value); }} required /></label><label>End date<input type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} required /></label></div>
    <div className="berth-picker vessel-combobox" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setBerthPickerOpen(false); }}><label>Berth</label><button type="button" className="combobox-trigger" aria-expanded={berthPickerOpen} aria-controls="berth-options" onClick={() => setBerthPickerOpen((open) => !open)}><span>{selectedBerth?.name ?? "Select a berth"}<small>{selectedBerth ? selectedBerth.maxVesselLengthFt ? `Up to ${selectedBerth.maxVesselLengthFt} ft` : "Capacity not specified" : "Choose from available waterfront locations"}</small></span><ChevronRight /></button>{berthPickerOpen && <div className="vessel-options berth-options" id="berth-options" role="listbox">{sortedRecommendations.map((item) => { const unavailable = !item.available || item.fits === false; const reason = item.vesselConflicts.length ? "vessel already booked" : item.conflicts.length ? "berth occupied" : item.fits === false ? "vessel too long" : item.berth.maxVesselLengthFt ? `up to ${item.berth.maxVesselLengthFt} ft` : "capacity not specified"; return <button type="button" role="option" aria-selected={item.berth.id === berthId} key={item.berth.id} disabled={unavailable} onClick={() => { setBerthId(item.berth.id); setBerthPickerOpen(false); }}><span><strong>{item.recommended ? `Recommended · ${item.berth.name}` : item.berth.name}</strong><small>{unavailable ? `Not available · ${reason}` : reason}</small></span>{unavailable ? <span className="unavailable-label">Not available</span> : <ChevronRight />}</button>; })}</div>}</div>
    {berthId && selectedAssessment && <div className={`assessment ${selectedAssessment.available && selectedAssessment.fits !== false ? "good" : "bad"}`}>{selectedAssessment.available && selectedAssessment.fits !== false ? <Check /> : <AlertTriangle />}<div><strong>{selectedAssessment.vesselConflicts.length ? "Vessel is already booked" : selectedAssessment.available ? selectedAssessment.fits === false ? "Vessel does not fit" : "Available for these dates" : "Berth is occupied"}</strong><span>{selectedAssessment.vesselConflicts.length ? `${vessel?.name} has another reservation during these dates.` : selectedAssessment.recommended ? "Best-fit available berth for this vessel." : selectedAssessment.spareFeet != null ? `${selectedAssessment.spareFeet} ft of clearance.` : "No vessel length limit is set for this berth."}</span></div></div>}
    {error && <div className="form-error"><AlertTriangle size={17} />{error}</div>}
    <div className="dialog-actions"><button type="button" className="secondary-button" onClick={requestClose}>Cancel</button><button className="primary-button" type="submit">{reservation ? "Save changes" : "Create reservation"}</button></div></form></section></div>;
}

export default App;
