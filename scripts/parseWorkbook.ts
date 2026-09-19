import ExcelJS from "exceljs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  Annotation,
  Berth,
  ImportConfidence,
  ImportReport,
  Reservation,
  ReservationType,
  SourceReference,
  ValidationIssue,
  Vessel,
  VesselDimensionSource,
} from "../src/types/index.ts";

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];
const VESSEL_PREFIX = /^(?:r\s*\/\s*v|m\s*\/\s*v|f\s*\/\s*v|s\s*\/\s*v|s\s*\/\s*y|m\s*\/\s*y|osv|tug|barge)\b/i;
const RESOURCE_WORDS = /(?:pier|channel|float|slip|landing)/i;
const EVENT_WORDS = /(?:community\s+sail|campus\s+event|student\s+tour|holiday|open\s+house|regatta)/i;
const CLOSURE_WORDS = /(?:utility\s+work|maintenance|closed|construction|repair|dredg)/i;
const NOTE_WORDS = /^(?:arrival|depart|delayed|load\s+equipment|weather|eta|etd|note:)/i;

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultSource = "/Users/grace/Downloads/Dock Schedule - Synthetic Sample.xlsx";
const sourcePath = process.argv[2] || defaultSource;
const outputDir = path.resolve(here, "../src/data/generated");

const valueText = (value: ExcelJS.CellValue): string => {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text.trim();
    if ("result" in value) return valueText(value.result as ExcelJS.CellValue);
    if ("richText" in value && Array.isArray(value.richText))
      return value.richText.map((part) => part.text).join("").trim();
  }
  return String(value).trim();
};

const slug = (value: string) =>
  value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const isoDate = (year: number, month: number, day: number) =>
  `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

export const extractLength = (raw: string) => {
  const loa = raw.match(/\bLOA\s*:\s*(\d+(?:\.\d+)?)\s*['’]/i);
  const embedded = raw.match(/(?:\s|^)(\d+(?:\.\d+)?)\s*['’](?:\s|$|,)/);
  return Number(loa?.[1] ?? embedded?.[1] ?? NaN) || null;
};

export const normalizeVesselName = (raw: string) =>
  raw
    .replace(/[’]/g, "'")
    .replace(/\s+\d+(?:\.\d+)?\s*['’](?:\s|$)/, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^([rmfs])\s*\/\s*([vy])\s*/i, "$1/$2 ")
    .trim()
    .toLowerCase();

const displayVesselName = (raw: string) =>
  raw.replace(/\s+\d+(?:\.\d+)?\s*['’](?:\s|$)/, "").replace(/\s+/g, " ").trim();

const canonicalResource = (raw: string) =>
  raw.replace(/\s*[-–—]\s*\d+\s*['’].*$/, "").replace(/:\s*$/, "").trim();

const resourceCapacity = (raw: string) => {
  const match = raw.match(/(\d+)\s*['’]/);
  return match ? Number(match[1]) : null;
};

const isResourceLabel = (raw: string) =>
  RESOURCE_WORDS.test(raw) && !/(?:schedule|contact|coordinator|workbook)/i.test(raw);

const mergeByMaster = (sheet: ExcelJS.Worksheet) => {
  const index = new Map<string, string>();
  for (const range of sheet.model.merges ?? []) {
    const [start, end] = range.split(":");
    index.set(start, end ?? start);
  }
  return index;
};

interface MonthSection {
  month: number;
  headerRow: number;
  endRow: number;
  dateMap: Map<number, string>;
}

export const discoverMonthSections = (sheet: ExcelJS.Worksheet, year: number): MonthSection[] => {
  const headers: { month: number; row: number; explicitYear?: number }[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    let detected = -1;
    let explicitYear: number | undefined;
    row.eachCell({ includeEmpty: false }, (cell) => {
      const text = valueText(cell.value).toLowerCase();
      const month = MONTHS.findIndex((name) => new RegExp(`\\b${name}\\b`, "i").test(text));
      if (month >= 0) {
        detected = month;
        const yearMatch = text.match(/\b(19|20)\d{2}\b/);
        explicitYear = yearMatch ? Number(yearMatch[0]) : undefined;
      }
    });
    if (detected >= 0) headers.push({ month: detected, row: rowNumber, explicitYear });
  });

  const uniqueHeaders = headers.filter(
    (header, index) => index === 0 || header.row !== headers[index - 1].row,
  );
  return uniqueHeaders
    .map((header, index) => {
      const endRow = (uniqueHeaders[index + 1]?.row ?? sheet.rowCount + 1) - 1;
      let dateRow = header.row;
      let numericCells: { col: number; day: number }[] = [];
      for (let rowNumber = header.row; rowNumber <= Math.min(header.row + 2, endRow); rowNumber++) {
        const candidates: { col: number; day: number }[] = [];
        sheet.getRow(rowNumber).eachCell({ includeEmpty: false }, (cell, colNumber) => {
          const numeric = typeof cell.value === "number" ? cell.value : Number(valueText(cell.value));
          if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 31)
            candidates.push({ col: colNumber, day: numeric });
        });
        if (candidates.length > numericCells.length) {
          numericCells = candidates;
          dateRow = rowNumber;
        }
      }

      const daysInMonth = new Date(year, header.month + 1, 0).getDate();
      const dateMap = new Map<number, string>();
      if (numericCells.length) {
        for (const item of numericCells)
          if (item.day <= daysInMonth) dateMap.set(item.col, isoDate(year, header.month, item.day));
        if (numericCells.length === 1 && numericCells[0].day === 1) {
          for (let day = 1; day <= daysInMonth; day++)
            dateMap.set(numericCells[0].col + day - 1, isoDate(year, header.month, day));
        }
      }
      return { month: header.month, headerRow: header.row, endRow, dateMap, dateRow, explicitYear: header.explicitYear } as MonthSection & { dateRow: number; explicitYear?: number };
    })
    .filter((section) => section.dateMap.size > 0 && (section.explicitYear == null || section.explicitYear === year));
};

const addVesselSource = (
  map: Map<string, Vessel>,
  rawName: string,
  length: number | null,
  sourceKind: "name" | "loa-field",
  sourceReference: SourceReference,
) => {
  const key = normalizeVesselName(rawName);
  if (!key) return;
  const existing = map.get(key) ?? {
    id: `vessel-${slug(key)}`,
    name: displayVesselName(rawName),
    lengthFt: null,
    lengthSources: [],
    aliases: [],
    contacts: [],
    notes: [],
  };
  if (!existing.aliases.includes(rawName)) existing.aliases.push(rawName);
  if (length != null && !existing.lengthSources.some((item) => item.valueFt === length && item.source === sourceKind)) {
    existing.lengthSources.push({ valueFt: length, source: sourceKind, sourceReference });
    if (sourceKind === "loa-field" || existing.lengthFt == null) existing.lengthFt = length;
  }
  map.set(key, existing);
};

const parseVesselDirectories = (workbook: ExcelJS.Workbook) => {
  const vessels = new Map<string, Vessel>();
  for (const sheetName of ["Science", "Yachts"]) {
    const sheet = workbook.getWorksheet(sheetName);
    if (!sheet) continue;
    let activeKey: string | null = null;
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const cells: { address: string; text: string }[] = [];
      row.eachCell({ includeEmpty: false }, (cell) => {
        const text = valueText(cell.value);
        if (text) cells.push({ address: cell.address, text });
      });
      const vesselCell = cells.find((cell) => VESSEL_PREFIX.test(cell.text));
      if (vesselCell) {
        const source = { sheet: sheetName, cell: vesselCell.address, rawValue: vesselCell.text };
        const length = extractLength(vesselCell.text);
        addVesselSource(vessels, vesselCell.text, length, "name", source);
        activeKey = normalizeVesselName(vesselCell.text);
        const vessel = vessels.get(activeKey)!;
        const loaCell = cells.find((cell) => /\bLOA\s*:/i.test(cell.text));
        const loa = loaCell ? extractLength(loaCell.text) : null;
        if (loaCell && loa != null)
          addVesselSource(vessels, vesselCell.text, loa, "loa-field", {
            sheet: sheetName, cell: loaCell.address, rawValue: loaCell.text,
          });
        const operator = cells.find((cell) => cell.address !== vesselCell.address && !/^(?:Cell:|LOA:)/i.test(cell.text) && !cell.text.includes("@"));
        if (operator) vessel.operator = operator.text;
      } else if (activeKey) {
        const vessel = vessels.get(activeKey)!;
        for (const cell of cells) {
          if (/[@]|\b(?:555|tel|cell|phone)\b/i.test(cell.text)) vessel.contacts!.push(cell.text);
          else if (!/^(?:VESSEL|OPERATOR|CONTACT|WORK#|CELL#|EMAIL|NOTES)$/i.test(cell.text)) vessel.notes!.push(cell.text);
        }
      }
      if (cells.length === 0 && rowNumber > 1) activeKey = null;
    });
  }
  return vessels;
};

const classify = (raw: string, knownVessels: Map<string, Vessel>): { type?: ReservationType; confidence: ImportConfidence } => {
  if (VESSEL_PREFIX.test(raw) || knownVessels.has(normalizeVesselName(raw))) return { type: "vessel", confidence: "high" };
  if (CLOSURE_WORDS.test(raw)) return { type: "closure", confidence: "medium" };
  if (EVENT_WORDS.test(raw)) return { type: "event", confidence: "medium" };
  if (NOTE_WORDS.test(raw)) return { confidence: "medium" };
  return { type: "event", confidence: "low" };
};

const validate = (reservations: Reservation[], berths: Berth[], vessels: Vessel[]): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const unknownLengthVessels = new Set<string>();
  const berthMap = new Map(berths.map((item) => [item.id, item]));
  const vesselMap = new Map(vessels.map((item) => [item.id, item]));
  const byBerth = new Map<string, Reservation[]>();
  for (const reservation of reservations) {
    const group = byBerth.get(reservation.berthId) ?? [];
    group.push(reservation);
    byBerth.set(reservation.berthId, group);
    if (reservation.type === "vessel") {
      const berth = berthMap.get(reservation.berthId);
      const vessel = reservation.vesselId ? vesselMap.get(reservation.vesselId) : undefined;
      if (!vessel) {
        issues.push({ id: `unmatched-${reservation.id}`, category: "reference-data", type: "UNMATCHED_VESSEL", severity: "warning", message: `${reservation.title} is not matched to the vessel directory.`, reservationIds: [reservation.id], berthId: reservation.berthId, sourceReferences: reservation.source ? [reservation.source] : [], year: Number(reservation.startDate.slice(0, 4)), confidence: reservation.importConfidence });
      } else if (vessel.lengthFt == null && !unknownLengthVessels.has(vessel.id)) {
        unknownLengthVessels.add(vessel.id);
        issues.push({ id: `length-${reservation.id}`, category: "reference-data", type: "UNKNOWN_VESSEL_LENGTH", severity: "info", message: `${vessel.name} has no verified length.`, reservationIds: [reservation.id], vesselId: vessel.id, berthId: reservation.berthId, year: Number(reservation.startDate.slice(0, 4)), confidence: reservation.importConfidence });
      } else if (berth?.maxVesselLengthFt != null && vessel.lengthFt != null && vessel.lengthFt > berth.maxVesselLengthFt) {
        issues.push({ id: `capacity-${reservation.id}`, category: "capacity", type: "VESSEL_TOO_LONG", severity: "error", message: `${vessel.name} (${vessel.lengthFt} ft) exceeds ${berth.name} capacity (${berth.maxVesselLengthFt} ft).`, reservationIds: [reservation.id], vesselId: vessel.id, berthId: reservation.berthId, sourceReferences: reservation.source ? [reservation.source] : [], year: Number(reservation.startDate.slice(0, 4)), confidence: reservation.importConfidence });
      }
    }
  }
  for (const [berthId, group] of byBerth) {
    group.sort((a, b) => a.startDate.localeCompare(b.startDate));
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length && group[j].startDate <= group[i].endDate; j++) {
        if (group[i].startDate <= group[j].endDate) {
          issues.push({ id: `conflict-${group[i].id}-${group[j].id}`, category: "schedule", type: "BERTH_CONFLICT", severity: "error", message: `${group[i].title} overlaps ${group[j].title} at ${berthMap.get(berthId)?.name ?? berthId}.`, reservationIds: [group[i].id, group[j].id], berthId, sourceReferences: [group[i].source, group[j].source].filter(Boolean) as SourceReference[], year: Number(group[i].startDate.slice(0, 4)), confidence: group[i].importConfidence });
        }
      }
    }
  }
  for (const vessel of vessels) {
    const unique = [...new Set(vessel.lengthSources.map((source) => source.valueFt))];
    if (unique.length > 1)
      issues.push({ id: `dimension-${vessel.id}`, category: "reference-data", type: "VESSEL_LENGTH_CONFLICT", severity: "warning", message: `${vessel.name} has conflicting recorded lengths: ${unique.join(" ft and ")} ft.`, vesselId: vessel.id, sourceReferences: vessel.lengthSources.map((source) => source.sourceReference).filter(Boolean) as SourceReference[] });
  }
  return issues;
};

const compareDockSummary = (
  workbook: ExcelJS.Workbook,
  reservations: Reservation[],
  berths: Berth[],
) => {
  const sheet = workbook.getWorksheet("8YR Dock Summary");
  const comparisons: ImportReport["summaryComparisons"] = [];
  const issues: ValidationIssue[] = [];
  if (!sheet) return { comparisons, issues };
  const berthByName = new Map(berths.map((berth) => [berth.name.toLowerCase(), berth]));
  const yearByColumn = new Map<number, number>();
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, column) => {
    const year = Number(valueText(cell.value));
    if (year >= 1900 && year <= 2100) yearByColumn.set(column, year);
  });
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const resource = valueText(sheet.getCell(rowNumber, 1).value);
    if (!resource || /total/i.test(resource)) continue;
    const berth = berthByName.get(resource.toLowerCase());
    for (const [column, year] of yearByColumn) {
      const cell = sheet.getCell(rowNumber, column);
      const legacyDays = Number(valueText(cell.value));
      if (!Number.isFinite(legacyDays)) continue;
      const parsedDays = berth
        ? reservations
            .filter((reservation) => reservation.berthId === berth.id && Number(reservation.startDate.slice(0, 4)) === year)
            .reduce((total, reservation) => total + Math.round((new Date(`${reservation.endDate}T12:00:00`).getTime() - new Date(`${reservation.startDate}T12:00:00`).getTime()) / 86_400_000) + 1, 0)
        : 0;
      const difference = parsedDays - legacyDays;
      const comparison = { resource, year, parsedDays, legacyDays, difference, exact: difference === 0 };
      comparisons.push(comparison);
      if (!comparison.exact) {
        issues.push({
          id: `summary-${year}-${slug(resource)}`,
          category: "import",
          type: "SUMMARY_MISMATCH",
          severity: "warning",
          message: `${resource} ${year}: parsed ${parsedDays} occupied days versus ${legacyDays} in the legacy summary (${difference > 0 ? "+" : ""}${difference}).`,
          berthId: berth?.id,
          year,
          sourceReferences: [{ sheet: sheet.name, cell: cell.address, rawValue: String(legacyDays) }],
        });
      }
    }
  }
  return { comparisons, issues };
};

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(sourcePath);
  const vesselsByName = parseVesselDirectories(workbook);
  const berthsByName = new Map<string, Berth>();
  const reservations: Reservation[] = [];
  const annotations: Annotation[] = [];
  const annualSheets = workbook.worksheets.filter((sheet) => /^\d{4}$/.test(sheet.name));

  for (const sheet of annualSheets) {
    const year = Number(sheet.name);
    const sections = discoverMonthSections(sheet, year);
    const mergeIndex = mergeByMaster(sheet);
    for (const section of sections) {
      for (let rowNumber = section.headerRow + 1; rowNumber <= section.endRow; rowNumber++) {
        const row = sheet.getRow(rowNumber);
        let rawResource = "";
        let resourceColumn = 0;
        row.eachCell({ includeEmpty: false }, (cell, col) => {
          const text = valueText(cell.value);
          if (!rawResource && col <= 2 && isResourceLabel(text) && !CLOSURE_WORDS.test(text) && !/(?:test|no\s+(?:usage|docking))/i.test(text)) {
            rawResource = text;
            resourceColumn = col;
          }
        });
        if (!rawResource) continue;
        const name = canonicalResource(rawResource);
        const berthId = `berth-${slug(name)}`;
        const existingBerth = berthsByName.get(name) ?? { id: berthId, name, maxVesselLengthFt: resourceCapacity(rawResource), sourceLabels: [] };
        if (!existingBerth.sourceLabels.includes(rawResource)) existingBerth.sourceLabels.push(rawResource);
        if (existingBerth.maxVesselLengthFt == null) existingBerth.maxVesselLengthFt = resourceCapacity(rawResource);
        berthsByName.set(name, existingBerth);

        for (const [column, startDate] of section.dateMap) {
          if (column === resourceColumn) continue;
          const cell = row.getCell(column);
          if (cell.isMerged && cell.master.address !== cell.address) continue;
          const raw = valueText(cell.value);
          if (!raw) continue;
          const classification = classify(raw, vesselsByName);
          const endAddress = mergeIndex.get(cell.address);
          const endColumn = endAddress ? Number(sheet.getCell(endAddress).col) : column;
          const endDate = section.dateMap.get(endColumn) ?? startDate;
          const source: SourceReference = { sheet: sheet.name, rawValue: raw, ...(endAddress ? { range: `${cell.address}:${endAddress}` } : { cell: cell.address }) };
          if (!classification.type) {
            annotations.push({ id: `annotation-${sheet.name}-${cell.address}`, text: raw, source, confidence: classification.confidence });
            continue;
          }
          let vesselId: string | undefined;
          if (classification.type === "vessel") {
            const key = normalizeVesselName(raw);
            const embeddedLength = extractLength(raw);
            if (!vesselsByName.has(key)) addVesselSource(vesselsByName, raw, embeddedLength, "name", source);
            vesselId = vesselsByName.get(key)?.id;
          }
          reservations.push({ id: `reservation-${sheet.name}-${cell.address}`, type: classification.type, title: classification.type === "vessel" ? displayVesselName(raw) : raw, vesselId, berthId, startDate, endDate, source, importConfidence: classification.confidence, origin: "imported", status: "confirmed" });
        }
      }
    }
  }

  const berths = [...berthsByName.values()].sort((a, b) => (b.maxVesselLengthFt ?? -1) - (a.maxVesselLengthFt ?? -1));
  const vessels = [...vesselsByName.values()].map((vessel) => ({ ...vessel, contacts: [...new Set(vessel.contacts)], notes: [...new Set(vessel.notes)] })).sort((a, b) => a.name.localeCompare(b.name));
  const issues = validate(reservations, berths, vessels);
  const summary = compareDockSummary(workbook, reservations, berths);
  issues.push(...summary.issues);
  const countBy = <T extends string>(values: T[], keys: T[]) => Object.fromEntries(keys.map((key) => [key, values.filter((value) => value === key).length])) as Record<T, number>;
  const report: ImportReport = {
    sourceFile: path.basename(sourcePath), scheduleYears: { first: Math.min(...annualSheets.map((sheet) => Number(sheet.name))), last: Math.max(...annualSheets.map((sheet) => Number(sheet.name))) }, annualSheetsParsed: annualSheets.length, reservationCount: reservations.length, vesselCount: vessels.length, berthCount: berths.length, annotationCount: annotations.length,
    typeCounts: countBy(reservations.map((item) => item.type), ["vessel", "event", "closure"]),
    confidenceCounts: countBy(reservations.map((item) => item.importConfidence ?? "low"), ["high", "medium", "low"]),
    issueCounts: Object.fromEntries([...new Set(issues.map((issue) => issue.type))].map((type) => [type, issues.filter((issue) => issue.type === type).length])), summaryComparisons: summary.comparisons, generatedAt: new Date().toISOString(),
    assumptions: ["Merged horizontal cells define inclusive reservation date ranges.", "Populated unmerged berth cells represent one-day entries.", "Tours is ancillary reference data and is not imported as berth occupancy.", "Unknown berth capacity is preserved as unknown, not unlimited."],
  };
  await mkdir(outputDir, { recursive: true });
  const outputs: Record<string, unknown> = { "berths.json": berths, "vessels.json": vessels, "reservations.json": reservations, "annotations.json": annotations, "validation-issues.json": issues, "import-report.json": report };
  await Promise.all(Object.entries(outputs).map(([file, data]) => writeFile(path.join(outputDir, file), `${JSON.stringify(data, null, 2)}\n`)));
  console.log(`Dock Schedule Import\nAnnual sheets parsed  ${report.annualSheetsParsed}\nYears                 ${report.scheduleYears.first}-${report.scheduleYears.last}\nResources             ${report.berthCount}\nVessels               ${report.vesselCount}\nReservations          ${report.reservationCount}\nEvents                ${report.typeCounts.event}\nClosures              ${report.typeCounts.closure}\nAnnotations           ${report.annotationCount}\nIssues                ${issues.length}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
