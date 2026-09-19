import type { Reservation, ValidationIssue } from "../types";

export const newestReservationFirst = (a: Reservation, b: Reservation) =>
  b.startDate.localeCompare(a.startDate) || b.endDate.localeCompare(a.endDate);

const latestIssueDate = (issue: ValidationIssue, reservationsById: Map<string, Reservation>) => {
  const reservationDate = (issue.reservationIds ?? []).reduce((latest, id) => {
    const startDate = reservationsById.get(id)?.startDate ?? "";
    return startDate > latest ? startDate : latest;
  }, "");

  if (reservationDate) return reservationDate;
  return issue.year ? `${issue.year}-12-31` : "";
};

export const newestIssueFirst = (reservations: Reservation[]) => {
  const reservationsById = new Map(reservations.map((reservation) => [reservation.id, reservation]));
  return (a: ValidationIssue, b: ValidationIssue) =>
    latestIssueDate(b, reservationsById).localeCompare(latestIssueDate(a, reservationsById));
};
