import { describe, expect, it } from "vitest";
import { newestIssueFirst, newestReservationFirst } from "./sorting";
import type { Reservation, ValidationIssue } from "../types";

const reservation = (id: string, startDate: string, endDate = startDate): Reservation => ({
  id,
  type: "vessel",
  title: id,
  berthId: "berth-1",
  startDate,
  endDate,
  origin: "imported",
});

const issue = (id: string, year?: number, reservationIds?: string[]): ValidationIssue => ({
  id,
  category: "schedule",
  type: "BERTH_CONFLICT",
  severity: "error",
  message: id,
  year,
  reservationIds,
});

describe("newest-first sorting", () => {
  it("orders reservations by start date, then end date", () => {
    const items = [
      reservation("old", "2018-03-01"),
      reservation("latest-short", "2019-08-01", "2019-08-02"),
      reservation("latest-long", "2019-08-01", "2019-08-05"),
    ];

    expect(items.sort(newestReservationFirst).map((item) => item.id)).toEqual([
      "latest-long",
      "latest-short",
      "old",
    ]);
  });

  it("orders issues by their latest linked reservation date", () => {
    const reservations = [
      reservation("r-1999", "1999-05-01"),
      reservation("r-2019", "2019-06-01"),
    ];
    const issues = [
      issue("old", 1999, ["r-1999"]),
      issue("new", 2019, ["r-2019"]),
    ];

    expect(issues.sort(newestIssueFirst(reservations)).map((item) => item.id)).toEqual(["new", "old"]);
  });

  it("falls back to year and places undated findings last", () => {
    const issues = [issue("undated"), issue("older", 2001), issue("newer", 2017)];

    expect(issues.sort(newestIssueFirst([])).map((item) => item.id)).toEqual([
      "newer",
      "older",
      "undated",
    ]);
  });
});
