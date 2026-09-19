# WHOI Dock Manager --- Implementation Specification

## 1. Product Vision

Build a polished, production-minded waterfront operations application
for managing WHOI berth reservations across vessels and non-vessel
events.

The application should replace a manual scheduling grid with a system
that:

1.  Makes the waterfront schedule easy to understand at a glance.
2.  Prevents berth double-bookings.
3.  Verifies that vessels physically fit their assigned berths.
4.  Recommends the best available berth for a vessel and date range.
5.  Makes 23 years of historical reservation data searchable and useful.
6.  Automatically identifies problems in historical scheduling data.
7.  Supports both vessel reservations and non-vessel waterfront events.
8.  Provides multiple useful views of the same scheduling data.
9.  Persists changes without requiring a paid backend.
10. Demonstrates an architecture that could cleanly evolve into a
    production system.

The central product story is:

> **23 years of scheduling data → one reliable operational source of
> truth → conflicts become impossible to miss → assigning the right
> berth becomes easy.**

The application should feel like internal institutional operations
software rather than a generic CRUD demo.

------------------------------------------------------------------------

## 2. Product Name and Positioning

**WHOI Dock Manager**\
*Waterfront scheduling & berth management*

Use understated institutional branding. The interface should feel
appropriate for a marine research organization: clean, practical,
information-dense without being cluttered, and optimized for staff using
desktop or laptop computers.

------------------------------------------------------------------------

## 3. Technical Stack

Use:

-   **React**
-   **TypeScript**
-   **Vite**
-   **Tailwind CSS**
-   **shadcn/ui**
-   **Lucide React** for icons
-   **date-fns** for date manipulation
-   **Recharts** for any analytics visualizations
-   **Vitest** for business-logic tests
-   **React Context + custom hooks** for application state
-   **Static JSON** for the normalized initial dataset
-   **localStorage** for prototype persistence
-   **GitHub Actions + GitHub Pages** for deployment

Avoid adding infrastructure that does not materially improve the
prototype. The application should not require authentication, Firebase,
Supabase, a custom server, a paid database, or any external paid
service.

------------------------------------------------------------------------

## 4. High-Level Architecture

``` text
Provided historical schedule
          │
          ▼
   Import / normalization
          │
          ▼
  Static normalized JSON
          │
          ▼
┌─────────────────────────────┐
│      Domain Logic           │
│                             │
│  conflict detection         │
│  capacity validation        │
│  berth recommendation       │
│  dataset validation         │
│  date utilities             │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│     Repository Layer        │
│                             │
│ static seed + localStorage  │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│      Application State      │
│                             │
│ Context + custom hooks      │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│          React UI           │
│                             │
│ Schedule                    │
│ Dashboard                   │
│ Reservations                │
│ Data Health                 │
│ Drawers / forms / search    │
└─────────────────────────────┘
```

The key architectural principle is that **scheduling rules should not
live inside UI components**. Conflict detection, berth-fit validation,
recommendations, and dataset validation should be implemented as
reusable pure domain functions.

------------------------------------------------------------------------

## 5. Project Structure

``` text
whoi-dock-manager/
│
├── public/
│
├── scripts/
│   └── parseSchedule.ts
│
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Header.tsx
│   │   │
│   │   ├── schedule/
│   │   │   ├── ScheduleTimeline.tsx
│   │   │   ├── TimelineHeader.tsx
│   │   │   ├── TimelineGrid.tsx
│   │   │   ├── BerthRow.tsx
│   │   │   ├── ReservationBlock.tsx
│   │   │   ├── ScheduleControls.tsx
│   │   │   ├── TodayIndicator.tsx
│   │   │   └── IssueNavigator.tsx
│   │   │
│   │   ├── reservations/
│   │   │   ├── ReservationDrawer.tsx
│   │   │   ├── ReservationForm.tsx
│   │   │   ├── ReservationDetails.tsx
│   │   │   ├── BerthRecommendation.tsx
│   │   │   ├── ConflictWarning.tsx
│   │   │   ├── CapacityWarning.tsx
│   │   │   └── DeleteReservationDialog.tsx
│   │   │
│   │   ├── dashboard/
│   │   │   ├── MetricCard.tsx
│   │   │   ├── UpcomingArrivals.tsx
│   │   │   ├── ActiveReservations.tsx
│   │   │   └── AttentionNeeded.tsx
│   │   │
│   │   ├── data-health/
│   │   │   ├── DataHealthSummary.tsx
│   │   │   ├── IssueList.tsx
│   │   │   ├── IssueCard.tsx
│   │   │   └── IssueFilters.tsx
│   │   │
│   │   ├── search/
│   │   │   └── CommandSearch.tsx
│   │   │
│   │   └── ui/
│   │
│   ├── pages/
│   │   ├── SchedulePage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── ReservationsPage.tsx
│   │   └── DataHealthPage.tsx
│   │
│   ├── data/
│   │   ├── berths.json
│   │   ├── vessels.json
│   │   └── reservations.json
│   │
│   ├── lib/
│   │   ├── conflicts.ts
│   │   ├── berthAssignment.ts
│   │   ├── validation.ts
│   │   ├── dates.ts
│   │   ├── timeline.ts
│   │   └── storage.ts
│   │
│   ├── repositories/
│   │   ├── ReservationRepository.ts
│   │   └── LocalStorageReservationRepository.ts
│   │
│   ├── hooks/
│   │   ├── useReservations.ts
│   │   ├── useSchedule.ts
│   │   └── useDataHealth.ts
│   │
│   ├── context/
│   │   └── ReservationProvider.tsx
│   │
│   ├── types/
│   │   └── index.ts
│   │
│   ├── App.tsx
│   └── main.tsx
│
├── tests/
│   ├── conflicts.test.ts
│   ├── berthAssignment.test.ts
│   └── validation.test.ts
│
├── README.md
├── vite.config.ts
└── package.json
```

------------------------------------------------------------------------

## 6. Core Domain Model

### Berth

``` ts
export interface Berth {
  id: string;
  name: string;
  maxVesselLengthFt: number | null;
  notes?: string;
}
```

Each berth is a physical resource with a maximum supported vessel
length.

### Vessel

``` ts
export interface Vessel {
  id: string;
  name: string;
  lengthFt: number;
  type?: string;
}
```

Vessel dimensions should exist independently from reservations so the
same vessel can appear in many historical bookings without duplicating
vessel metadata.

### Reservation

``` ts
export type ReservationType = "vessel" | "event" | "closure";

export interface Reservation {
  id: string;

  type: ReservationType;

  title: string;
  vesselId?: string;

  berthId: string;

  startDate: string;
  endDate: string;

  notes?: string;
}
```

For a vessel reservation:

``` text
type = "vessel"
title = "R/V Atlantis"
vesselId = "atlantis"
```

For a non-vessel event:

``` text
type = "event"
title = "Community Sail Day"
vesselId = undefined
```

This allows vessel reservations and events to share the same scheduling
and conflict-detection system while applying vessel-specific capacity
validation only where appropriate.

### Validation Issue

``` ts
export type ValidationIssueType =
  | "BERTH_CONFLICT"
  | "VESSEL_TOO_LONG"
  | "MISSING_DATA";

export interface ValidationIssue {
  id: string;
  type: ValidationIssueType;
  severity: "warning" | "error";
  reservationId: string;
  relatedReservationId?: string;
  message: string;
}
```

------------------------------------------------------------------------

## 7. Domain Logic

Create reusable pure functions for all scheduling rules.

``` ts
datesOverlap(...)
findConflicts(...)
vesselFitsBerth(...)
isBerthAvailable(...)
getCompatibleBerths(...)
recommendBerth(...)
validateReservation(...)
validateDataset(...)
```

### Date Overlap

Explicitly define reservation date semantics.

For the prototype, assume that a reservation occupies a berth **through
its end date**. Therefore:

``` text
Reservation A: Sep 18 → Sep 20
Reservation B: Sep 20 → Sep 23
```

is considered a conflict.

Example:

``` ts
export function datesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}
```

Document this assumption clearly because the source prompt does not
define arrival/departure-day semantics.

### Conflict Detection

Two reservations conflict when:

1.  They use the same berth.
2.  Their date ranges overlap.
3.  They are not the same reservation being edited.

``` ts
export function findConflicts(
  candidate: Reservation,
  reservations: Reservation[]
): Reservation[] {
  return reservations.filter(
    existing =>
      existing.berthId === candidate.berthId &&
      existing.id !== candidate.id &&
      datesOverlap(
        new Date(candidate.startDate),
        new Date(candidate.endDate),
        new Date(existing.startDate),
        new Date(existing.endDate)
      )
  );
}
```

### Vessel Fit

``` ts
export function vesselFitsBerth(
  vessel: Vessel,
  berth: Berth
): boolean {
  return vessel.lengthFt <= berth.maxVesselLengthFt;
}
```

Events do not require vessel-length validation, but they still occupy
the berth and participate in conflict detection.

### Berth Recommendation

The recommendation strategy should be **best fit**:

1.  Start with all berths.
2.  Remove berths too short for the vessel.
3.  Remove berths occupied during the selected dates.
4.  Sort remaining berths from shortest to longest.
5.  Recommend the smallest available berth that fits.

This preserves larger berths for vessels that may actually require them.

``` ts
export function getCompatibleBerths(
  vessel: Vessel,
  startDate: string,
  endDate: string,
  berths: Berth[],
  reservations: Reservation[]
): Berth[] {
  return berths
    .filter(berth => vesselFitsBerth(vessel, berth))
    .filter(berth =>
      isBerthAvailable(
        berth.id,
        startDate,
        endDate,
        reservations
      )
    )
    .sort(
      (a, b) =>
        a.maxVesselLengthFt - b.maxVesselLengthFt
    );
}
```

The first result becomes the recommended berth.

------------------------------------------------------------------------

## 8. Persistence Architecture

The prototype should use local storage but hide persistence behind a
repository abstraction.

``` ts
export interface ReservationRepository {
  getAll(): Reservation[];
  create(reservation: Reservation): void;
  update(reservation: Reservation): void;
  delete(id: string): void;
  reset(): void;
}
```

Implement:

``` text
LocalStorageReservationRepository
```

React components should never directly call `localStorage.setItem()`.

On first load:

1.  Check whether local reservation data exists.
2.  If not, seed local storage from the normalized static JSON dataset.
3.  Read subsequent mutations from local storage.
4.  Provide a reset-to-original-data action if useful.

This architecture makes it possible to replace browser persistence with
an API-backed repository later without rewriting the scheduling UI or
domain logic.

------------------------------------------------------------------------

## 9. Application State

Use a `ReservationProvider` and custom hooks rather than Redux.

Example API:

``` ts
const {
  reservations,
  createReservation,
  updateReservation,
  deleteReservation,
  resetReservations
} = useReservations();
```

Derived state should generally be computed rather than stored
separately:

-   active reservations
-   upcoming reservations
-   conflicts
-   capacity violations
-   available berths
-   filtered reservations
-   recommended berth

------------------------------------------------------------------------

## 10. Application Shell

Use a desktop-first operations layout.

``` text
┌───────────────────────────────────────────────────────────────┐
│ WHOI Dock Manager                         Search        User  │
├──────────────┬────────────────────────────────────────────────┤
│              │                                                │
│ Overview     │                                                │
│              │                                                │
│ Schedule     │                 PAGE                           │
│              │                                                │
│ Reservations│                                                │
│              │                                                │
│ Data Health │                                                │
│              │                                                │
│              │                                                │
└──────────────┴────────────────────────────────────────────────┘
```

### Sidebar

Include:

-   Overview
-   Schedule
-   Reservations
-   Data Health

Use Lucide icons consistently.

### Header

Include:

-   Current page title where appropriate
-   Global search trigger
-   Keyboard shortcut hint for search
-   Minimal identity/avatar placeholder if desired

### Visual Style

Use:

-   white/slate surfaces
-   subtle borders
-   restrained shadows
-   generous but efficient spacing
-   clear hierarchy
-   accessible status badges
-   minimal animation
-   institutional rather than startup-like styling

------------------------------------------------------------------------

# 11. Schedule Page

The **Schedule** page should be the primary/default application view.

Header:

``` text
Waterfront Schedule

Manage vessel arrivals, events, and berth availability.

[ Today ]   ‹   September 2026   ›        [ + New Reservation ]
```

Below it, render a berth-by-date timeline.

``` text
                 SEP 18   SEP 19   SEP 20   SEP 21   SEP 22

Pier 1 · 300 ft  ┌─────────────────────────────┐
                 │ R/V Atlantis · 274 ft       │
                 └─────────────────────────────┘

Pier 2 · 180 ft             ┌──────────────────┐
                            │ R/V Tioga         │
                            └──────────────────┘

Pier 3 · 120 ft                      ┌──────────┐
                                     │ Sail Day │
                                     └──────────┘
```

## Schedule Controls

Include:

-   Today button
-   Previous period
-   Next period
-   Current month/date-range label
-   Date picker / jump-to-date control
-   Week / Month or comparable timeline-range controls
-   Search/filter controls where useful
-   `+ New Reservation`

The timeline should support navigating through the historical dataset,
not only current reservations.

## Timeline Header

Render calendar dates as aligned columns.

Useful details:

-   day of week
-   date number
-   month boundary labels
-   weekend distinction if helpful
-   current day indication

## Berth Rows

Each berth row should show:

``` text
Pier 2
Max 180 ft
```

This makes berth capacity a first-class part of the schedule instead of
hidden metadata.

## Reservation Blocks

Vessel blocks should display enough information to be useful without
opening them:

``` text
R/V Atlantis
274 ft
```

Event blocks should clearly distinguish themselves as non-vessel
reservations.

Use color/status differences carefully, but never make color the only
way to understand reservation type or validity.

## Today Indicator

When the current date is visible, show a subtle vertical line through
the timeline.

## Horizontal Navigation

The timeline should allow the user to move backward and forward through
time and jump directly to a historical date.

------------------------------------------------------------------------

# 12. Reservation Details Drawer

Clicking a reservation should open a right-side drawer rather than
navigating away.

Example:

``` text
┌─────────────────────────────┐
│ R/V Atlantis            ×  │
│                             │
│ VESSEL                      │
│ R/V Atlantis                │
│                             │
│ BERTH                       │
│ Pier 1                      │
│                             │
│ DATES                       │
│ Sep 18 → Sep 22             │
│                             │
│ VESSEL LENGTH               │
│ 274 ft                      │
│                             │
│ BERTH CAPACITY              │
│ 300 ft                      │
│                             │
│ ✓ Valid assignment          │
│                             │
│ Notes                       │
│ ...                         │
│                             │
│ [ Edit ]        [ Delete ]  │
└─────────────────────────────┘
```

For events, replace vessel-specific information with event information.

The drawer should surface validation status:

``` text
✓ Valid assignment
```

or:

``` text
⚠ Vessel exceeds berth capacity
```

or:

``` text
⚠ Scheduling conflict
```

Include:

-   Edit
-   Delete
-   Close
-   contextual validation information

Deleting should require a confirmation dialog.

------------------------------------------------------------------------

# 13. New Reservation Workflow

Clicking `+ New Reservation` should open a drawer or modal.

## Reservation Type

Start with:

``` text
Reservation type

[ Vessel ]    [ Event ]
```

### Vessel Reservation

Fields:

-   Vessel
-   Arrival date
-   Departure date
-   Berth
-   Notes

The vessel field should be searchable.

Selecting a vessel should immediately display its known length.

``` text
R/V Atlantis
274 ft
```

Once the user has selected the vessel and dates, calculate berth
compatibility automatically.

### Waterfront Event

Fields:

-   Event name
-   Start date
-   End date
-   Berth
-   Notes

Events skip vessel-length validation but still require berth
availability validation.

------------------------------------------------------------------------

# 14. Smart Berth Selection

The berth selector should not be a plain dropdown.

Once enough information exists to evaluate compatibility, show berth
options grouped by availability.

Example:

``` text
Berth

Recommended

✓ Pier 1                              Best fit
  300 ft · Available

Available

  Pier 4
  450 ft · Available

Unavailable

× Pier 2
  Vessel exceeds capacity by 94 ft

× Pier 3
  Occupied Sep 21–25
```

The system should automatically identify the best-fit berth.

Unavailable berths should remain visible so the user understands **why**
they cannot be selected.

For each berth, communicate:

-   berth name
-   capacity
-   availability
-   reason unavailable
-   whether it is recommended

This transforms the system from a passive reservation form into a
decision-support tool.

------------------------------------------------------------------------

# 15. Validation UX

Never show generic errors such as:

``` text
Invalid reservation.
```

Explain the actual operational problem.

## Conflict Example

``` text
⚠ Scheduling conflict

Pier 2 is occupied by R/V Tioga
from Sep 19–22.

Choose another berth or adjust the dates.
```

## Capacity Example

``` text
⚠ Vessel does not fit

R/V Atlantis is 274 ft.
Pier 2 supports vessels up to 180 ft.

94 ft over capacity.
```

## Invalid Date Example

``` text
⚠ Invalid date range

Departure cannot occur before arrival.
```

Validation should run before saving and, where useful, reactively while
the user completes the form.

------------------------------------------------------------------------

# 16. Edit Reservation Workflow

Editing should reuse the same form and validation logic as creation.

When an existing reservation is edited:

-   ignore itself during conflict detection
-   recompute compatible berths if vessel or dates change
-   recompute validation immediately
-   update the timeline after save
-   persist the change
-   show a success toast

Example:

``` text
✓ Reservation updated
```

------------------------------------------------------------------------

# 17. Delete Reservation Workflow

Delete should require confirmation.

Example:

``` text
Delete reservation?

R/V Atlantis
Sep 18–22 · Pier 1

This will remove the reservation from the schedule.

[ Cancel ] [ Delete ]
```

After deletion:

-   update application state
-   persist the deletion
-   close the drawer
-   show confirmation feedback

------------------------------------------------------------------------

# 18. Overview Dashboard

Create an operational overview rather than a generic analytics
dashboard.

Example:

``` text
Waterfront Overview

Friday, September 18

┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│      4       │ │      2       │ │      3       │
│ Active       │ │ Arrivals     │ │ Available    │
│ reservations │ │ this week    │ │ berths       │
└──────────────┘ └──────────────┘ └──────────────┘
```

## Active Reservations

Show vessels/events currently occupying berths.

## Upcoming

Example:

``` text
Upcoming

TODAY
R/V Atlantis         Pier 1       Departs Sep 21

SEP 20
R/V Tioga            Pier 3       Arrives
```

## Needs Attention

Example:

``` text
Needs Attention

⚠ 3 scheduling conflicts
⚠ 2 reservations exceed berth capacity

Review issues →
```

Clicking an issue summary should navigate to Data Health.

## Analytics

Use Recharts sparingly for genuinely useful historical context, such as:

-   reservations over time
-   berth utilization
-   vessel vs event reservations

Operational information should remain more prominent than decorative
charts.

------------------------------------------------------------------------

# 19. Reservations Page

Provide a searchable table as a second representation of schedule data.

The timeline is optimized for spatial/temporal understanding; the table
is optimized for finding and managing individual records.

Example:

``` text
Reservations

[ Search vessel/event... ]   [ Type ▾ ] [ Berth ▾ ] [ Date ▾ ]

VESSEL / EVENT       BERTH       ARRIVAL       DEPARTURE      STATUS

R/V Atlantis         Pier 1      Sep 18        Sep 22         Active
R/V Tioga            Pier 3      Sep 24        Sep 27         Upcoming
Community Sail       Pier 2      Sep 28        Sep 28         Upcoming
```

## Search

Search by:

-   vessel name
-   event name
-   berth
-   potentially year/date

## Filters

Include:

-   reservation type
-   berth
-   date/date range
-   status where useful

## Status

Derive status from dates:

-   Active
-   Upcoming
-   Completed

If a reservation has a validation issue, show that clearly as well.

Clicking a row should open the same reusable Reservation Details Drawer
used by the timeline.

------------------------------------------------------------------------

# 20. Historical Vessel Search

Historical data should become meaningfully queryable.

Searching a vessel should expose its reservation history.

Example:

``` text
R/V Atlantis

47 reservations

2026   Sep 18–21   Pier 1
2025   Jun 03–07   Pier 2
2024   Aug 14–18   Pier 1
...
```

A user should be able to click a historical result and jump directly to
that reservation in the schedule.

------------------------------------------------------------------------

# 21. Global Command Search

Implement a `Cmd/Ctrl + K` command search.

Example:

``` text
Search waterfront...

> Atlantis

VESSELS
R/V Atlantis

RESERVATIONS
Sep 18–22, 2026          Pier 1
Jun 4–8, 2025            Pier 3
```

Search results can include:

-   vessels
-   reservations
-   events
-   berths

Selecting a reservation should open it or navigate to it in the
schedule.

Selecting a berth can navigate to the schedule and focus that berth.

Display the keyboard shortcut in the application header.

------------------------------------------------------------------------

# 22. Data Import Pipeline

Treat the provided 23-year schedule as a legacy-data migration problem
rather than manually creating demo data.

``` text
provided schedule
       │
       ▼
scripts/parseSchedule.ts
       │
       ├── normalize column names
       ├── normalize dates
       ├── identify vessels/events
       ├── map berth names to IDs
       ├── parse vessel metadata
       ├── identify missing values
       └── generate stable IDs
       │
       ▼
src/data/
  berths.json
  vessels.json
  reservations.json
```

Do not parse Excel or other source formats in the browser.

The conversion should happen once during development/build preparation.
The deployed application consumes clean JSON.

Preserve enough information to trace strange records back to the source
if necessary.

------------------------------------------------------------------------

# 23. Historical Dataset Validation

Run the same scheduling rules used during reservation creation across
the full imported dataset.

`validateDataset()` should identify:

1.  Double-booked berths.
2.  Vessels assigned to berths that are too short.
3.  Missing or malformed required information.
4.  Invalid date ranges.
5.  Any other meaningful anomaly revealed by the provided source data.

The exact validation set can be adapted once the actual spreadsheet
structure is known.

------------------------------------------------------------------------

# 24. Data Health Page

Create a dedicated page for historical schedule quality.

Example:

``` text
Historical Schedule Health

4,821
reservations analyzed

┌────────────────┬────────────────┬────────────────┐
│       41       │       17       │       7        │
│ Conflicts      │ Capacity       │ Missing data   │
│ detected       │ violations     │                │
└────────────────┴────────────────┴────────────────┘
```

The numbers should be calculated from the real imported dataset, never
hard-coded.

## Issue Filters

``` text
[ All ] [ Conflicts ] [ Capacity ] [ Missing data ]
```

## Conflict Issue

``` text
⚠ BERTH CONFLICT

R/V Atlantis
Sep 18–21 · Pier 2

overlaps with

R/V Tioga
Sep 20–23 · Pier 2

Conflict duration: 2 days

[ View in schedule → ]
```

## Capacity Issue

``` text
⚠ CAPACITY VIOLATION

R/V Example
Length: 274 ft

Pier 2
Maximum: 180 ft

94 ft over capacity

[ View in schedule → ]
```

## Missing Data Issue

Show exactly what is missing and enough source context to understand the
record.

## View in Schedule

Every issue associated with a reservation should support jumping
directly to the relevant date and berth in the timeline.

------------------------------------------------------------------------

# 25. Schedule Issues Mode

Add a mode toggle to the schedule:

``` text
[ Schedule ] [ Issues ]
```

Normal Schedule mode displays all reservations normally.

Issues mode should:

-   visually de-emphasize valid reservations
-   highlight reservations with validation problems
-   expose issue badges
-   make historical anomalies easy to scan
-   allow navigating between issues

Example issue navigator:

``` text
Issue 12 of 41                    ‹   ›

Berth 3 · June 14, 2017

R/V Atlantis
██████████████

       R/V Tioga
       █████████████

Conflict: 2 days
```

The user should be able to move to the previous/next detected issue.

This directly replaces the manual workflow of visually inspecting a
scheduling grid for double-bookings.

------------------------------------------------------------------------

# 26. Date Navigation and Historical Exploration

Because the dataset spans 23 years, date navigation must support more
than previous/next arrows.

Include a jump-to-date control:

``` text
September 2026

Jump to...
[ September 2026 ▼ ]
```

Users should be able to:

-   jump to a specific date
-   jump to a month/year
-   navigate previous/next periods
-   return to today
-   jump from search results to a historical reservation
-   jump from Data Health issues to the relevant historical date

------------------------------------------------------------------------

# 27. Timeline Implementation

A custom CSS-based timeline is sufficient and avoids unnecessary
scheduling-library complexity.

Conceptually:

``` text
Timeline viewport
│
├── fixed berth label column
│
└── scrollable date grid
      │
      ├── date columns
      ├── berth rows
      ├── reservation blocks
      └── today indicator
```

Calculate each reservation block's position from:

``` text
reservation start date relative to visible start date
```

and width from:

``` text
inclusive reservation duration × column width
```

Keep timeline positioning logic in `lib/timeline.ts`, not directly
embedded throughout JSX.

Example utilities:

``` ts
getDayOffset(...)
getReservationDuration(...)
getReservationLeft(...)
getReservationWidth(...)
```

------------------------------------------------------------------------

# 28. Responsive Behavior

The primary scheduling experience should be optimized for desktop/laptop
use.

Document the assumption:

> The primary users are waterfront staff managing schedules from desktop
> or laptop devices, so the timeline is optimized for larger screens
> while secondary views remain responsive.

Implement:

-   collapsible sidebar
-   responsive dashboard cards
-   horizontally scrollable reservation table
-   horizontally scrollable timeline
-   usable drawers on narrower screens
-   minimum practical timeline width

Do not compromise the desktop timeline simply to force it into a tiny
mobile viewport.

------------------------------------------------------------------------

# 29. Accessibility

Use semantic, accessible UI primitives.

Requirements:

-   every input has a label
-   dialogs and drawers support keyboard navigation
-   focus is managed correctly
-   buttons have meaningful accessible names
-   errors are not communicated through color alone
-   warning icons accompany warning colors
-   status text accompanies status colors
-   adequate contrast
-   interactive timeline reservations are keyboard-accessible
-   destructive actions require explicit confirmation

Example:

``` tsx
<Label htmlFor="arrival-date">
  Arrival date
</Label>
```

Use shadcn/Radix primitives where they provide accessible behavior by
default.

------------------------------------------------------------------------

# 30. Toasts and Feedback

Provide lightweight feedback after successful mutations.

Examples:

``` text
✓ Reservation created
```

``` text
✓ Reservation updated
```

``` text
✓ Reservation deleted
```

Do not use toasts as the only place errors appear. Validation errors
should remain visible in context.

------------------------------------------------------------------------

# 31. Empty States

Design intentional empty states.

Examples:

### No Search Results

``` text
No reservations found for "Atlantiss"

Try another vessel, event, berth, or date.
```

### No Issues

``` text
No scheduling issues found.

All analyzed reservations pass the current validation rules.
```

### No Reservations in Visible Period

``` text
No reservations during this period.

[ Create reservation ]
```

------------------------------------------------------------------------

# 32. Loading and Initialization

Even though the initial dataset is local, structure loading state
cleanly so the application does not flash incomplete UI while
persistence initializes.

Possible states:

``` ts
type DataState =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; error: Error };
```

If local-storage parsing fails, recover gracefully from the static seed
dataset rather than crashing the application.

------------------------------------------------------------------------

# 33. Testing

Use Vitest to test business rules rather than spending disproportionate
effort on UI snapshot tests.

Include cases such as:

``` text
✓ detects overlapping reservations on the same berth
✓ permits overlapping dates on different berths
✓ permits non-overlapping reservations on the same berth
✓ handles inclusive end-date semantics correctly
✓ ignores the reservation itself while editing
✓ rejects a vessel longer than the berth
✓ allows a vessel exactly equal to berth capacity
✓ skips vessel-length validation for events
✓ still detects event/vessel berth collisions
✓ recommends the smallest compatible berth
✓ excludes occupied berths from recommendations
✓ excludes undersized berths from recommendations
✓ returns no recommendation when no berth fits
✓ detects invalid date ranges
✓ validates the historical dataset
```

The domain logic should be easy to test because it is implemented as
pure functions.

------------------------------------------------------------------------

# 34. GitHub Pages Deployment

Deploy automatically from `main` using GitHub Actions.

Conceptually:

``` text
main
 │
 ▼
GitHub Action
 │
 ├── install
 ├── test
 ├── build
 │
 ▼
GitHub Pages
```

Make deployment part of the project from the beginning rather than
treating it as a final step.

## Routing

GitHub Pages does not provide normal SPA history fallback by default.

Use either:

``` text
/#/schedule
/#/reservations
/#/data-health
```

with hash routing, or use an application-level page state if
appropriate.

The important requirement is that refreshing any accessible application
state must not produce a GitHub Pages 404.

------------------------------------------------------------------------

# 35. README

The repository README is part of the submission and should communicate
engineering decisions clearly.

Suggested structure:

``` text
# WHOI Dock Manager

[hero screenshot]

Live Demo

## Problem

## Solution

## Features

## Architecture

## Data Model

## Scheduling Logic

### Conflict Detection
### Capacity Validation
### Berth Recommendation

## Historical Data Import

## Data Quality Analysis

## Assumptions

## Running Locally

## Testing

## Deployment

## Production Considerations

## Future Extensions
```

## Problem

Explain the original workflow concisely:

-   berth reservations span many years
-   berth lengths vary
-   vessels have physical length constraints
-   multiple reservations can accidentally overlap
-   events can occupy berths even when no vessel is involved
-   staff currently need to visually inspect a grid for errors

## Solution

Explain that the application centralizes scheduling, validates
reservations automatically, recommends compatible berths, and analyzes
historical data for existing problems.

## Architecture

Include a simple diagram showing:

``` text
Data → Domain Logic → Repository → State → UI
```

Explain why scheduling rules are separated from presentation.

## Scheduling Logic

Document:

-   date-overlap semantics
-   capacity validation
-   best-fit berth recommendation
-   event handling

## Assumptions

Explicitly document assumptions including:

-   reservation end dates are inclusive
-   berth length represents maximum supported vessel length
-   events occupy an entire assigned berth for their date range
-   a vessel can only occupy one assigned berth per reservation
-   the prototype is primarily designed for staff using desktop/laptop
    devices
-   browser-local persistence is sufficient for a static demonstration
-   source-data ambiguities are normalized consistently during import

Update these based on the actual spreadsheet.

## Production Considerations

Explicitly acknowledge what a real deployment would add:

-   authentication
-   role-based permissions
-   shared persistent database
-   server-side validation
-   audit history
-   concurrent-edit handling
-   backups
-   organizational security requirements
-   potentially notifications/integrations

Explain that these are deliberately omitted from the static prototype
rather than overlooked.

------------------------------------------------------------------------

# 36. Detailed Implementation Sequence

## Stage 1 --- Project Foundation

Create the Vite React TypeScript project.

Install and configure:

-   Tailwind
-   shadcn/ui
-   Lucide
-   date-fns
-   Recharts
-   Vitest

Create the repository and GitHub Pages deployment workflow.

Verify that a minimal application deploys successfully.

Set document title, favicon, base path, and routing strategy.

------------------------------------------------------------------------

## Stage 2 --- Domain Types

Create the core TypeScript models:

``` text
Berth
Vessel
Reservation
ValidationIssue
```

Add representative seed data.

Keep domain objects small and normalized.

------------------------------------------------------------------------

## Stage 3 --- Scheduling Engine

Implement:

``` text
datesOverlap
findConflicts
vesselFitsBerth
isBerthAvailable
getCompatibleBerths
recommendBerth
validateReservation
validateDataset
```

Add unit tests for each major rule.

This establishes the application behavior independently of the
interface.

------------------------------------------------------------------------

## Stage 4 --- Persistence Layer

Create:

``` text
ReservationRepository
LocalStorageReservationRepository
```

Implement static-data seeding.

Add create/update/delete/reset operations.

Make local-storage failures recover gracefully.

------------------------------------------------------------------------

## Stage 5 --- Application State

Create `ReservationProvider`.

Expose reservation data and mutation functions through
`useReservations()`.

Create derived hooks such as:

``` text
useSchedule
useDataHealth
```

where helpful.

------------------------------------------------------------------------

## Stage 6 --- Application Shell

Build:

``` text
AppShell
Sidebar
Header
```

Add navigation for:

``` text
Overview
Schedule
Reservations
Data Health
```

Implement the final visual system early enough that subsequent
components inherit consistent typography, spacing, buttons, cards,
badges, and forms.

------------------------------------------------------------------------

## Stage 7 --- Schedule Timeline

Build:

``` text
ScheduleTimeline
TimelineHeader
TimelineGrid
BerthRow
ReservationBlock
TodayIndicator
ScheduleControls
```

Implement:

-   visible date range
-   previous/next navigation
-   Today
-   jump to date
-   berth rows
-   capacity labels
-   reservation positioning
-   event/vessel distinction
-   current-day marker
-   horizontal scrolling
-   reservation click handling

------------------------------------------------------------------------

## Stage 8 --- Reservation Details

Build the shared Reservation Drawer.

Support:

-   vessel details
-   event details
-   berth
-   dates
-   vessel length
-   berth capacity
-   notes
-   validation status
-   Edit
-   Delete

Connect timeline blocks to the drawer.

------------------------------------------------------------------------

## Stage 9 --- Reservation Creation

Build `ReservationForm`.

Support both:

``` text
Vessel
Event
```

For vessels:

1.  Select/search vessel.
2.  Show vessel length.
3.  Select arrival.
4.  Select departure.
5.  Compute berth options.
6.  Show recommendation.
7.  Explain unavailable berths.
8.  Select berth.
9.  Validate.
10. Save.

For events:

1.  Enter event name.
2.  Select dates.
3.  Evaluate berth availability.
4.  Select berth.
5.  Validate collisions.
6.  Save.

Add success feedback.

------------------------------------------------------------------------

## Stage 10 --- Smart Berth Recommendations

Build `BerthRecommendation`.

Group berths into:

``` text
Recommended
Available
Unavailable
```

For unavailable options, display the actual reason.

For capacity failures, display the difference in feet.

For occupancy failures, identify the conflicting reservation and dates.

Automatically surface the smallest compatible berth as the
recommendation.

------------------------------------------------------------------------

## Stage 11 --- Edit and Delete

Reuse `ReservationForm` for editing.

Ensure editing excludes the reservation itself from collision detection.

Add delete confirmation.

Persist both operations and immediately update the timeline.

------------------------------------------------------------------------

## Stage 12 --- Historical Data Import

Create `scripts/parseSchedule.ts`.

Convert the provided source schedule into normalized application data.

Generate:

``` text
berths.json
vessels.json
reservations.json
```

Normalize:

-   identifiers
-   names
-   dates
-   berth references
-   vessel lengths
-   reservation types
-   missing values

Document transformations and assumptions.

------------------------------------------------------------------------

## Stage 13 --- Historical Validation

Run `validateDataset()` across imported reservations.

Calculate real counts for:

-   conflicts
-   capacity violations
-   missing data
-   other meaningful anomalies

Never hard-code demo issue counts.

------------------------------------------------------------------------

## Stage 14 --- Data Health

Build:

``` text
DataHealthSummary
IssueFilters
IssueList
IssueCard
```

Support:

-   overall reservation count
-   issue counts
-   issue categories
-   filtering
-   contextual explanations
-   links to affected reservations
-   `View in schedule`

------------------------------------------------------------------------

## Stage 15 --- Schedule Issues Mode

Add:

``` text
[ Schedule ] [ Issues ]
```

In Issues mode:

-   dim valid reservations
-   emphasize invalid reservations
-   show issue markers
-   add previous/next issue navigation
-   automatically move the timeline to the selected issue
-   explain overlaps visually where possible

------------------------------------------------------------------------

## Stage 16 --- Reservations Table

Build the full reservation-management table.

Include:

-   search
-   type filter
-   berth filter
-   date filter
-   status
-   validation state
-   row click → Reservation Drawer

Reuse existing components and domain logic.

------------------------------------------------------------------------

## Stage 17 --- Historical Vessel Exploration

Make vessel searches reveal historical reservations.

Allow:

``` text
Vessel → historical reservation → schedule date
```

This turns the 23-year dataset into useful institutional history rather
than merely background data.

------------------------------------------------------------------------

## Stage 18 --- Global Command Search

Implement `Cmd/Ctrl + K`.

Search:

-   vessels
-   events
-   reservations
-   berths

Support keyboard navigation and selection.

Use search results as navigation into the relevant application context.

------------------------------------------------------------------------

## Stage 19 --- Overview Dashboard

Build operational metrics from real reservation data.

Include:

-   active reservations
-   upcoming arrivals
-   currently available berths
-   upcoming schedule
-   issues requiring attention
-   links into relevant pages
-   useful historical analytics where appropriate

Any charts should answer an actual operational question.

------------------------------------------------------------------------

## Stage 20 --- Responsive and Accessibility Pass

Verify:

-   keyboard interaction
-   focus states
-   labels
-   dialogs
-   drawer behavior
-   color contrast
-   non-color warning indicators
-   responsive cards
-   scrollable tables
-   scrollable timeline
-   collapsed navigation behavior

------------------------------------------------------------------------

## Stage 21 --- Product Polish

Add:

-   loading states
-   empty states
-   confirmation dialogs
-   toasts
-   tooltips
-   hover states
-   consistent icons
-   clear status badges
-   useful microcopy
-   favicon
-   page metadata
-   polished spacing
-   graceful error handling

Avoid unnecessary visual effects.

------------------------------------------------------------------------

## Stage 22 --- README and Documentation

Document:

-   problem
-   solution
-   features
-   architecture
-   domain model
-   scheduling logic
-   recommendation strategy
-   historical-data pipeline
-   validation system
-   assumptions
-   local setup
-   tests
-   deployment
-   production considerations
-   future extensions

Include screenshots or a short visual walkthrough if useful.

------------------------------------------------------------------------

## Stage 23 --- Final QA

Manually verify all major workflows.

### Scheduling

-   create vessel reservation
-   create event
-   create same-day event
-   edit reservation
-   delete reservation
-   navigate dates
-   jump to historical date

### Validation

-   create berth collision
-   choose undersized berth
-   choose exact-fit berth
-   test event/vessel collision
-   test invalid date range
-   test reservation adjacent to another reservation according to
    documented date semantics

### Recommendations

-   smallest fitting berth is recommended
-   occupied berth is excluded
-   undersized berth is excluded
-   no-compatible-berth state works

### Persistence

-   refresh after create
-   refresh after edit
-   refresh after delete
-   corrupted/absent local data does not crash app

### Historical Data

-   search old vessel
-   open old reservation
-   jump to historical date
-   view conflict
-   view capacity violation
-   filter Data Health
-   navigate between issues

### Deployment

-   production build succeeds
-   tests pass
-   GitHub Pages loads
-   navigation works
-   refreshing does not 404
-   assets load with correct base path

------------------------------------------------------------------------

# 37. Key User Flows

## Flow A --- Schedule a Vessel

``` text
Schedule
   ↓
+ New Reservation
   ↓
Vessel
   ↓
Select R/V Atlantis
   ↓
System retrieves 274 ft vessel length
   ↓
Choose dates
   ↓
System evaluates all berths
   ↓
Pier 1 — 300 ft — Recommended
Pier 2 — 180 ft — Too short
Pier 3 — 350 ft — Occupied
Pier 4 — 450 ft — Available
   ↓
Select recommended berth
   ↓
Save
   ↓
Reservation appears on timeline
```

## Flow B --- Schedule an Event

``` text
Schedule
   ↓
+ New Reservation
   ↓
Event
   ↓
Community Sail Day
   ↓
Choose dates
   ↓
System checks berth occupancy
   ↓
Choose available berth
   ↓
Save
   ↓
Event appears on timeline
```

## Flow C --- Investigate Historical Problems

``` text
Data Health
   ↓
41 conflicts
   ↓
Select issue
   ↓
See two conflicting reservations
   ↓
View in Schedule
   ↓
Timeline jumps to historical date
   ↓
Conflicting blocks highlighted
```

## Flow D --- Find Vessel History

``` text
Cmd/Ctrl + K
   ↓
"Atlantis"
   ↓
R/V Atlantis
   ↓
Historical reservations
   ↓
Select 2017 reservation
   ↓
Schedule jumps to 2017
   ↓
Reservation opens
```

------------------------------------------------------------------------

# 38. Core Product Principles

Every implementation decision should reinforce these principles.

### Prevent errors instead of merely recording them

The system should not make staff manually discover that a vessel does
not fit or that a berth is occupied.

### Explain decisions

When an option is unavailable, show why.

### Keep operational context visible

Berth capacity, vessel length, dates, conflicts, and availability should
appear where decisions are made.

### Reuse the same rules everywhere

The validation logic used for a new reservation should also analyze
historical records.

### Make historical data useful

The 23-year dataset should be searchable, navigable, and analyzable.

### Separate domain logic from presentation

Scheduling behavior should remain understandable and testable
independently from React.

### Design for realistic future evolution

Use simple static infrastructure for the prototype while keeping clear
seams for a production API, shared database, authentication,
permissions, and auditing.

------------------------------------------------------------------------

# 39. Production Evolution

The prototype intentionally uses static hosting and browser-local
persistence.

A production architecture could evolve to:

``` text
React frontend
      │
      ▼
API / application server
      │
      ├── authentication
      ├── authorization
      ├── server-side validation
      ├── audit logging
      └── concurrency handling
      │
      ▼
Relational database
```

Potential production capabilities include:

-   staff authentication
-   administrator and scheduler roles
-   shared multi-user persistence
-   audit history
-   change attribution
-   reservation approval workflows
-   concurrent editing protection
-   notifications
-   calendar integration
-   vessel-data integrations
-   reporting/export
-   backups
-   organizational security controls

The prototype architecture should make this progression plausible
without pretending those systems are necessary for the take-home.

------------------------------------------------------------------------

# 40. Final Experience

The final application should communicate its value almost immediately.

A reviewer opens the application and sees a real waterfront schedule
rather than a generic form.

They can click a vessel and understand:

``` text
R/V Atlantis
274 ft
Pier 1
300 ft capacity
Sep 18–22
✓ Valid assignment
```

They create a reservation and see:

``` text
Pier 1 — 300 ft
✓ Recommended

Pier 2 — 180 ft
× Vessel too long

Pier 3 — 350 ft
× Occupied during selected dates

Pier 4 — 450 ft
✓ Available
```

They open Data Health and see the real imported historical dataset
analyzed automatically:

``` text
23 years of reservations analyzed

Conflicts
Capacity violations
Missing data
```

They click a conflict and the system takes them directly to the affected
historical schedule.

The result should demonstrate more than the ability to build a React
interface. It should demonstrate:

-   requirement interpretation
-   domain modeling
-   algorithmic reasoning
-   data normalization
-   validation
-   frontend architecture
-   reusable component design
-   testing
-   product design
-   accessibility
-   deployment
-   thoughtful technical scoping
-   understanding of how a real client would use the system

The defining feature of the project is not any individual piece of UI.
It is that the application takes the two manual checks explicitly
described in the original problem---**double-booking detection and
berth-fit verification---and turns them into automatic, explainable
system behavior throughout the product.**

------------------------------------------------------------------------

# 41. Workbook-Specific Implementation Plan

This section replaces generic assumptions about the source data with an
implementation plan based on the supplied **Dock Schedule - Synthetic
Sample.xlsx** workbook.

## 41.1 Workbook Structure

The workbook contains:

``` text
1997
1998
...
2019
8YR Dock Summary
Science
Yachts
Tours
```

The core schedule is therefore distributed across **23 annual worksheets
(1997--2019)** rather than stored as a conventional reservation table.

The annual sheets are visual scheduling grids. They contain repeated
month sections with:

-   a month/date header
-   day-of-week labels
-   physical berth/resource rows
-   vessel/event text placed into date cells
-   merged cells spanning multiple dates
-   occasional free-form operational annotations outside normal berth
    rows

Examples of physical resources appearing in the schedule include:

``` text
North Pier West - 410'
North Pier Face - 75'
North Pier East - 240'
Inner Channel - 55'
South Float West - 90'
South Float East - 90'
North Finger Piers:
Small craft slips (institution boats)
```

Later annual sheets include additional resource categories such as the
North Finger Piers and small-craft slips. The parser must therefore
discover resources from the workbook rather than assuming that every
year contains an identical fixed set.

The workbook also contains reference/legacy sheets:

### `Science`

A semi-structured vessel/contact directory with fields such as:

``` text
VESSEL
OPERATOR
CONTACT
WORK#
CELL#
EMAIL
NOTES
```

However, records are not reliably one-row-per-vessel. Contact
information can spill into subsequent rows and occasionally appears
under unexpected columns.

### `Yachts`

Another semi-structured vessel/contact directory. It does not
consistently use a single header/schema and includes vessel names,
LOA/draft notes, contacts, phone numbers, email addresses, operators,
URLs, and free-form notes spread across multiple rows.

### `Tours`

A more conventional table with fields such as:

``` text
Date
Time
Guide
Guest
People
Dock/ Ship
Notes
```

The sheet itself states that tours are now tracked in another workbook
and that the tab is retained for reference. Treat this as ancillary
historical data, not as berth reservations unless a record can be
explicitly tied to the dock schedule.

### `8YR Dock Summary`

A historical aggregate table containing dock-usage totals for 2006--2013
across resources such as North Pier West, North Pier Face, North Pier
East, North Finger Piers, Marsh Landing, and the South Floats.

Use this as a **validation/reference source**, not as the canonical
reservation dataset.

------------------------------------------------------------------------

# 42. Critical Source-Data Insight: Merged Cells Encode Reservation Duration

The annual worksheets are not simply sparse grids where a vessel name
means "occupied on this one date."

Many schedule entries are stored as **merged horizontal cell ranges**.

For example, conceptually:

``` text
               4   5   6   7   8   9   10   11   12

North Pier     ┌───────────────────────────────┐
West           │ R/V GOLDEN COMPASS            │
               └───────────────────────────────┘
```

may be represented in the workbook as a merged range whose top-left cell
contains the vessel name.

Therefore:

``` text
merged start column  → reservation start date
merged end column    → reservation end date
```

This is the most important parser rule.

A populated unmerged cell represents a one-day entry unless contextual
rules indicate otherwise.

Do **not** attempt to infer duration by searching for repeated vessel
names in neighboring cells. Use workbook merge metadata first.

------------------------------------------------------------------------

# 43. Annual Sheet Parser

Create a dedicated import script:

``` text
scripts/
├── parseWorkbook.ts
├── parseAnnualSchedule.ts
├── parseVessels.ts
├── normalizeNames.ts
└── validateImport.ts
```

The parser should operate in stages.

## 43.1 Discover Month Sections

Annual sheets vary in formatting across years.

Do not hard-code assumptions such as:

``` text
January always starts at row 6
berths are always rows 8–13
day 1 is always column B
```

Instead, detect month-header rows.

Recognize month names case-insensitively:

``` ts
const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
```

Annual sheets use several layouts. For example, some sections place the
month name and date numbers on the same row, while older sections may
put weekday/date information across adjacent rows.

For every detected month block, derive a mapping:

``` ts
column index -> actual calendar date
```

Example:

``` ts
Map<number, Date> {
  4 -> 2010-01-01,
  5 -> 2010-01-02,
  6 -> 2010-01-03,
  ...
}
```

Never derive dates solely from Excel column position. The first date
column shifts between month sections and years.

------------------------------------------------------------------------

## 43.2 Identify Resource Rows

Recognize rows whose first meaningful cell names a physical
berth/resource.

Parse names such as:

``` text
North Pier West - 410'
```

into:

``` ts
{
  rawName: "North Pier West - 410'",
  canonicalName: "North Pier West",
  maxVesselLengthFt: 410
}
```

Use a length regex such as:

``` ts
/(\d+)\s*['’]/
```

Do not require every resource to have a numeric capacity.

For example:

``` text
North Finger Piers:
Small craft slips (institution boats)
```

should still become resources, but their capacity may initially be:

``` ts
maxVesselLengthFt: null
```

Model this explicitly:

``` ts
export interface Berth {
  id: string;
  name: string;
  maxVesselLengthFt: number | null;
  category?: string;
  sourceLabels: string[];
}
```

A missing capacity is different from unlimited capacity.

The UI should say:

``` text
Capacity not specified
```

rather than treating it as infinitely large.

------------------------------------------------------------------------

## 43.3 Read Merged Ranges

For each annual worksheet, extract all merged ranges.

For a merged range intersecting a recognized berth row:

1.  Read the value from the top-left cell.
2.  Determine the first and last date columns covered by the merge.
3.  Convert those columns to dates using the month section's date map.
4.  Create one candidate reservation spanning those dates.

Example:

``` text
E8:L8
```

on a January section where:

``` text
E -> Jan 1
L -> Jan 8
```

becomes:

``` ts
{
  berth: "North Pier West",
  startDate: "2010-01-01",
  endDate: "2010-01-08",
  rawLabel: "R/V GOLDEN COMPASS"
}
```

For a populated unmerged cell on a berth row, create a one-day
candidate:

``` ts
startDate === endDate
```

unless the source semantics provide stronger evidence otherwise.

------------------------------------------------------------------------

## 43.4 Avoid Double-Parsing Merged Cells

When scanning cells:

``` ts
if (cell belongs to merged range) {
  parse only if cell is top-left of merge
} else if (cell has meaningful content) {
  parse as single-cell candidate
}
```

Maintain a set of coordinates covered by merged ranges so merged
bookings are never emitted multiple times.

------------------------------------------------------------------------

# 44. Distinguishing Reservations, Events, and Notes

Not every populated schedule cell is a vessel.

Observed examples include:

``` text
Community sail day
Holiday
Campus event
Student tour
Utility work on pier face
Arrival 1400
Delayed due to weather
Load equipment
```

The parser should not blindly turn every non-empty string into a vessel.

Use a classification pipeline.

## 44.1 Candidate Types

``` ts
export type ImportedEntryType =
  | "vessel"
  | "event"
  | "note"
  | "unknown";
```

## 44.2 Vessel Signals

Strong vessel indicators include prefixes such as:

``` text
R/V
M/V
F/V
S/V
S/Y
M/Y
OSV
Tug
Barge
```

Also classify an entry as a vessel if its normalized name confidently
matches a vessel in the Science/Yachts registry.

## 44.3 Event Signals

Known operational/non-vessel phrases should be classified as events
where they occupy a berth:

``` text
Community sail day
Campus event
Student tour
Holiday
```

Keep the classifier extensible rather than hard-coding only these exact
strings.

## 44.4 Notes

Free-form annotations such as:

``` text
Arrival 1400
Delayed due to weather
Load equipment
```

should normally become notes associated with nearby reservations rather
than independent berth reservations.

However, do not silently force uncertain text into an existing
reservation.

If association is ambiguous, retain it as an imported annotation with
source coordinates.

## 44.5 Operational Closures

Entries such as:

``` text
Utility work on pier face
```

may represent a berth/resource closure rather than a vessel or public
event.

Extend the application reservation model:

``` ts
export type ReservationType =
  | "vessel"
  | "event"
  | "closure";
```

A closure occupies the resource and participates in conflict detection
exactly like a vessel/event, but does not require vessel-length
validation.

This is a useful improvement over the original generic model because it
captures real operational schedule semantics found in the workbook.

------------------------------------------------------------------------

# 45. Source Provenance

Every imported record should retain where it came from.

Add:

``` ts
export interface SourceReference {
  sheet: string;
  cell?: string;
  range?: string;
  rawValue: string;
}
```

Then:

``` ts
export interface Reservation {
  id: string;
  type: "vessel" | "event" | "closure";

  title: string;
  vesselId?: string;
  berthId: string;

  startDate: string;
  endDate: string;

  notes?: string[];

  source?: SourceReference;
  importConfidence?: "high" | "medium" | "low";
}
```

This allows Data Health to say:

``` text
Source: 2010!E8:L8
```

and makes parser behavior auditable.

Do not expose spreadsheet coordinates everywhere in the normal product
UI, but make them available in issue/details views.

------------------------------------------------------------------------

# 46. Vessel Registry Normalization

The schedule and reference sheets use inconsistent
naming/capitalization.

Examples may conceptually differ as:

``` text
R/V GOLDEN COMPASS
R/V Golden Compass
r/v golden compass
```

These should resolve to the same canonical identity.

Create:

``` ts
normalizeVesselName(raw: string): string
```

Normalization should:

1.  trim whitespace
2.  collapse repeated whitespace
3.  normalize curly/straight apostrophes
4.  normalize case for comparison
5.  normalize common vessel-prefix formatting
6.  remove an embedded trailing length when comparing identity
7.  preserve the original display value separately

Example:

``` text
R/V High Drift 120'
```

comparison key:

``` text
r/v high drift
```

but display name remains:

``` text
R/V High Drift
```

and candidate source length remains:

``` text
120 ft
```

------------------------------------------------------------------------

# 47. Vessel Length Resolution

The workbook contains vessel lengths in multiple forms.

A vessel name may contain a suffix:

``` text
R/V High Drift 120'
```

A nearby/reference field may instead contain:

``` text
LOA: 145', Draft: 12'
```

These can disagree.

Do not silently choose one without recording provenance.

Use:

``` ts
export interface VesselDimensionSource {
  valueFt: number;
  source: "name" | "loa-field" | "manual";
  sourceReference?: SourceReference;
}
```

and:

``` ts
export interface Vessel {
  id: string;
  name: string;
  lengthFt: number | null;
  lengthSources: VesselDimensionSource[];
  aliases: string[];
  operator?: string;
  contacts?: Contact[];
  notes?: string[];
}
```

Resolution policy:

1.  Prefer an explicit `LOA:` value when it is clearly associated with
    the vessel.
2.  Otherwise use a length embedded in the vessel name.
3.  If multiple sources disagree, retain all values and create a
    data-quality issue.
4.  Do not perform capacity validation when vessel length is genuinely
    unknown.
5.  Show `Length unknown` rather than inventing a value.

Add a validation issue:

``` text
VESSEL_LENGTH_CONFLICT
```

for conflicting source values.

------------------------------------------------------------------------

# 48. Parsing the Science Sheet

The `Science` sheet should be treated as a **semi-structured
directory**, not a clean CSV table.

A new vessel record generally begins when a cell looks like a vessel
name.

Subsequent rows may contain additional contact information until:

-   another vessel-like row begins, or
-   a sufficiently clear blank separator ends the block.

Build a block parser:

``` text
vessel-like row
     ↓
start record
     ↓
consume following continuation rows
     ↓
extract typed values from all cells
     ↓
stop at next vessel-like row
```

Classify individual values by pattern rather than trusting their column.

Useful recognizers:

``` ts
isEmail(value)
isPhone(value)
isVesselName(value)
parseLOA(value)
parseDraft(value)
isURL(value)
```

For example:

``` text
Cell: 555-0198
```

should be recognized as a phone number even if it appears in a column
whose header says something else.

Likewise:

``` text
skyler.sterling@example.com
```

should be recognized as email regardless of its column.

Preserve unmatched values as notes rather than discarding them.

------------------------------------------------------------------------

# 49. Parsing the Yachts Sheet

Use the same block-oriented strategy for `Yachts`.

Do not assume it has the same schema as `Science`.

Detect vessel-start rows using vessel prefixes and/or embedded
vessel-length patterns.

Within each block, extract:

-   vessel name
-   LOA
-   draft
-   operator/organization
-   captain/contact names
-   phone numbers
-   email addresses
-   URLs
-   notes

Because field placement is inconsistent, typed-value recognition should
be more important than column index.

Keep raw source values for auditability.

------------------------------------------------------------------------

# 50. Tours Sheet Treatment

Do not automatically convert `Tours` rows into berth reservations.

The sheet explicitly indicates that tours are maintained separately and
is retained for reference.

Use it optionally for:

-   historical search
-   related activity context
-   demonstrating that the importer distinguishes authoritative
    scheduling data from ancillary records

If a tour references a vessel:

``` text
Dock/ Ship = R/V Silver Tern
```

that is not sufficient evidence that the tour itself occupied a berth
for the full day.

Therefore:

``` text
Tours ≠ reservations
```

unless the annual dock schedule independently contains the corresponding
event.

This is an important example of avoiding over-inference from legacy
data.

------------------------------------------------------------------------

# 51. Dock Summary Validation

The `8YR Dock Summary` can be used as a cross-check.

For years 2006--2013:

1.  Calculate occupied berth-days from parsed reservations.
2.  Group by canonical resource.
3.  Compare calculated totals with summary-sheet values.
4.  Report discrepancies.

Example internal validation output:

``` text
North Pier West · 2010

Parsed occupied days: 134
Legacy summary:       136
Difference:            -2
```

Do **not** automatically modify reservations to force agreement.

Instead, use discrepancies to detect:

-   parser mistakes
-   different historical counting semantics
-   resources represented differently in the annual sheets
-   overlapping bookings counted differently
-   manual errors in the legacy summary

Add an import-quality report showing comparison coverage and
discrepancies.

This is a particularly strong engineering feature because it
demonstrates that the migration is being validated against an
independent historical aggregate.

------------------------------------------------------------------------

# 52. Expanded Data-Quality Model

Update issue types to include:

``` ts
export type ValidationIssueType =
  | "BERTH_CONFLICT"
  | "VESSEL_TOO_LONG"
  | "MISSING_DATA"
  | "INVALID_DATE_RANGE"
  | "UNKNOWN_VESSEL_LENGTH"
  | "VESSEL_LENGTH_CONFLICT"
  | "UNMATCHED_VESSEL"
  | "AMBIGUOUS_ENTRY"
  | "SUMMARY_MISMATCH";
```

Separate **operational scheduling problems** from
**migration/data-quality problems**.

``` ts
export interface ValidationIssue {
  id: string;

  category:
    | "schedule"
    | "capacity"
    | "import"
    | "reference-data";

  type: ValidationIssueType;

  severity:
    | "info"
    | "warning"
    | "error";

  message: string;

  reservationIds?: string[];
  vesselId?: string;
  berthId?: string;

  sourceReferences?: SourceReference[];
}
```

------------------------------------------------------------------------

# 53. Import Confidence

Assign confidence to imported reservations.

### High confidence

Examples:

-   recognized berth row
-   valid date mapping
-   merged range clearly spans dates
-   value matches known vessel or clear vessel prefix

### Medium confidence

Examples:

-   recognized berth/date
-   entry looks like a vessel but does not match reference registry
-   non-vessel event confidently occupies a berth

### Low confidence

Examples:

-   ambiguous free-form text
-   uncertain date association
-   uncertain resource association
-   annotation that may or may not represent occupancy

Data Health should allow filtering by confidence.

Example:

``` text
Import confidence

High       1,842
Medium       116
Low           19
```

Use actual calculated counts in the final application.

------------------------------------------------------------------------

# 54. Revised Normalized Data Files

Generate:

``` text
src/data/generated/
├── berths.json
├── vessels.json
├── reservations.json
├── annotations.json
├── validation-issues.json
└── import-report.json
```

### `berths.json`

Canonical physical resources and capacities.

### `vessels.json`

Normalized vessel registry assembled from Science, Yachts, and names
discovered in schedules.

### `reservations.json`

Parsed vessel/event/closure reservations.

### `annotations.json`

Source notes that cannot safely be modeled as occupancy.

### `validation-issues.json`

Precomputed historical import/data-quality findings if desired.

### `import-report.json`

Metadata such as:

``` ts
{
  sourceFile: "Dock Schedule - Synthetic Sample.xlsx",
  scheduleYears: {
    first: 1997,
    last: 2019
  },
  annualSheetsParsed: 23,
  reservationCount: ...,
  vesselCount: ...,
  berthCount: ...,
  issueCounts: {...},
  summaryComparisons: [...]
}
```

------------------------------------------------------------------------

# 55. Import Script Output

Running:

``` bash
npm run import-data
```

should produce a concise report such as:

``` text
Dock Schedule Import
────────────────────────────────

Annual sheets parsed       23
Years                  1997–2019
Resources discovered        ...
Vessels discovered          ...
Reservations parsed         ...
Events parsed               ...
Closures parsed             ...
Annotations retained        ...

Validation
────────────────────────────────

Berth conflicts             ...
Capacity violations         ...
Unknown vessel lengths      ...
Ambiguous entries           ...
Reference mismatches        ...

8YR summary comparison
────────────────────────────────

Comparisons                 ...
Exact matches               ...
Differences                 ...
```

The numbers should come from the actual parser.

This command becomes an excellent thing to mention in the README because
it demonstrates reproducibility.

------------------------------------------------------------------------

# 56. Import Parser Pseudocode

``` ts
for (const annualSheet of annualSheets) {
  const year = Number(annualSheet.name);

  const monthSections = discoverMonthSections(annualSheet);

  const mergedRanges = getMergedRanges(annualSheet);
  const mergeIndex = buildMergeIndex(mergedRanges);

  for (const month of monthSections) {
    const dateMap = buildDateColumnMap(month, year);

    const resourceRows = discoverResourceRows(month);

    for (const resourceRow of resourceRows) {
      const berth = normalizeResource(resourceRow.label);

      for (const dateColumn of dateMap.keys()) {
        const cell = annualSheet.cell(resourceRow.row, dateColumn);

        if (isInsideMergeButNotTopLeft(cell, mergeIndex)) {
          continue;
        }

        if (!hasMeaningfulValue(cell)) {
          continue;
        }

        const merge = getMergeStartingAt(cell, mergeIndex);

        const startDate = dateMap.get(dateColumn);

        const endDate = merge
          ? dateMap.get(merge.endColumn)
          : startDate;

        const classification = classifyScheduleEntry(cell.value);

        emitImportedEntry({
          berth,
          startDate,
          endDate,
          rawValue: cell.value,
          classification,
          source: {
            sheet: annualSheet.name,
            range: merge?.address ?? cell.address,
            rawValue: cell.value
          }
        });
      }
    }

    parseNonResourceAnnotations(month);
  }
}
```

Then:

``` ts
const vesselRegistry = parseReferenceSheets();

const normalizedEntries =
  reconcileScheduleEntriesWithVessels(
    importedEntries,
    vesselRegistry
  );

const issues = validateDataset(
  normalizedEntries,
  berths,
  vessels
);
```

------------------------------------------------------------------------

# 57. Parser Tests

In addition to scheduling-engine tests, add import tests.

Use small synthetic worksheet fixtures or extracted representations
rather than depending exclusively on the entire workbook.

Test:

``` text
✓ detects month sections despite layout variation
✓ maps shifted day columns correctly
✓ parses berth capacity from row label
✓ preserves resources without numeric capacity
✓ converts merged horizontal cells into date ranges
✓ converts populated unmerged cells into one-day entries
✓ does not duplicate merged reservations
✓ classifies R/V entries as vessels
✓ classifies M/V entries as vessels
✓ classifies Tug entries as vessels
✓ classifies Barge entries as vessels
✓ classifies Community sail day as an event
✓ distinguishes annotations from occupancy
✓ normalizes vessel capitalization
✓ removes length suffix only for matching
✓ extracts length from vessel name
✓ extracts LOA from reference field
✓ flags conflicting vessel lengths
✓ preserves source provenance
✓ does not convert Tours rows into dock reservations
✓ compares parsed berth-days against Dock Summary
```

------------------------------------------------------------------------

# 58. Revised Data Health Page

The Data Health page should now have two major sections.

## Schedule Integrity

``` text
Schedule Integrity

Berth conflicts
Capacity violations
Invalid date ranges
```

These are problems with the actual waterfront schedule.

## Migration & Reference Data

``` text
Migration & Reference Data

Unknown vessel lengths
Conflicting vessel lengths
Unmatched vessels
Ambiguous entries
Summary mismatches
```

This distinction prevents a messy spreadsheet import from being
presented as though every issue is an operational scheduling failure.

Add filters:

``` text
[ All ]
[ Schedule ]
[ Capacity ]
[ Import ]
[ Reference Data ]
```

and:

``` text
Confidence
[ All ] [ High ] [ Medium ] [ Low ]
```

------------------------------------------------------------------------

# 59. Source Data in Reservation Details

For historical imported reservations, add a collapsed section:

``` text
Source data
────────────────────

Imported from:
2010 Dock Schedule

Source:
2010!E8:L8

Original value:
R/V GOLDEN COMPASS

Import confidence:
High
```

This should be unobtrusive in normal use but invaluable when reviewing
legacy records.

For newly created reservations, show:

``` text
Source
Created in Dock Manager
```

------------------------------------------------------------------------

# 60. Vessel Details

Because the workbook includes vessel reference data, add a lightweight
vessel-details experience.

Clicking a vessel name can show:

``` text
R/V High Drift

Length
120 ft

Operator
Coastal Survey Partners

Contacts
Parker Underhill
...

Reservation history
12 historical visits

Data sources
Science directory
Dock schedules
```

If lengths disagree:

``` text
⚠ Conflicting vessel dimensions

120 ft
Vessel directory name

145 ft
LOA field

Capacity checks require review.
```

This is much better than silently choosing a value.

------------------------------------------------------------------------

# 61. Berth Details

Clicking a berth name can show:

``` text
North Pier West

Maximum vessel length
410 ft

Historical usage
...

Current reservation
...

Upcoming
...

Known data coverage
1997–2019
```

For resources with unknown capacity:

``` text
Capacity
Not specified in source schedule
```

Do not run vessel-fit validation for those resources until a capacity is
known.

------------------------------------------------------------------------

# 62. Historical Analytics Based on the Real Workbook

The dataset supports useful analytics beyond decorative charts.

Potential dashboard analytics:

### Berth Utilization Over Time

``` text
occupied berth-days / available calendar days
```

by year/resource.

### Reservation Mix

``` text
vessel
event
closure
```

over time.

### Most Frequent Vessels

Count historical visits by normalized vessel identity.

### Capacity Distribution

Show how often vessels use berths relative to berth capacity.

### Data Quality by Year

Show historical import/validation issues by year.

These should be computed from normalized records.

The `8YR Dock Summary` can be displayed as a legacy comparison rather
than being used directly as the modern metric source.

------------------------------------------------------------------------

# 63. Historical Search Improvements

Global search should search both normalized and raw aliases.

For example, a search for:

``` text
golden compass
```

should match:

``` text
R/V GOLDEN COMPASS
R/V Golden Compass
```

without case sensitivity.

Search should also understand:

-   canonical vessel name
-   aliases
-   raw imported labels
-   berth name
-   year
-   event name

Historical results should indicate their source year and berth.

------------------------------------------------------------------------

# 64. Schedule Visualization of Uncertainty

Imported low-confidence records should be visually distinguishable
without overwhelming the normal schedule.

For example:

``` text
R/V Example
? Imported record
```

Clicking reveals:

``` text
Import confidence: Low
Reason: vessel could not be matched to reference data
```

Do not use uncertainty styling for ordinary clean historical records.

------------------------------------------------------------------------

# 65. Handling Overlaps Already Present in the Workbook

The historical schedule may itself contain overlapping entries.

The importer should **preserve the source data as-is**.

Do not "fix" conflicts during import.

Instead:

``` text
legacy source
    ↓
faithful normalized representation
    ↓
validation
    ↓
issue surfaced to user
```

This is essential.

The application should distinguish:

``` text
Imported historical issue
```

from:

``` text
New reservation blocked before creation
```

For new reservations, prevent invalid saves.

For imported historical data, preserve and flag them.

------------------------------------------------------------------------

# 66. Editing Imported Historical Records

Allow imported records to be viewed normally.

If editing is supported, preserve provenance and record that the
reservation has been modified locally.

Add:

``` ts
origin: "imported" | "created";
modifiedSinceImport?: boolean;
```

UI:

``` text
Imported from 2010 schedule
Modified locally
```

This prevents the app from implying that edited browser-local data still
exactly matches the source workbook.

------------------------------------------------------------------------

# 67. Reset Demo Data

Because GitHub Pages uses browser-local persistence, add a small action:

``` text
Reset demo data
```

This restores the original normalized import.

Place it somewhere unobtrusive such as:

``` text
Settings / About / Demo controls
```

Require confirmation:

``` text
Reset all local changes?

This will restore reservations to the original imported dataset.
```

This makes the public demo resilient after reviewers create/edit/delete
reservations.

------------------------------------------------------------------------

# 68. Import Report Page or Drawer

Expose a compact "About this data" experience.

Example:

``` text
Dataset

Source
Dock Schedule - Synthetic Sample.xlsx

Schedule coverage
1997–2019

Annual schedule sheets
23

Reference sheets
Science
Yachts
Tours
8YR Dock Summary

Last import
Build-time

[ View import report ]
```

The import report can show:

-   parsed counts
-   ignored/ancillary sheets
-   classification counts
-   confidence counts
-   summary cross-check results
-   assumptions

This makes the data-engineering work visible without forcing it into the
main scheduling UI.

------------------------------------------------------------------------

# 69. Revised Architecture

The complete architecture should now look like:

``` text
Dock Schedule - Synthetic Sample.xlsx
                │
                ▼
┌────────────────────────────────────┐
│        Build-Time Importer         │
│                                    │
│ Annual calendar parser             │
│ Merge-range parser                 │
│ Resource normalization             │
│ Vessel directory parser            │
│ Name reconciliation                │
│ Entry classification               │
│ Provenance tracking                │
│ Import confidence                  │
│ Legacy summary cross-check         │
└──────────────────┬─────────────────┘
                   │
                   ▼
┌────────────────────────────────────┐
│        Normalized JSON Data        │
│                                    │
│ berths                             │
│ vessels                            │
│ reservations                       │
│ annotations                        │
│ import report                      │
└──────────────────┬─────────────────┘
                   │
                   ▼
┌────────────────────────────────────┐
│           Domain Engine            │
│                                    │
│ conflict detection                 │
│ vessel-fit validation              │
│ best-fit berth assignment          │
│ dataset validation                 │
│ historical analytics               │
└──────────────────┬─────────────────┘
                   │
                   ▼
┌────────────────────────────────────┐
│       Repository / State Layer     │
│                                    │
│ seed JSON + localStorage           │
│ React Context + hooks              │
└──────────────────┬─────────────────┘
                   │
                   ▼
┌────────────────────────────────────┐
│               UI                   │
│                                    │
│ Overview                           │
│ Schedule                           │
│ Issues mode                        │
│ Reservations                       │
│ Data Health                        │
│ Vessel details                     │
│ Search                             │
└────────────────────────────────────┘
```

------------------------------------------------------------------------

# 70. Revised Implementation Sequence for the Actual Workbook

## Stage A --- Inspect and Encode Workbook Semantics

Document:

-   annual sheet layouts
-   month-header variants
-   berth/resource labels
-   merged-range behavior
-   free-form annotations
-   Science/Yachts record patterns
-   Dock Summary semantics
-   known ambiguous cases

Do not start by manually converting the workbook.

The importer should be reproducible.

## Stage B --- Build Workbook Importer

Implement:

``` text
discoverAnnualSheets
discoverMonthSections
buildDateColumnMap
discoverResourceRows
readMergedRanges
parseScheduleEntries
parseAnnotations
```

Generate raw intermediate records with provenance.

## Stage C --- Build Vessel Registry Parser

Implement:

``` text
parseScienceSheet
parseYachtsSheet
normalizeVesselName
extractLength
extractLOA
extractContacts
```

Keep uncertain/unmatched values.

## Stage D --- Reconcile Schedule and Reference Data

Match schedule vessel labels to normalized vessel identities.

Create aliases.

Resolve dimensions.

Flag ambiguity rather than hiding it.

## Stage E --- Cross-Validate Import

Compare calculated 2006--2013 berth usage against `8YR Dock Summary`.

Generate an import report.

## Stage F --- Generate Static Application Data

Write normalized JSON.

The React application should never need to understand the original
spreadsheet layout.

## Stage G --- Build Domain Engine

Implement scheduling conflict detection, capacity validation,
recommendations, historical validation, and analytics over the
normalized model.

## Stage H --- Build Full Product UI

Implement every product feature specified earlier in this document:

-   Overview
-   interactive schedule
-   date navigation
-   reservation details
-   create
-   edit
-   delete
-   vessel/event/closure handling
-   smart berth recommendations
-   explanatory validation
-   reservations table
-   historical vessel search
-   command search
-   Data Health
-   Schedule Issues mode
-   analytics
-   source provenance
-   vessel details
-   berth details
-   import report
-   reset demo data

## Stage I --- Test the Importer and Domain Engine

Test both:

``` text
legacy workbook → normalized records
```

and:

``` text
normalized records → scheduling decisions
```

## Stage J --- Polish, Document, Deploy, QA

Complete accessibility, responsive behavior, README, GitHub Pages
deployment, screenshots, and full workflow verification.

------------------------------------------------------------------------

# 71. README: Data Migration Section

Add a prominent section explaining that the supplied workbook is not a
relational dataset.

Suggested wording:

> The source workbook stores 23 years of reservations as visual annual
> calendar grids rather than one-row-per-reservation records.
> Reservation duration is frequently represented through merged
> horizontal cells, while berth capacities are embedded in row labels
> and vessel metadata is distributed across semi-structured reference
> sheets.
>
> The application includes a build-time import pipeline that
> reconstructs normalized reservations from those grids, preserves
> source provenance, reconciles vessel identities, extracts vessel
> dimensions, and validates the resulting dataset. The original workbook
> remains the source of truth for imported historical data; uncertain
> interpretations are surfaced rather than silently discarded.

Then diagram:

``` text
Legacy workbook
      ↓
Calendar/merge parser
      ↓
Normalization
      ↓
Reference reconciliation
      ↓
Validation
      ↓
Static application dataset
```

------------------------------------------------------------------------

# 72. README: Dataset Assumptions

Document these explicitly and revise if further workbook inspection
reveals exceptions.

1.  **Merged horizontal cells on berth rows represent continuous
    occupancy** from the first covered date through the last covered
    date.
2.  **Populated unmerged berth cells represent one-day occupancy**
    unless additional source evidence indicates otherwise.
3.  **Reservation end dates are inclusive** because each spreadsheet
    date cell represents an occupied calendar day.
4.  **Lengths embedded in berth labels represent maximum vessel length**
    for that resource.
5.  **Resources without a stated numeric length have unknown capacity**,
    not unlimited capacity.
6.  **Explicit LOA values are preferred over vessel-name suffixes** when
    the two are confidently associated with the same vessel.
7.  **Conflicting vessel-length sources are preserved and flagged**
    rather than silently resolved.
8.  **Free-form annotations are not automatically treated as
    reservations.**
9.  **Tours are reference data and are not automatically converted into
    berth occupancy.**
10. **Historical conflicts are preserved exactly as imported and
    surfaced as issues.**
11. **New reservations are validated before creation and should not
    introduce known berth conflicts or capacity violations.**
12. **The 8YR Dock Summary is a secondary validation source rather than
    the canonical reservation source.**
13. **Source provenance is retained for imported records so questionable
    interpretations can be traced back to the workbook.**

------------------------------------------------------------------------

# 73. What Makes This Implementation Stand Out

The strongest technical story is no longer simply:

``` text
"I built a scheduling UI."
```

It is:

``` text
"I took a 23-year operational workbook whose database was effectively
encoded through calendar layout, merged cells, inconsistent reference
tables, and free-form annotations; reconstructed it into a typed,
auditable domain model; validated it against an independent historical
summary; and built an interface that prevents the same scheduling
problems going forward."
```

That lets the project demonstrate four distinct engineering layers:

``` text
Legacy data migration
        +
Domain modeling
        +
Scheduling / validation logic
        +
Product-quality frontend
```

The spreadsheet's messiness is therefore not something to hide. It is
one of the best opportunities in the take-home.
