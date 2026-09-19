import type { Vessel } from "../types";

const maritimePrefixes = new Map([
  ["f/v", "F/V"],
  ["m/v", "M/V"],
  ["m/y", "M/Y"],
  ["osv", "OSV"],
  ["r/v", "R/V"],
  ["s/v", "S/V"],
  ["s/y", "S/Y"],
]);

export const toVesselTitleCase = (value: string) => value
  .trim()
  .replace(/\s+/g, " ")
  .split(" ")
  .map((word) => maritimePrefixes.get(word.toLowerCase()) ?? word
    .toLowerCase()
    .replace(/(^|[-'’])([a-z])/g, (_, boundary: string, letter: string) => `${boundary}${letter.toUpperCase()}`))
  .join(" ");

const comparableVesselName = (value: string) => toVesselTitleCase(value)
  .replace(/\s+\d+(?:\.\d+)?\s*(?:'|ft|feet)\s*$/i, "")
  .toLocaleLowerCase();

export const normalizeVessel = (vessel: Vessel): Vessel => {
  const name = toVesselTitleCase(vessel.name);
  const nameKey = comparableVesselName(name);
  const aliases = [...new Map(vessel.aliases
    .map(toVesselTitleCase)
    .filter((alias) => comparableVesselName(alias) !== nameKey)
    .map((alias) => [alias.toLocaleLowerCase(), alias])).values()];

  return { ...vessel, name, aliases };
};
