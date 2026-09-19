import type { Vessel, VesselContact } from "../types";

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

  const rawContacts = (vessel.contacts ?? []) as Array<VesselContact | string>;
  const contacts = [...new Map(rawContacts.map((contact, index) => {
    const rawValue = typeof contact === "string" ? contact : contact.value;
    const type = typeof contact === "string" ? (rawValue.includes("@") ? "email" : "phone") : contact.type;
    const value = rawValue.trim().replace(/^(?:cell|phone|tel):\s*/i, "");
    const normalized: VesselContact = {
      id: typeof contact === "string" || !contact.id ? `contact-${vessel.id}-${index}` : contact.id,
      type,
      value,
    };
    return [`${type}:${value.toLocaleLowerCase()}`, normalized] as const;
  }).filter(([key]) => !key.endsWith(":"))).values()];

  return { ...vessel, name, aliases, contacts };
};
