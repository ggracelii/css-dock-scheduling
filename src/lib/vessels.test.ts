import { describe, expect, it } from "vitest";
import { normalizeVessel, toVesselTitleCase } from "./vessels";
import type { Vessel } from "../types";

const vessel = (name: string, aliases: string[] = []): Vessel => ({
  id: "vessel-test",
  name,
  lengthFt: null,
  lengthSources: [],
  aliases,
});

describe("vessel name normalization", () => {
  it("title-cases names while preserving maritime prefixes", () => {
    expect(toVesselTitleCase("R/V BLUE HORIZON")).toBe("R/V Blue Horizon");
    expect(toVesselTitleCase("OSV AMBER REEF")).toBe("OSV Amber Reef");
  });

  it("removes aliases that repeat the vessel name", () => {
    expect(normalizeVessel(vessel("Barge BLUE HORIZON", ["Barge BLUE HORIZON"]))).toMatchObject({
      name: "Barge Blue Horizon",
      aliases: [],
    });
  });

  it("does not treat a length suffix as a different name", () => {
    expect(normalizeVessel(vessel("Barge High Voyager", ["Barge High Voyager 100'"])).aliases).toEqual([]);
  });

  it("keeps genuinely different names and removes duplicates", () => {
    expect(normalizeVessel(vessel("R/V Blue Horizon", ["Northern Light", "NORTHERN LIGHT"])).aliases).toEqual(["Northern Light"]);
  });

  it("migrates legacy contact strings into typed contacts", () => {
    const legacy = { ...vessel("R/V Blue Horizon"), contacts: ["Cell: 555-0104", "captain@example.com"] } as unknown as Vessel;
    expect(normalizeVessel(legacy).contacts).toEqual([
      { id: "contact-vessel-test-0", type: "phone", value: "555-0104" },
      { id: "contact-vessel-test-1", type: "email", value: "captain@example.com" },
    ]);
  });
});
