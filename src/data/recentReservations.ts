import type { Reservation } from "../types";

// Synthetic continuation of the supplied historical schedule. These records
// keep the demo useful after 2019 without implying they are operational data.
const recurring: Array<Omit<Reservation, "id" | "startDate" | "endDate"> & { start: string; end: string }> = [
  { type: "vessel", title: "R/V Amber Voyager", vesselId: "vessel-r-v-amber-voyager", berthId: "berth-north-pier-west", start: "01-10", end: "01-15", origin: "created", status: "confirmed" },
  { type: "closure", title: "Pier face maintenance", berthId: "berth-north-pier-face", start: "02-01", end: "02-03", origin: "created", status: "confirmed" },
  { type: "vessel", title: "R/V Deep Ketch", vesselId: "vessel-r-v-deep-ketch", berthId: "berth-north-pier-east", start: "03-04", end: "03-08", origin: "created", status: "confirmed" },
  { type: "event", title: "Community Sail Day", berthId: "berth-south-float-west", start: "05-20", end: "05-20", origin: "created", status: "confirmed" },
  { type: "vessel", title: "S/V High Tide", vesselId: "vessel-s-v-high-tide", berthId: "berth-south-float-east", start: "06-12", end: "06-14", origin: "created", status: "confirmed" },
  { type: "event", title: "Waterfront Open House", berthId: "berth-small-craft-slips-institution-boats", start: "08-10", end: "08-11", origin: "created", status: "confirmed" },
  { type: "vessel", title: "M/V Long Wind", vesselId: "vessel-m-v-long-wind", berthId: "berth-inner-channel", start: "10-05", end: "10-07", origin: "created", status: "confirmed" },
  { type: "closure", title: "Winter systems service", berthId: "berth-north-finger-piers", start: "11-15", end: "11-16", origin: "created", status: "confirmed" },
];

const seasonalWindows = [
  { key: "winter", start: "01-22", end: "01-24", event: "Winter small-craft training", closure: "Cold-weather utilities inspection" },
  { key: "spring", start: "04-12", end: "04-15", event: "Spring waterfront orientation", closure: "Finger pier electrical service" },
  { key: "early-summer", start: "07-01", end: "07-04", event: "Youth sailing program", closure: "Navigation light maintenance" },
  { key: "late-summer", start: "08-20", end: "08-23", event: "Marine science demonstration day", closure: "Float and piling inspection" },
  { key: "winterization", start: "12-03", end: "12-06", event: "Small-craft operator workshop", closure: "Seasonal water-system shutdown" },
] as const;

const seasonalAssignments = [
  { type: "vessel", title: "M/V High Current", vesselId: "vessel-m-v-high-current", berthId: "berth-north-pier-west" },
  { type: "vessel", title: "M/V Far Anchor", vesselId: "vessel-m-v-far-anchor", berthId: "berth-north-pier-east" },
  { type: "vessel", title: "M/V Blue Tern", vesselId: "vessel-m-v-blue-tern", berthId: "berth-south-float-west" },
  { type: "vessel", title: "M/V Clear Cove", vesselId: "vessel-m-v-clear-cove", berthId: "berth-south-float-east" },
  { type: "vessel", title: "M/V Far Fathom", vesselId: "vessel-m-v-far-fathom", berthId: "berth-north-pier-face" },
  { type: "vessel", title: "M/V Deep Gannet", vesselId: "vessel-m-v-deep-gannet", berthId: "berth-inner-channel" },
] as const;

const seasonalReservations = Array.from({ length: 8 }, (_, offset) => 2019 + offset).flatMap((year) =>
  seasonalWindows.flatMap((window): Reservation[] => [
    ...(year === 2019 ? [] : seasonalAssignments.map((assignment, index): Reservation => ({
      ...assignment,
      id: `synthetic-expanded-${year}-${window.key}-${index + 1}`,
      startDate: `${year}-${window.start}`,
      endDate: `${year}-${window.end}`,
      origin: "created",
      status: "confirmed",
    }))),
    {
      id: `synthetic-expanded-${year}-${window.key}-event`,
      type: "event",
      title: window.event,
      berthId: "berth-small-craft-slips-institution-boats",
      startDate: `${year}-${window.start}`,
      endDate: `${year}-${window.end}`,
      origin: "created",
      status: "confirmed",
    },
    {
      id: `synthetic-expanded-${year}-${window.key}-closure`,
      type: "closure",
      title: window.closure,
      berthId: "berth-north-finger-piers",
      startDate: `${year}-${window.start}`,
      endDate: `${year}-${window.end}`,
      origin: "created",
      status: "confirmed",
    },
  ]),
);

const annualReservations = Array.from({ length: 7 }, (_, offset) => 2020 + offset).flatMap((year) =>
  recurring.map(({ start, end, ...reservation }, index): Reservation => ({
    ...reservation,
    id: `synthetic-recent-${year}-${index + 1}`,
    startDate: `${year}-${start}`,
    endDate: `${year}-${end}`,
  })),
);

const currentMonthReservations: Reservation[] = [
  { id: "synthetic-current-2026-09-amber-voyager", type: "vessel", title: "R/V Amber Voyager", vesselId: "vessel-r-v-amber-voyager", berthId: "berth-north-pier-west", startDate: "2026-09-14", endDate: "2026-09-22", origin: "created", status: "confirmed" },
  { id: "synthetic-current-2026-09-deep-ketch", type: "vessel", title: "R/V Deep Ketch", vesselId: "vessel-r-v-deep-ketch", berthId: "berth-north-pier-east", startDate: "2026-09-18", endDate: "2026-09-20", origin: "created", status: "confirmed" },
  { id: "synthetic-current-2026-09-community-sail", type: "event", title: "Community Sail Day", berthId: "berth-south-float-west", startDate: "2026-09-19", endDate: "2026-09-19", origin: "created", status: "confirmed" },
  { id: "synthetic-current-2026-09-safety-inspection", type: "closure", title: "Annual safety inspection", berthId: "berth-south-float-east", startDate: "2026-09-16", endDate: "2026-09-18", origin: "created", status: "confirmed" },
  { id: "synthetic-current-2026-09-high-tide", type: "vessel", title: "S/V High Tide", vesselId: "vessel-s-v-high-tide", berthId: "berth-south-float-east", startDate: "2026-09-19", endDate: "2026-09-21", origin: "created", status: "confirmed" },
  { id: "synthetic-current-2026-09-pier-service", type: "closure", title: "Fender and ladder service", berthId: "berth-north-pier-face", startDate: "2026-09-21", endDate: "2026-09-23", origin: "created", status: "confirmed" },
];

export const recentReservations: Reservation[] = [...annualReservations, ...seasonalReservations, ...currentMonthReservations];
