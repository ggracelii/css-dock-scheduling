import { describe, expect, it } from "vitest";
import vesselsData from "./generated/vessels.json";
import { recentReservations } from "./recentReservations";

describe("recent synthetic reservations", () => {
  it("covers every year after the supplied schedule through 2026", () => {
    const years = new Set(recentReservations.map((item) => item.startDate.slice(0, 4)));
    expect([...years]).toEqual(["2020", "2021", "2022", "2023", "2024", "2025", "2026"]);
    expect(new Set(recentReservations.map((item) => item.type))).toEqual(new Set(["vessel", "event", "closure"]));
  });

  it("references known vessels", () => {
    const vesselIds = new Set(vesselsData.map((item) => item.id));
    expect(recentReservations.filter((item) => item.vesselId && !vesselIds.has(item.vesselId))).toEqual([]);
  });

  it("does not double-book a berth", () => {
    const overlaps = recentReservations.flatMap((reservation, index) =>
      recentReservations.slice(index + 1).filter((candidate) =>
        reservation.berthId === candidate.berthId
        && reservation.startDate <= candidate.endDate
        && reservation.endDate >= candidate.startDate,
      ),
    );
    expect(overlaps).toEqual([]);
  });
});
