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

export const recentReservations: Reservation[] = [...annualReservations, ...currentMonthReservations];
