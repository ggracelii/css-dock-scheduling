import { useEffect, useMemo, useState } from "react";
import type React from "react";
import {
  Activity,
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
  RotateCcw,
  Search,
  Ship,
  SlidersHorizontal,
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
import { findConflicts, recommendBerths, vesselFitsBerth } from "./lib/scheduling";
import type { Reservation, ReservationType, ValidationIssue } from "./types";

type Page = "overview" | "schedule" | "reservations" | "health";

const berthColor = (type: ReservationType) =>
  type === "vessel" ? "var(--blue)" : type === "event" ? "var(--violet)" : "var(--amber)";

const issueLabel: Record<string, string> = {
  BERTH_CONFLICT: "Berth conflicts",
  VESSEL_TOO_LONG: "Capacity violations",
  UNKNOWN_VESSEL_LENGTH: "Unknown vessel lengths",
  VESSEL_LENGTH_CONFLICT: "Conflicting vessel lengths",
  UNMATCHED_VESSEL: "Unmatched vessels",
  AMBIGUOUS_ENTRY: "Ambiguous entries",
  SUMMARY_MISMATCH: "Summary mismatches",
};

function App() {
  const data = useReservations();
  const [page, setPage] = useState<Page>("overview");
  const [month, setMonth] = useState("2019-01");
  const [selected, setSelected] = useState<Reservation | null>(null);
  const [editing, setEditing] = useState<Reservation | "new" | null>(null);
  const [query, setQuery] = useState("");
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "/" && !(event.target instanceof HTMLInputElement)) {
        event.preventDefault();
        document.getElementById("global-search")?.focus();
      }
      if (event.key === "Escape") {
        setSelected(null);
        setEditing(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const searchResults = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return data.reservations
      .filter((item) => {
        const berth = data.berths.find((candidate) => candidate.id === item.berthId);
        return `${item.title} ${berth?.name} ${item.startDate}`.toLowerCase().includes(term);
      })
      .slice(0, 7);
  }, [data.berths, data.reservations, query]);

  const navigate = (target: Page) => {
    setPage(target);
    setMobileNav(false);
  };

  const jumpToReservation = (reservation: Reservation) => {
    setMonth(reservation.startDate.slice(0, 7));
    setPage("schedule");
    setSelected(reservation);
    setQuery("");
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><Anchor size={20} /></div>
          <div><strong>WHOI</strong><span>Dock Manager</span></div>
        </div>
        <nav aria-label="Primary navigation">
          <NavButton icon={<BarChart3 />} active={page === "overview"} onClick={() => navigate("overview")}>Overview</NavButton>
          <NavButton icon={<CalendarDays />} active={page === "schedule"} onClick={() => navigate("schedule")}>Schedule</NavButton>
          <NavButton icon={<History />} active={page === "reservations"} onClick={() => navigate("reservations")}>Reservations</NavButton>
          <NavButton icon={<Activity />} active={page === "health"} onClick={() => navigate("health")} badge={data.importedIssues.filter((issue) => issue.severity === "error").length}>Data health</NavButton>
        </nav>
        <div className="sidebar-note">
          <Database size={16} />
          <span><strong>{data.report.scheduleYears.first}–{data.report.scheduleYears.last}</strong>{data.report.reservationCount.toLocaleString()} imported reservations</span>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <button className="icon-button menu-button" onClick={() => setMobileNav(!mobileNav)} aria-label="Toggle navigation"><Menu /></button>
          <div className="search-wrap">
            <Search size={18} />
            <input id="global-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search vessels, berths, or years" aria-label="Search all reservations" />
            <kbd>/</kbd>
            {searchResults.length > 0 && (
              <div className="search-results">
                {searchResults.map((reservation) => (
                  <button key={reservation.id} onClick={() => jumpToReservation(reservation)}>
                    <span className={`type-dot ${reservation.type}`} />
                    <span><strong>{reservation.title}</strong><small>{data.berths.find((item) => item.id === reservation.berthId)?.name} · {format(parseISO(reservation.startDate), "MMM d, yyyy")}</small></span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="primary-button" onClick={() => setEditing("new")}><Plus size={17} /> New reservation</button>
        </header>

        <div className="content">
          {page === "overview" && <Overview onNavigate={navigate} onOpen={jumpToReservation} />}
          {page === "schedule" && <Schedule month={month} setMonth={setMonth} onOpen={setSelected} onNew={() => setEditing("new")} />}
          {page === "reservations" && <ReservationsPage onOpen={setSelected} />}
          {page === "health" && <DataHealth onView={jumpToReservation} />}
        </div>
      </main>

      {selected && <ReservationDrawer reservation={selected} onClose={() => setSelected(null)} onEdit={() => { setEditing(selected); setSelected(null); }} />}
      {editing && <ReservationDialog reservation={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function NavButton({ icon, active, badge, children, onClick }: { icon: React.ReactNode; active: boolean; badge?: number; children: React.ReactNode; onClick: () => void }) {
  return <button className={active ? "active" : ""} onClick={onClick}>{icon}<span>{children}</span>{badge ? <b>{badge}</b> : null}</button>;
}

function PageTitle({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return <div className="page-title"><div><span>{eyebrow}</span><h1>{title}</h1></div>{children}</div>;
}

function Overview({ onNavigate, onOpen }: { onNavigate: (page: Page) => void; onOpen: (reservation: Reservation) => void }) {
  const { reservations, berths, vessels, importedIssues, report } = useReservations();
  const operationalIssues = importedIssues.filter((issue) => issue.type === "BERTH_CONFLICT" || issue.type === "VESSEL_TOO_LONG");
  const yearData = useMemo(() => {
    const years = Array.from({ length: 23 }, (_, index) => 1997 + index);
    return years.map((year) => ({ year: String(year), bookings: reservations.filter((item) => item.startDate.startsWith(String(year))).length }));
  }, [reservations]);
  const recent = [...reservations].sort((a, b) => b.startDate.localeCompare(a.startDate)).slice(0, 5);
  return <>
    <PageTitle eyebrow="Waterfront operations" title="Overview"><button className="secondary-button" onClick={() => onNavigate("schedule")}>Open schedule <ChevronRight size={16} /></button></PageTitle>
    <section className="metric-grid" aria-label="Schedule summary">
      <Metric label="Historical reservations" value={report.reservationCount.toLocaleString()} note="Across 23 annual schedules" icon={<CalendarDays />} />
      <Metric label="Known vessels" value={vessels.length.toLocaleString()} note={`${vessels.filter((item) => item.lengthFt != null).length} with recorded length`} icon={<Ship />} />
      <Metric label="Physical resources" value={berths.length.toString()} note={`${berths.filter((item) => item.maxVesselLengthFt != null).length} with capacity limits`} icon={<Anchor />} />
      <Metric label="Schedule attention" value={operationalIssues.length.toString()} note="Historical conflicts or fit issues" icon={<AlertTriangle />} tone="danger" />
    </section>
    <div className="overview-grid">
      <section className="panel chart-panel">
        <div className="panel-heading"><div><span>Historical activity</span><h2>Reservations by year</h2></div><small>Imported schedule records</small></div>
        <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={yearData} margin={{ top: 10, right: 8, left: -24, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dbe4e8" /><XAxis dataKey="year" tick={{ fontSize: 11 }} interval={2} /><YAxis tick={{ fontSize: 11 }} /><Tooltip cursor={{ fill: "#edf5f6" }} /><Bar dataKey="bookings" fill="#087f8c" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
      </section>
      <section className="panel attention-panel">
        <div className="panel-heading"><div><span>Needs attention</span><h2>Schedule integrity</h2></div><button className="text-button" onClick={() => onNavigate("health")}>View all</button></div>
        {operationalIssues.slice(0, 5).map((issue) => <IssueRow key={issue.id} issue={issue} />)}
        <div className="integrity-summary"><span><i className="red" />{report.issueCounts.BERTH_CONFLICT ?? 0} conflicts</span><span><i className="amber" />{report.issueCounts.VESSEL_TOO_LONG ?? 0} capacity violations</span></div>
      </section>
    </div>
    <section className="panel recent-panel">
      <div className="panel-heading"><div><span>Latest source year</span><h2>2019 schedule records</h2></div><button className="text-button" onClick={() => onNavigate("reservations")}>Search history</button></div>
      <div className="compact-table">
        {recent.map((item) => <button key={item.id} onClick={() => onOpen(item)}><span className={`type-icon ${item.type}`}><Ship size={15} /></span><strong>{item.title}</strong><span>{berths.find((berth) => berth.id === item.berthId)?.name}</span><span>{format(parseISO(item.startDate), "MMM d, yyyy")}</span><ChevronRight size={16} /></button>)}
      </div>
    </section>
  </>;
}

function Metric({ label, value, note, icon, tone }: { label: string; value: string; note: string; icon: React.ReactNode; tone?: string }) {
  return <article className={`metric ${tone ?? ""}`}><div className="metric-icon">{icon}</div><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}

function Schedule({ month, setMonth, onOpen, onNew }: { month: string; setMonth: (month: string) => void; onOpen: (reservation: Reservation) => void; onNew: () => void }) {
  const { reservations, berths } = useReservations();
  const [issuesOnly, setIssuesOnly] = useState(false);
  const start = startOfMonth(parseISO(`${month}-01`));
  const end = endOfMonth(start);
  const days = eachDayOfInterval({ start, end });
  const visible = reservations.filter((item) => item.startDate <= format(end, "yyyy-MM-dd") && item.endDate >= format(start, "yyyy-MM-dd"));
  const issueIds = new Set(useReservations().importedIssues.flatMap((issue) => issue.reservationIds ?? []));
  const setOffset = (offset: number) => setMonth(format(addMonths(start, offset), "yyyy-MM"));
  return <>
    <PageTitle eyebrow="Berth schedule" title={format(start, "MMMM yyyy")}><div className="title-actions"><button className="icon-button" onClick={() => setOffset(-1)} aria-label="Previous month"><ChevronLeft /></button><input className="month-picker" type="month" value={month} min="1997-01" max="2028-12" onChange={(event) => setMonth(event.target.value)} /><button className="icon-button" onClick={() => setOffset(1)} aria-label="Next month"><ChevronRight /></button><button className="primary-button" onClick={onNew}><Plus size={17} /> Reserve berth</button></div></PageTitle>
    <div className="schedule-toolbar"><div><span className="legend vessel" />Vessel<span className="legend event" />Event<span className="legend closure" />Closure</div><label className="toggle"><input type="checkbox" checked={issuesOnly} onChange={(event) => setIssuesOnly(event.target.checked)} /><span />Issues only</label></div>
    <section className="schedule-frame" aria-label={`${format(start, "MMMM yyyy")} berth schedule`}>
      <div className="timeline" style={{ "--days": days.length } as React.CSSProperties}>
        <div className="timeline-corner"><span>Berth</span><small>Maximum length</small></div>
        <div className="timeline-days">{days.map((day) => <div key={day.toISOString()} className={[0, 6].includes(day.getDay()) ? "weekend" : ""}><span>{format(day, "EEE")}</span><strong>{format(day, "d")}</strong></div>)}</div>
        {berths.map((berth) => {
          const items = visible.filter((item) => item.berthId === berth.id && (!issuesOnly || issueIds.has(item.id)));
          return <div className="berth-line" key={berth.id}>
            <div className="berth-label"><strong>{berth.name}</strong><small>{berth.maxVesselLengthFt ? `Up to ${berth.maxVesselLengthFt} ft` : "Capacity not specified"}</small></div>
            <div className="berth-days">{days.map((day) => <div key={day.toISOString()} className={[0, 6].includes(day.getDay()) ? "weekend" : ""} />)}{items.map((item) => {
              const itemStart = parseISO(item.startDate) < start ? start : parseISO(item.startDate);
              const itemEnd = parseISO(item.endDate) > end ? end : parseISO(item.endDate);
              const left = Math.round((daysInclusive(format(start, "yyyy-MM-dd"), format(itemStart, "yyyy-MM-dd")) - 1) / days.length * 10000) / 100;
              const width = Math.max(3.2, Math.round(daysInclusive(format(itemStart, "yyyy-MM-dd"), format(itemEnd, "yyyy-MM-dd")) / days.length * 10000) / 100);
              return <button key={item.id} className={`reservation-block ${issueIds.has(item.id) ? "has-issue" : ""} ${item.importConfidence === "low" ? "low-confidence" : ""}`} style={{ left: `${left}%`, width: `${width}%`, background: berthColor(item.type) }} onClick={() => onOpen(item)} title={`${item.title}: ${item.startDate} to ${item.endDate}`}><span>{item.title}</span>{issueIds.has(item.id) && <AlertTriangle size={13} />}</button>;
            })}</div>
          </div>;
        })}
      </div>
      {visible.length === 0 && <div className="empty-state"><CalendarDays /><strong>No reservations in this month</strong><span>Move to a historical month or create a new reservation.</span></div>}
    </section>
  </>;
}

function ReservationsPage({ onOpen }: { onOpen: (reservation: Reservation) => void }) {
  const { reservations, berths } = useReservations();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [year, setYear] = useState("all");
  const filtered = reservations.filter((item) => (type === "all" || item.type === type) && (year === "all" || item.startDate.startsWith(year)) && `${item.title} ${berths.find((berth) => berth.id === item.berthId)?.name}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => b.startDate.localeCompare(a.startDate));
  return <>
    <PageTitle eyebrow="Historical record" title="Reservations"><span className="record-count">{filtered.length.toLocaleString()} records</span></PageTitle>
    <div className="filter-bar"><label><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search reservations" /></label><select value={type} onChange={(event) => setType(event.target.value)} aria-label="Reservation type"><option value="all">All types</option><option value="vessel">Vessels</option><option value="event">Events</option><option value="closure">Closures</option></select><select value={year} onChange={(event) => setYear(event.target.value)} aria-label="Year"><option value="all">All years</option>{Array.from({ length: 23 }, (_, index) => 2019 - index).map((item) => <option key={item}>{item}</option>)}</select></div>
    <div className="table-panel"><table><thead><tr><th>Reservation</th><th>Type</th><th>Berth</th><th>Dates</th><th>Source</th><th /></tr></thead><tbody>{filtered.slice(0, 250).map((item) => <tr key={item.id} onClick={() => onOpen(item)}><td><strong>{item.title}</strong>{item.importConfidence === "low" && <small>Low import confidence</small>}</td><td><span className={`type-pill ${item.type}`}>{item.type}</span></td><td>{berths.find((berth) => berth.id === item.berthId)?.name}</td><td>{format(parseISO(item.startDate), "MMM d, yyyy")}{item.endDate !== item.startDate && <> – {format(parseISO(item.endDate), "MMM d, yyyy")}</>}</td><td>{item.origin === "imported" ? `${item.source?.sheet}!${item.source?.range ?? item.source?.cell}` : "Created in Dock Manager"}</td><td><ChevronRight size={16} /></td></tr>)}</tbody></table>{filtered.length > 250 && <div className="table-foot">Showing the first 250 matching records. Narrow the filters to see a specific visit.</div>}</div>
  </>;
}

function DataHealth({ onView }: { onView: (reservation: Reservation) => void }) {
  const { importedIssues, reservations, report, reset } = useReservations();
  const [category, setCategory] = useState("all");
  const [confidence, setConfidence] = useState("all");
  const filtered = importedIssues.filter((issue) => (category === "all" || issue.category === category) && (confidence === "all" || issue.confidence === confidence));
  const grouped = Object.entries(report.issueCounts).map(([type, count]) => ({ type, count }));
  return <>
    <PageTitle eyebrow="Source validation" title="Data health"><div className="title-actions"><div className="coverage-chip"><Check size={15} />23 annual sheets analyzed</div><button className="secondary-button" onClick={() => { if (window.confirm("Reset all local changes and restore the imported workbook data?")) reset(); }}><RotateCcw size={15} /> Reset demo data</button></div></PageTitle>
    <section className="health-summary panel"><div><span>Schedule integrity</span><strong>{(report.issueCounts.BERTH_CONFLICT ?? 0) + (report.issueCounts.VESSEL_TOO_LONG ?? 0)}</strong><small>conflicts and capacity violations</small></div><div><span>Migration & reference data</span><strong>{importedIssues.filter((issue) => issue.category === "import" || issue.category === "reference-data").length}</strong><small>items that need source review</small></div><div><span>High-confidence records</span><strong>{Math.round(report.confidenceCounts.high / report.reservationCount * 100)}%</strong><small>{report.confidenceCounts.high.toLocaleString()} imported bookings</small></div></section>
    <div className="health-layout">
      <section className="panel issue-groups"><div className="panel-heading"><div><span>Issue totals</span><h2>Validation results</h2></div></div>{grouped.map((item) => <div className="issue-total" key={item.type}><span className={item.type === "BERTH_CONFLICT" || item.type === "VESSEL_TOO_LONG" ? "critical" : "review"}><AlertTriangle size={16} /></span><div><strong>{issueLabel[item.type] ?? item.type}</strong><small>{item.type === "BERTH_CONFLICT" || item.type === "VESSEL_TOO_LONG" ? "Schedule integrity" : "Migration & reference data"}</small></div><b>{item.count}</b></div>)}</section>
      <section className="panel issue-list"><div className="panel-heading"><div><span>Review queue</span><h2>{filtered.length.toLocaleString()} findings</h2></div><SlidersHorizontal size={18} /></div><div className="inline-filters"><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option><option value="schedule">Schedule</option><option value="capacity">Capacity</option><option value="import">Import</option><option value="reference-data">Reference data</option></select><select value={confidence} onChange={(event) => setConfidence(event.target.value)}><option value="all">All confidence</option><option value="high">High confidence</option><option value="medium">Medium confidence</option><option value="low">Low confidence</option></select></div><div className="scroll-issues">{filtered.slice(0, 100).map((issue) => <button key={issue.id} onClick={() => { const item = reservations.find((reservation) => issue.reservationIds?.includes(reservation.id)); if (item) onView(item); }}><span className={`severity ${issue.severity}`}><AlertTriangle size={15} /></span><div><strong>{issueLabel[issue.type] ?? issue.type}</strong><p>{issue.message}</p><small>{issue.year ?? "Reference data"}{issue.sourceReferences?.[0] ? ` · ${issue.sourceReferences[0].sheet}!${issue.sourceReferences[0].range ?? issue.sourceReferences[0].cell}` : ""}</small></div><ChevronRight size={16} /></button>)}</div></section>
    </div>
  </>;
}

function IssueRow({ issue }: { issue: ValidationIssue }) {
  return <div className="issue-row"><span className={`severity ${issue.severity}`}><AlertTriangle size={15} /></span><div><strong>{issueLabel[issue.type] ?? issue.type}</strong><small>{issue.message}</small></div><span>{issue.year}</span></div>;
}

function ReservationDrawer({ reservation, onClose, onEdit }: { reservation: Reservation; onClose: () => void; onEdit: () => void }) {
  const { berths, vessels, importedIssues, deleteReservation } = useReservations();
  const berth = berths.find((item) => item.id === reservation.berthId);
  const vessel = vessels.find((item) => item.id === reservation.vesselId);
  const issues = importedIssues.filter((issue) => issue.reservationIds?.includes(reservation.id));
  return <div className="overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><aside className="drawer" aria-label="Reservation details"><div className="drawer-header"><div><span className={`type-pill ${reservation.type}`}>{reservation.type}</span><h2>{reservation.title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X /></button></div><div className="drawer-body">
    {issues.map((issue) => <div className="warning-card" key={issue.id}><AlertTriangle /><div><strong>{issueLabel[issue.type]}</strong><span>{issue.message}</span></div></div>)}
    <dl className="detail-list"><div><dt>Berth</dt><dd>{berth?.name}<small>{berth?.maxVesselLengthFt ? `${berth.maxVesselLengthFt} ft maximum vessel length` : "Capacity not specified in source schedule"}</small></dd></div><div><dt>Dates</dt><dd>{format(parseISO(reservation.startDate), "MMMM d, yyyy")}{reservation.endDate !== reservation.startDate && <> – {format(parseISO(reservation.endDate), "MMMM d, yyyy")}</>}<small>{daysInclusive(reservation.startDate, reservation.endDate)} calendar {daysInclusive(reservation.startDate, reservation.endDate) === 1 ? "day" : "days"}</small></dd></div>{vessel && <div><dt>Vessel</dt><dd>{vessel.name}<small>{vessel.lengthFt ? `${vessel.lengthFt} ft length overall` : "Length unknown"}{vessel.operator ? ` · ${vessel.operator}` : ""}</small></dd></div>}<div><dt>Status</dt><dd>Confirmed<small>{reservation.origin === "imported" ? "Historical imported record" : "Created in Dock Manager"}</small></dd></div></dl>
    <section className="source-card"><div><Database size={17} /><strong>Source data</strong></div>{reservation.origin === "imported" ? <><p>Imported from {reservation.source?.sheet} dock schedule</p><code>{reservation.source?.sheet}!{reservation.source?.range ?? reservation.source?.cell}</code><small>Original value: {reservation.source?.rawValue}<br />Import confidence: {reservation.importConfidence}</small></> : <p>Created in Dock Manager and stored in this browser.</p>}</section>
  </div><div className="drawer-actions"><button className="secondary-button" onClick={onEdit}>Edit reservation</button><button className="danger-button" onClick={() => { if (window.confirm("Delete this reservation from local demo data?")) { deleteReservation(reservation.id); onClose(); } }}>Delete</button></div></aside></div>;
}

function ReservationDialog({ reservation, onClose }: { reservation?: Reservation; onClose: () => void }) {
  const { reservations, berths, vessels, saveReservation } = useReservations();
  const [type, setType] = useState<ReservationType>(reservation?.type ?? "vessel");
  const [title, setTitle] = useState(reservation?.title ?? "");
  const [vesselId, setVesselId] = useState(reservation?.vesselId ?? "");
  const [vesselSearch, setVesselSearch] = useState(() => vessels.find((item) => item.id === reservation?.vesselId)?.name ?? "");
  const [berthId, setBerthId] = useState(reservation?.berthId ?? "");
  const [startDate, setStartDate] = useState(reservation?.startDate ?? "2019-01-01");
  const [endDate, setEndDate] = useState(reservation?.endDate ?? "2019-01-01");
  const [error, setError] = useState("");
  const vessel = vessels.find((item) => item.id === vesselId);
  const visibleVessels = useMemo(() => {
    const term = vesselSearch.trim().toLowerCase();
    const matches = vessels.filter((item) => !term || item.name.toLowerCase().includes(term)).slice(0, 80);
    const selectedVessel = vessels.find((item) => item.id === vesselId);
    return selectedVessel && !matches.some((item) => item.id === selectedVessel.id) ? [selectedVessel, ...matches] : matches;
  }, [vesselId, vesselSearch, vessels]);
  const recommendations = startDate && endDate && startDate <= endDate ? recommendBerths(berths, reservations, vessel, startDate, endDate, reservation?.id) : [];
  const selectedAssessment = recommendations.find((item) => item.berth.id === berthId);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!title.trim() || !berthId || !startDate || !endDate) return setError("Complete the title, berth, and date range.");
    if (startDate > endDate) return setError("End date must be on or after start date.");
    const selectedBerth = berths.find((item) => item.id === berthId)!;
    const conflicts = findConflicts(reservations, { id: reservation?.id, berthId, startDate, endDate });
    if (conflicts.length) return setError(`${selectedBerth.name} is occupied by ${conflicts[0].title} during this date range.`);
    if (type === "vessel" && vesselFitsBerth(vessel, selectedBerth) === false) return setError(`${vessel?.name} is too long for ${selectedBerth.name}.`);
    saveReservation({ id: reservation?.id ?? `created-${crypto.randomUUID()}`, type, title: type === "vessel" && vessel ? vessel.name : title.trim(), vesselId: type === "vessel" ? vesselId : undefined, berthId, startDate, endDate, origin: reservation?.origin ?? "created", source: reservation?.source, importConfidence: reservation?.importConfidence, modifiedSinceImport: reservation?.origin === "imported", status: "confirmed" });
    onClose();
  };
  return <div className="overlay dialog-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="reservation-title"><div className="dialog-header"><div><span>{reservation ? "Update booking" : "New booking"}</span><h2 id="reservation-title">{reservation ? "Edit reservation" : "Reserve a berth"}</h2></div><button className="icon-button" onClick={onClose}><X /></button></div><form onSubmit={submit}><div className="segmented">{(["vessel", "event", "closure"] as ReservationType[]).map((item) => <button type="button" key={item} className={type === item ? "active" : ""} onClick={() => setType(item)}>{item === "vessel" ? <Ship size={16} /> : item === "event" ? <CalendarDays size={16} /> : <AlertTriangle size={16} />}{item}</button>)}</div>
    {type === "vessel" ? <div className="vessel-picker"><label htmlFor="vessel-search">Find vessel</label><div className="picker-search"><Search size={16} /><input id="vessel-search" value={vesselSearch} onChange={(event) => setVesselSearch(event.target.value)} placeholder="Search by vessel name" /></div><label htmlFor="vessel-select">Vessel</label><select id="vessel-select" value={vesselId} onChange={(event) => { const id = event.target.value; setVesselId(id); const chosen = vessels.find((item) => item.id === id); setTitle(chosen?.name ?? ""); if (chosen) setVesselSearch(chosen.name); }} required><option value="">Select from {visibleVessels.length} matches</option>{visibleVessels.map((item) => <option key={item.id} value={item.id}>{item.name}{item.lengthFt ? ` · ${item.lengthFt} ft` : " · length unknown"}</option>)}</select></div> : <label>{type === "event" ? "Event" : "Closure"} name<input value={title} onChange={(event) => setTitle(event.target.value)} required /></label>}
    <div className="form-row"><label>Start date<input type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); if (endDate < event.target.value) setEndDate(event.target.value); }} required /></label><label>End date<input type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} required /></label></div>
    <label>Berth<select value={berthId} onChange={(event) => setBerthId(event.target.value)} required><option value="">Select a berth</option>{recommendations.sort((a, b) => Number(b.recommended) - Number(a.recommended)).map((item) => <option key={item.berth.id} value={item.berth.id} disabled={!item.available || item.fits === false}>{item.recommended ? "Recommended · " : ""}{item.berth.name} · {!item.available ? "occupied" : item.fits === false ? "too short" : item.berth.maxVesselLengthFt ? `${item.berth.maxVesselLengthFt} ft` : "capacity unknown"}</option>)}</select></label>
    {berthId && selectedAssessment && <div className={`assessment ${selectedAssessment.available && selectedAssessment.fits !== false ? "good" : "bad"}`}>{selectedAssessment.available && selectedAssessment.fits !== false ? <Check /> : <AlertTriangle />}<div><strong>{selectedAssessment.available ? selectedAssessment.fits === false ? "Vessel does not fit" : "Available for these dates" : "Berth is occupied"}</strong><span>{selectedAssessment.recommended ? "Best-fit available berth for this vessel." : selectedAssessment.spareFeet != null ? `${selectedAssessment.spareFeet} ft of clearance.` : "Capacity cannot be verified from source data."}</span></div></div>}
    {error && <div className="form-error"><AlertTriangle size={17} />{error}</div>}
    <div className="dialog-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit">{reservation ? "Save changes" : "Create reservation"}</button></div></form></section></div>;
}

export default App;
