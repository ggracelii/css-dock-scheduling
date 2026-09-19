import { describe, expect, it } from "vitest";
import { datesOverlap } from "../src/lib/dates";
import { findConflicts, findVesselConflicts, recommendBerths, vesselFitsBerth } from "../src/lib/scheduling";
import type { Berth, Reservation, Vessel } from "../src/types";

const berths: Berth[] = [
  { id: "small", name: "Small", maxVesselLengthFt: 75, sourceLabels: [] },
  { id: "large", name: "Large", maxVesselLengthFt: 240, sourceLabels: [] },
  { id: "unknown", name: "Unknown", maxVesselLengthFt: null, sourceLabels: [] },
];
const vessel: Vessel = { id: "vessel", name: "R/V Test", lengthFt: 120, aliases: [], lengthSources: [] };
const reservation: Reservation = { id: "existing", type: "vessel", title: "Existing", vesselId: "vessel", berthId: "large", startDate: "2026-05-10", endDate: "2026-05-12", origin: "created" };

describe("inclusive date overlap", () => {
  it("treats a shared endpoint as an overlap", () => {
    expect(datesOverlap("2026-05-01", "2026-05-10", "2026-05-10", "2026-05-15")).toBe(true);
  });
  it("allows adjacent ranges without a shared day", () => {
    expect(datesOverlap("2026-05-01", "2026-05-09", "2026-05-10", "2026-05-15")).toBe(false);
  });
});

describe("scheduling rules", () => {
  it("finds same-berth conflicts and ignores other berths", () => {
    expect(findConflicts([reservation], { berthId: "large", startDate: "2026-05-12", endDate: "2026-05-13" })).toHaveLength(1);
    expect(findConflicts([reservation], { berthId: "small", startDate: "2026-05-12", endDate: "2026-05-13" })).toHaveLength(0);
  });
  it("prevents a vessel from occupying two berths on overlapping dates", () => {
    expect(findVesselConflicts([reservation], { vesselId: "vessel", startDate: "2026-05-11", endDate: "2026-05-13" })).toHaveLength(1);
    expect(findVesselConflicts([reservation], { vesselId: "vessel", startDate: "2026-05-12", endDate: "2026-05-12" })).toHaveLength(1);
    expect(findVesselConflicts([reservation], { vesselId: "vessel", startDate: "2026-05-13", endDate: "2026-05-14" })).toHaveLength(0);
  });
  it("ignores the reservation being edited and other vessels", () => {
    expect(findVesselConflicts([reservation], { id: "existing", vesselId: "vessel", startDate: "2026-05-11", endDate: "2026-05-13" })).toHaveLength(0);
    expect(findVesselConflicts([reservation], { vesselId: "another-vessel", startDate: "2026-05-11", endDate: "2026-05-13" })).toHaveLength(0);
  });
  it("distinguishes too long from unknown capacity", () => {
    expect(vesselFitsBerth(vessel, berths[0])).toBe(false);
    expect(vesselFitsBerth(vessel, berths[1])).toBe(true);
    expect(vesselFitsBerth(vessel, berths[2])).toBeNull();
  });
  it("recommends the smallest known berth that fits and is available", () => {
    const result = recommendBerths(berths, [reservation], vessel, "2026-06-01", "2026-06-02");
    expect(result.find((item) => item.recommended)?.berth.id).toBe("large");
  });
  it("never recommends an occupied berth", () => {
    const otherVesselReservation = { ...reservation, vesselId: "another-vessel" };
    const result = recommendBerths(berths, [otherVesselReservation], vessel, "2026-05-11", "2026-05-11");
    expect(result.find((item) => item.berth.id === "large")?.available).toBe(false);
    expect(result.find((item) => item.recommended)?.berth.id).toBe("unknown");
  });
  it("does not recommend any berth when the vessel is already booked", () => {
    const result = recommendBerths(berths, [reservation], vessel, "2026-05-11", "2026-05-11");
    expect(result.every((item) => item.available === false)).toBe(true);
    expect(result.find((item) => item.recommended)).toBeUndefined();
  });
});
