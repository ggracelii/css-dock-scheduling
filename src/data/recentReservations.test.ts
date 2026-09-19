import { describe, expect, it } from "vitest";
import berthsData from "./generated/berths.json";
import importedReservations from "./generated/reservations.json";
import vesselsData from "./generated/vessels.json";
import { recentReservations } from "./recentReservations";

describe("recent synthetic reservations", () => {
  it("covers every year after the supplied schedule through 2026", () => {
    const years = new Set(recentReservations.map((item) => item.startDate.slice(0, 4)));
    expect([...years].sort()).toEqual(["2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026"]);
    expect(new Set(recentReservations.map((item) => item.type))).toEqual(new Set(["vessel", "event", "closure"]));
  });

  it("references known vessels", () => {
    const vesselIds = new Set(vesselsData.map((item) => item.id));
    expect(recentReservations.filter((item) => item.vesselId && !vesselIds.has(item.vesselId))).toEqual([]);
  });

  it("provides a useful volume of recent demonstration data", () => {
    const counts = recentReservations.reduce<Record<string, number>>((totals, reservation) => {
      const year = reservation.startDate.slice(0, 4);
      totals[year] = (totals[year] ?? 0) + 1;
      return totals;
    }, {});
    expect(counts["2019"]).toBe(10);
    for (let year = 2020; year <= 2026; year += 1) expect(counts[String(year)]).toBeGreaterThanOrEqual(48);
  });

  it("assigns known vessel lengths within berth limits", () => {
    const vessels = new Map(vesselsData.map((item) => [item.id, item]));
    const berths = new Map(berthsData.map((item) => [item.id, item]));
    const oversized = recentReservations.filter((reservation) => {
      if (reservation.type !== "vessel" || !reservation.vesselId) return false;
      const vessel = vessels.get(reservation.vesselId);
      const berth = berths.get(reservation.berthId);
      return vessel?.lengthFt != null && berth?.maxVesselLengthFt != null && vessel.lengthFt > berth.maxVesselLengthFt;
    });
    expect(oversized).toEqual([]);
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

  it("does not overlap the supplied historical schedule", () => {
    const overlaps = recentReservations.flatMap((reservation) =>
      importedReservations.filter((candidate) =>
        reservation.berthId === candidate.berthId
        && reservation.startDate <= candidate.endDate
        && reservation.endDate >= candidate.startDate,
      ),
    );
    expect(overlaps).toEqual([]);
  });

  it("does not book one vessel in two places at once", () => {
    const overlaps = recentReservations.flatMap((reservation, index) =>
      recentReservations.slice(index + 1).filter((candidate) =>
        reservation.type === "vessel"
        && candidate.type === "vessel"
        && reservation.vesselId === candidate.vesselId
        && reservation.startDate <= candidate.endDate
        && reservation.endDate >= candidate.startDate,
      ),
    );
    expect(overlaps).toEqual([]);
  });
});
